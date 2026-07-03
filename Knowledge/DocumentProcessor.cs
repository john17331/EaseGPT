using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using JiebaNet.Segmenter;
using Microsoft.Extensions.Options;

namespace EaseGPT.Knowledge;

public sealed partial class DocumentProcessor
{
    private const int ParagraphTargetLength = 800;
    private const int ParagraphMaxLength = 1024;
    private const int ParagraphOverlap = 100;

    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "的", "了", "和", "与", "及", "等", "是", "在", "对", "将", "把", "被", "也", "并", "或", "而", "及其",
        "一个", "一些", "一种", "可以", "进行", "需要", "包括", "通过", "关于", "相关", "以及", "根据", "这个", "那个",
        "我们", "你们", "他们", "是否", "如何", "什么", "哪些", "为什么", "用于", "由于", "因为", "所以",
        "the", "and", "for", "with", "that", "this", "from", "into", "are", "was", "were", "has", "have"
    };

    private readonly RagOptions _options;
    private readonly JiebaSegmenter _segmenter;

    public DocumentProcessor(IOptions<RagOptions> options, IWebHostEnvironment environment)
    {
        _options = options.Value;
        EnsureJiebaResources(environment.ContentRootPath, AppContext.BaseDirectory);
        _segmenter = new JiebaSegmenter();
    }

    public async Task<string> ParseAsync(KnowledgeDocument document, CancellationToken ct)
    {
        var extension = Path.GetExtension(document.FileName).ToLowerInvariant();
        return extension switch
        {
            ".txt" or ".md" or ".markdown" or ".csv" or ".json" or ".xml" or ".yaml" or ".yml" or ".log" => await File.ReadAllTextAsync(document.StoragePath, ct),
            ".html" or ".htm" => StripHtml(await File.ReadAllTextAsync(document.StoragePath, ct)),
            ".docx" => await ParseDocxAsync(document.StoragePath, ct),
            _ when document.ContentType.StartsWith("text/", StringComparison.OrdinalIgnoreCase) => await File.ReadAllTextAsync(document.StoragePath, ct),
            _ => throw new NotSupportedException($"Unsupported document type: {extension}")
        };
    }

    public IReadOnlyList<KnowledgeChunk> Chunk(KnowledgeDocument document, string rawText, KnowledgeBase knowledgeBase)
    {
        var text = Normalize(rawText);
        if (string.IsNullOrWhiteSpace(text)) return [];

        return string.Equals(knowledgeBase.ChunkMode, "fixed", StringComparison.OrdinalIgnoreCase)
            ? BuildFixedChunks(document, text, knowledgeBase)
            : BuildParagraphChunks(document, text);
    }

    public IReadOnlyList<string> BuildEmbeddingTexts(KnowledgeChunk chunk)
    {
        var titlePath = NormalizeInline(chunk.TitlePath);
        var body = NormalizeInline(chunk.Text);
        var keywords = NormalizeInline(chunk.KeywordSummary);
        var searchText = NormalizeInline(chunk.SearchText);

        var primary = string.IsNullOrWhiteSpace(titlePath)
            ? body
            : $"{titlePath}\n{body}";

        var secondary = string.IsNullOrWhiteSpace(searchText)
            ? BuildQuestionPrompt(titlePath, keywords, body)
            : searchText;

        return [primary, secondary];
    }

    private IReadOnlyList<KnowledgeChunk> BuildFixedChunks(KnowledgeDocument document, string text, KnowledgeBase knowledgeBase)
    {
        var delimiter = DecodeDelimiter(knowledgeBase.ChunkDelimiter);
        var size = Math.Clamp(knowledgeBase.ChunkSize > 0 ? knowledgeBase.ChunkSize : _options.ChunkSize, 200, 4000);
        var overlap = Math.Clamp(knowledgeBase.ChunkOverlap, 0, size / 2);
        var chunks = new List<KnowledgeChunk>();
        var position = 0;
        string? heading = null;

        while (position < text.Length)
        {
            var maxEnd = Math.Min(text.Length, position + size);
            var end = FindBoundary(text, position, maxEnd, delimiter);
            var value = text[position..end].Trim();
            var headingMatch = LegacyHeadingRegex().Matches(value).LastOrDefault();
            if (headingMatch is not null) heading = headingMatch.Groups[1].Value.Trim();
            if (value.Length > 0)
            {
                chunks.Add(CreateChunk(
                    document,
                    chunks.Count,
                    heading,
                    heading,
                    value,
                    position,
                    end));
            }

            if (end >= text.Length) break;
            position = Math.Max(position + 1, end - overlap);
        }

        return chunks;
    }

    private IReadOnlyList<KnowledgeChunk> BuildParagraphChunks(KnowledgeDocument document, string text)
    {
        var paragraphs = ParagraphBlockRegex().Matches(text)
            .Select(CreateParagraphSlice)
            .Where(item => !string.IsNullOrWhiteSpace(item.Text))
            .ToList();
        if (paragraphs.Count == 0) return [];

        var chunks = new List<KnowledgeChunk>();
        var headingStack = new List<HeadingNode>();
        var sectionParagraphs = new List<ParagraphSlice>();
        string? sectionHeading = null;
        string? sectionTitlePath = null;

        foreach (var paragraph in paragraphs)
        {
            if (TryParseHeading(paragraph.Text, out var heading))
            {
                FlushSection(document, chunks, sectionParagraphs, sectionHeading, sectionTitlePath);
                UpdateHeadingStack(headingStack, heading!);
                sectionHeading = headingStack.LastOrDefault()?.Text;
                sectionTitlePath = BuildTitlePath(headingStack);
                continue;
            }

            sectionHeading = headingStack.LastOrDefault()?.Text;
            sectionTitlePath = BuildTitlePath(headingStack);
            sectionParagraphs.Add(paragraph);
        }

        FlushSection(document, chunks, sectionParagraphs, sectionHeading, sectionTitlePath);
        return chunks;
    }

    private void FlushSection(
        KnowledgeDocument document,
        List<KnowledgeChunk> chunks,
        List<ParagraphSlice> sectionParagraphs,
        string? heading,
        string? titlePath)
    {
        if (sectionParagraphs.Count == 0) return;

        var normalizedTitlePath = NormalizeInline(titlePath);
        var units = sectionParagraphs
            .SelectMany(paragraph => SplitOversizedParagraph(paragraph, ParagraphMaxLength))
            .ToList();

        var currentParts = new List<string>();
        var overlapPrefix = string.Empty;
        var chunkStart = units[0].Start;
        var chunkEnd = units[0].End;

        foreach (var unit in units)
        {
            if (currentParts.Count == 0)
            {
                chunkStart = unit.Start;
                chunkEnd = unit.End;
                if (!string.IsNullOrWhiteSpace(overlapPrefix))
                {
                    currentParts.Add(FitOverlapPrefix(overlapPrefix, unit.Text, ParagraphMaxLength));
                }
            }

            var candidateParts = currentParts.Count == 0
                ? [unit.Text]
                : currentParts.Concat([unit.Text]).ToList();
            var candidateText = JoinParts(candidateParts);
            var currentText = JoinParts(currentParts);

            if (currentParts.Count > 0
                && currentText.Length >= ParagraphTargetLength
                && candidateText.Length > ParagraphTargetLength)
            {
                overlapPrefix = EmitParagraphChunk(document, chunks, heading, normalizedTitlePath, currentParts, chunkStart, chunkEnd);
                currentParts = [];
                chunkStart = unit.Start;
                chunkEnd = unit.End;
                if (!string.IsNullOrWhiteSpace(overlapPrefix))
                {
                    currentParts.Add(FitOverlapPrefix(overlapPrefix, unit.Text, ParagraphMaxLength));
                }
                currentParts.Add(unit.Text);
                continue;
            }

            if (candidateText.Length <= ParagraphMaxLength)
            {
                currentParts = candidateParts;
                chunkEnd = unit.End;
                continue;
            }

            if (currentParts.Count > 0)
            {
                overlapPrefix = EmitParagraphChunk(document, chunks, heading, normalizedTitlePath, currentParts, chunkStart, chunkEnd);
                currentParts = [];
                chunkStart = unit.Start;
                chunkEnd = unit.End;
                if (!string.IsNullOrWhiteSpace(overlapPrefix))
                {
                    currentParts.Add(FitOverlapPrefix(overlapPrefix, unit.Text, ParagraphMaxLength));
                }
            }

            currentParts.Add(unit.Text);
        }

        if (currentParts.Count > 0)
        {
            EmitParagraphChunk(document, chunks, heading, normalizedTitlePath, currentParts, chunkStart, chunkEnd);
        }

        sectionParagraphs.Clear();
    }

    private string EmitParagraphChunk(
        KnowledgeDocument document,
        List<KnowledgeChunk> chunks,
        string? heading,
        string? titlePath,
        IReadOnlyList<string> parts,
        int startOffset,
        int endOffset)
    {
        var text = JoinParts(parts).Trim();
        if (text.Length == 0) return string.Empty;

        chunks.Add(CreateChunk(
            document,
            chunks.Count,
            heading,
            titlePath,
            text,
            startOffset,
            endOffset));

        return TakeTail(text, ParagraphOverlap);
    }

    private KnowledgeChunk CreateChunk(
        KnowledgeDocument document,
        int index,
        string? heading,
        string? titlePath,
        string text,
        int startOffset,
        int endOffset)
    {
        var normalizedTitlePath = NormalizeInline(titlePath);
        var keywords = ExtractKeywords(text, normalizedTitlePath);
        var keywordSummary = string.Join(" ", keywords);
        var searchText = BuildSearchText(normalizedTitlePath, keywordSummary, text);

        return new KnowledgeChunk
        {
            KnowledgeBaseId = document.KnowledgeBaseId,
            DocumentId = document.Id,
            FileName = document.FileName,
            Index = index,
            Heading = NormalizeInline(heading),
            TitlePath = normalizedTitlePath,
            KeywordSummary = keywordSummary,
            SearchText = searchText,
            Text = text,
            StartOffset = startOffset,
            EndOffset = endOffset
        };
    }

    private IReadOnlyList<string> ExtractKeywords(string text, string? titlePath)
    {
        var scores = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var token in Tokenize(titlePath))
        {
            scores[token] = scores.TryGetValue(token, out var count) ? count + 4 : 4;
        }

        foreach (var token in Tokenize(text))
        {
            scores[token] = scores.TryGetValue(token, out var count) ? count + 1 : 1;
        }

        return scores
            .OrderByDescending(item => item.Value)
            .ThenByDescending(item => item.Key.Length)
            .ThenBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
            .Select(item => item.Key)
            .Take(8)
            .ToList();
    }

    private IEnumerable<string> Tokenize(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            yield break;
        }

        foreach (var raw in _segmenter.Cut(text, cutAll: false))
        {
            var token = NormalizeToken(raw);
            if (string.IsNullOrWhiteSpace(token)) continue;
            if (StopWords.Contains(token)) continue;
            if (token.All(char.IsDigit)) continue;
            if (token.Length == 1 && token[0] < 128) continue;
            yield return token;
        }
    }

    private static string BuildSearchText(string? titlePath, string keywords, string body)
        => string.Join(
            "\n",
            new[]
            {
                string.IsNullOrWhiteSpace(titlePath) ? string.Empty : $"标题路径 {titlePath}",
                string.IsNullOrWhiteSpace(keywords) ? string.Empty : $"关键词 {keywords}",
                BuildQuestionPrompt(titlePath, keywords, body)
            }.Where(value => !string.IsNullOrWhiteSpace(value)));

    private static string BuildQuestionPrompt(string? titlePath, string? keywords, string body)
    {
        var title = NormalizeInline(titlePath);
        var keywordText = NormalizeInline(keywords);
        var bodySeed = NormalizeInline(body.Length <= 96 ? body : body[..96]);

        return string.Join(
            "\n",
            new[]
            {
                string.IsNullOrWhiteSpace(title) ? "问题 这一段主要讲什么" : $"问题 {title} 主要讲什么",
                string.IsNullOrWhiteSpace(keywordText) ? string.Empty : $"问题 {keywordText} 分别对应哪些要点",
                string.IsNullOrWhiteSpace(bodySeed) ? string.Empty : $"问题 {bodySeed}"
            }.Where(value => !string.IsNullOrWhiteSpace(value)));
    }

    private static string JoinParts(IEnumerable<string> parts)
        => string.Join("\n\n", parts.Where(part => !string.IsNullOrWhiteSpace(part)).Select(part => part.Trim()));

    private static string FitOverlapPrefix(string overlapText, string nextParagraph, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(overlapText)) return string.Empty;
        var budget = Math.Max(0, maxLength - nextParagraph.Length - 2);
        if (budget <= 0) return string.Empty;
        return overlapText.Length <= budget ? overlapText : overlapText[^budget..];
    }

    private static string TakeTail(string text, int length)
    {
        var normalized = NormalizeInline(text);
        if (normalized.Length <= length) return normalized;
        return normalized[^length..];
    }

    private static IEnumerable<ParagraphSlice> SplitOversizedParagraph(ParagraphSlice paragraph, int maxLength)
    {
        if (paragraph.Text.Length <= maxLength)
        {
            yield return paragraph;
            yield break;
        }

        var localStart = 0;
        while (localStart < paragraph.Text.Length)
        {
            var remaining = paragraph.Text.Length - localStart;
            var size = Math.Min(maxLength, remaining);
            var maxEnd = localStart + size;
            var end = FindSentenceBoundary(paragraph.Text, localStart, maxEnd);
            if (end <= localStart) end = maxEnd;

            var value = paragraph.Text[localStart..end].Trim();
            if (value.Length > 0)
            {
                yield return new ParagraphSlice(
                    value,
                    paragraph.Start + localStart,
                    paragraph.Start + end);
            }

            if (end >= paragraph.Text.Length) yield break;
            localStart = Math.Max(localStart + 1, end - ParagraphOverlap);
        }
    }

    private static int FindBoundary(string text, int start, int maxEnd, string delimiter)
    {
        if (maxEnd >= text.Length) return text.Length;
        var min = start + (int)((maxEnd - start) * 0.6);
        if (!string.IsNullOrEmpty(delimiter))
        {
            var boundary = text.LastIndexOf(delimiter, maxEnd - 1, Math.Max(1, maxEnd - min), StringComparison.Ordinal);
            if (boundary >= min) return Math.Min(text.Length, boundary + delimiter.Length);
        }

        return FindSentenceBoundary(text, min, maxEnd);
    }

    private static int FindSentenceBoundary(string text, int start, int maxEnd)
    {
        if (maxEnd >= text.Length) return text.Length;
        for (var i = maxEnd; i > start; i--)
        {
            var c = text[i - 1];
            if (c is '\n' or '。' or '！' or '？' or '；' or '.' or '!' or '?' or ';')
            {
                return i;
            }
        }

        return maxEnd;
    }

    private static ParagraphSlice CreateParagraphSlice(Match match)
    {
        var raw = match.Value;
        var leading = raw.Length - raw.TrimStart().Length;
        var trailing = raw.Length - raw.TrimEnd().Length;
        var start = match.Index + leading;
        var end = match.Index + raw.Length - trailing;
        return new ParagraphSlice(raw.Trim(), start, end);
    }

    private static void UpdateHeadingStack(List<HeadingNode> stack, HeadingInfo heading)
    {
        while (stack.Count >= heading.Level)
        {
            stack.RemoveAt(stack.Count - 1);
        }

        stack.Add(new HeadingNode(heading.Level, NormalizeInline(heading.Text) ?? string.Empty));
    }

    private static string? BuildTitlePath(IReadOnlyList<HeadingNode> stack)
        => stack.Count == 0 ? null : string.Join(" > ", stack.Select(item => item.Text));

    private static bool TryParseHeading(string paragraph, out HeadingInfo? heading)
    {
        var content = paragraph.Trim();
        var markdown = MarkdownHeadingRegex().Match(content);
        if (markdown.Success)
        {
            heading = new HeadingInfo(markdown.Groups[1].Value.Length, markdown.Groups[2].Value.Trim());
            return true;
        }

        var chinese = ChineseHeadingRegex().Match(content);
        if (chinese.Success)
        {
            heading = new HeadingInfo(MapChineseHeadingLevel(chinese.Groups[2].Value), content);
            return true;
        }

        var numbered = NumberedHeadingRegex().Match(content);
        if (numbered.Success)
        {
            var level = numbered.Groups[1].Value.Count(ch => ch == '.') + 1;
            heading = new HeadingInfo(level, content);
            return true;
        }

        heading = null;
        return false;
    }

    private static int MapChineseHeadingLevel(string marker) => marker switch
    {
        "章" or "篇" or "部分" => 1,
        "节" => 2,
        _ => 3
    };

    private static string Normalize(string text)
        => MultipleBlankLinesRegex().Replace(text.Replace("\r\n", "\n").Replace('\r', '\n').Trim(), "\n\n");

    private static string NormalizeInline(string? text)
        => string.IsNullOrWhiteSpace(text) ? string.Empty : InlineWhitespaceRegex().Replace(text.Trim(), " ");

    private static string NormalizeToken(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return string.Empty;
        var value = token.Trim().ToLowerInvariant();
        value = TokenTrimRegex().Replace(value, string.Empty);
        return value;
    }

    private static void EnsureJiebaResources(params string[] roots)
    {
        var assembly = typeof(JiebaSegmenter).Assembly;
        var resources = assembly.GetManifestResourceNames()
            .Where(name => name.StartsWith("JiebaNet.Segmenter.Resources.", StringComparison.Ordinal))
            .ToList();

        foreach (var root in roots.Where(path => !string.IsNullOrWhiteSpace(path)).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var directory = Path.Combine(root, "Resources");
            Directory.CreateDirectory(directory);

            foreach (var resourceName in resources)
            {
                var fileName = resourceName["JiebaNet.Segmenter.Resources.".Length..];
                var path = Path.Combine(directory, fileName);
                if (File.Exists(path) && new FileInfo(path).Length > 0)
                {
                    continue;
                }

                using var stream = assembly.GetManifestResourceStream(resourceName);
                if (stream is null)
                {
                    continue;
                }

                using var file = File.Create(path);
                stream.CopyTo(file);
            }
        }
    }

    private static string StripHtml(string html)
        => System.Net.WebUtility.HtmlDecode(HtmlTagRegex().Replace(ScriptStyleRegex().Replace(html, " "), " "));

    private static string DecodeDelimiter(string? delimiter)
        => string.IsNullOrWhiteSpace(delimiter) ? "\n\n" : delimiter.Replace("\\r", "\r").Replace("\\n", "\n").Replace("\\t", "\t");

    private static async Task<string> ParseDocxAsync(string path, CancellationToken ct)
    {
        await using var stream = File.OpenRead(path);
        using var zip = new ZipArchive(stream, ZipArchiveMode.Read);
        var entry = zip.GetEntry("word/document.xml") ?? throw new InvalidDataException("Invalid DOCX document.");
        await using var xmlStream = entry.Open();
        var document = await XDocument.LoadAsync(xmlStream, LoadOptions.None, ct);
        XNamespace w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
        return string.Join("\n\n", document.Descendants(w + "p").Select(p => string.Concat(p.Descendants(w + "t").Select(t => t.Value))));
    }

    [GeneratedRegex(@"(?is)<(script|style).*?>.*?</\1>")]
    private static partial Regex ScriptStyleRegex();

    [GeneratedRegex(@"(?s)<[^>]+>")]
    private static partial Regex HtmlTagRegex();

    [GeneratedRegex(@"\n\s*\n(?:\s*\n)+")]
    private static partial Regex MultipleBlankLinesRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex InlineWhitespaceRegex();

    [GeneratedRegex(@"(?ms)\S.*?(?:(?:\n\s*\n)|\z)")]
    private static partial Regex ParagraphBlockRegex();

    [GeneratedRegex(@"^(#{1,6})\s*(.+?)\s*$")]
    private static partial Regex MarkdownHeadingRegex();

    [GeneratedRegex(@"^(第[一二三四五六七八九十百千万0-9]+)(章|节|部分|篇|条)\s*(.+)?$")]
    private static partial Regex ChineseHeadingRegex();

    [GeneratedRegex(@"^([0-9]{1,3}(?:\.[0-9]{1,3}){0,5})[、.\s]+(.+)$")]
    private static partial Regex NumberedHeadingRegex();

    [GeneratedRegex(@"(?m)^(?:#{1,6}\s+|第.{1,30}[章节篇部条])(.+)$")]
    private static partial Regex LegacyHeadingRegex();

    [GeneratedRegex(@"^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$")]
    private static partial Regex TokenTrimRegex();

    private sealed record ParagraphSlice(string Text, int Start, int End);
    private sealed record HeadingInfo(int Level, string Text);
    private sealed record HeadingNode(int Level, string Text);
}
