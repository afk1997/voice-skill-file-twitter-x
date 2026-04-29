type JsonRpcError = {
  code?: number;
  message?: string;
  data?: unknown;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type NotificationHandler = (params: unknown) => void;

export class CodexJsonRpcError extends Error {
  code?: number;
  data?: unknown;

  constructor(error: JsonRpcError) {
    super(error.message || "Codex app-server request failed.");
    this.name = "CodexJsonRpcError";
    this.code = error.code;
    this.data = error.data;
  }
}

export class CodexJsonRpcPeer {
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private notificationHandlers = new Map<string, Set<NotificationHandler>>();

  constructor(
    private options: {
      write: (line: string) => void;
      timeoutMs?: number;
    },
  ) {}

  request(method: string, params?: unknown) {
    const id = this.nextId++;
    const timeoutMs = this.options.timeoutMs ?? 120000;
    const message = params === undefined ? { method, id } : { method, id, params };

    const promise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex app-server request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });

    this.options.write(`${JSON.stringify(message)}\n`);
    return promise;
  }

  notify(method: string, params?: unknown) {
    const message = params === undefined ? { method } : { method, params };
    this.options.write(`${JSON.stringify(message)}\n`);
  }

  onNotification(method: string, handler: NotificationHandler) {
    const handlers = this.notificationHandlers.get(method) ?? new Set<NotificationHandler>();
    handlers.add(handler);
    this.notificationHandlers.set(method, handlers);
    return () => handlers.delete(handler);
  }

  handleLine(line: string) {
    if (!line.trim()) return;
    const message = JSON.parse(line) as {
      id?: number;
      result?: unknown;
      error?: JsonRpcError;
      method?: string;
      params?: unknown;
    };

    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new CodexJsonRpcError(message.error));
      else pending.resolve(message.result);
      return;
    }

    if (message.method) {
      const handlers = this.notificationHandlers.get(message.method);
      handlers?.forEach((handler) => handler(message.params));
    }
  }

  close(error = new Error("Codex app-server connection closed.")) {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}
