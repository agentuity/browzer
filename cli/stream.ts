type StreamEvent = {
  type: string;
  [key: string]: unknown;
};

export async function collectDuring<T>(
  port: number | null,
  fn: () => Promise<T>,
  onEvent?: (event: StreamEvent) => void,
): Promise<T> {
  if (!port) return fn();

  const events: StreamEvent[] = [];
  let ws: WebSocket | null = null;
  try {
    ws = await connect(port);
    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as StreamEvent;
        if (msg.type === "frame") return;
        events.push(msg);
        onEvent?.(msg);
      } catch {
        /* ignore */
      }
    });
  } catch {
    ws = null;
  }

  try {
    return await fn();
  } finally {
    await wait(120);
    ws?.close();
    void events;
  }
}

function connect(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/`);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("stream connect timeout"));
    }, 1500);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("stream connect failed"));
    });
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
