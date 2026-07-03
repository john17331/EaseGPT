(function exposeSseClient(global) {
    async function consume(body, onEvent) {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const frames = buffer.split(/\r?\n\r?\n/);
            buffer = frames.pop() ?? "";

            for (const frame of frames) {
                const event = parse(frame);
                if (event) onEvent(event);
            }
        }

        buffer += decoder.decode();
        if (buffer.trim()) {
            const event = parse(buffer);
            if (event) onEvent(event);
        }
    }

    function parse(frame) {
        let eventName = "";
        const dataLines = [];

        for (const line of frame.split(/\r?\n/)) {
            if (line.startsWith("event:")) {
                eventName = line.slice("event:".length).trim();
            } else if (line.startsWith("data:")) {
                dataLines.push(line.slice("data:".length).trimStart());
            }
        }

        if (dataLines.length === 0) return null;
        const data = JSON.parse(dataLines.join("\n"));
        data.type ||= eventName;
        return data;
    }

    global.EaseGptSse = Object.freeze({ consume, parse });
})(window);
