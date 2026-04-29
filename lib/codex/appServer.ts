import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";
import { CodexJsonRpcPeer } from "@/lib/codex/jsonRpc";

type CodexAccount = {
  type: "apiKey" | "chatgpt" | "chatgptAuthTokens";
  email?: string;
  planType?: string | null;
};

export type CodexStatus = {
  available: boolean;
  connected: boolean;
  requiresOpenaiAuth?: boolean;
  account: CodexAccount | null;
  rateLimits?: {
    limitId?: string;
    usedPercent?: number;
    windowDurationMins?: number;
    resetsAt?: number;
    rateLimitReachedType?: string | null;
  } | null;
  error?: string;
};

type CodexConnection = {
  process: ChildProcessWithoutNullStreams;
  peer: CodexJsonRpcPeer;
  initialized: Promise<void>;
};

let connection: CodexConnection | undefined;

export function sanitizeAccountRead(value: unknown): Pick<CodexStatus, "connected" | "requiresOpenaiAuth" | "account"> {
  const result = value as { account?: Record<string, unknown> | null; requiresOpenaiAuth?: boolean };
  const account = result.account;
  if (!account) {
    return {
      connected: false,
      requiresOpenaiAuth: Boolean(result.requiresOpenaiAuth),
      account: null,
    };
  }

  const type = String(account.type || "");
  return {
    connected: true,
    requiresOpenaiAuth: Boolean(result.requiresOpenaiAuth),
    account: {
      type: type === "apiKey" || type === "chatgptAuthTokens" ? type : "chatgpt",
      email: typeof account.email === "string" ? account.email : undefined,
      planType: typeof account.planType === "string" ? account.planType : account.planType === null ? null : undefined,
    },
  };
}

export function sanitizeRateLimits(value: unknown): CodexStatus["rateLimits"] {
  const result = value as { rateLimits?: Record<string, unknown> | null };
  const rateLimits = result.rateLimits;
  const primary = rateLimits?.primary as Record<string, unknown> | undefined;
  if (!rateLimits || !primary) return null;

  return {
    limitId: typeof rateLimits.limitId === "string" ? rateLimits.limitId : undefined,
    usedPercent: typeof primary.usedPercent === "number" ? primary.usedPercent : undefined,
    windowDurationMins: typeof primary.windowDurationMins === "number" ? primary.windowDurationMins : undefined,
    resetsAt: typeof primary.resetsAt === "number" ? primary.resetsAt : undefined,
    rateLimitReachedType: typeof rateLimits.rateLimitReachedType === "string" ? rateLimits.rateLimitReachedType : null,
  };
}

export function buildCodexPrompt(prompt: string) {
  return `You are powering Spool's local Codex provider.

Return only the final answer text requested by Spool.
Do not edit files.
Do not run shell commands.
Do not call tools.
Do not include markdown fences unless the user prompt explicitly asks for them.
If the prompt asks for JSON, return parseable JSON only.

Spool request:
${prompt}`;
}

function startConnection(): CodexConnection {
  if (connection) return connection;

  const child = spawn("codex", ["app-server"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const peer = new CodexJsonRpcPeer({
    write: (line) => child.stdin.write(line),
    timeoutMs: 180000,
  });

  readline.createInterface({ input: child.stdout }).on("line", (line) => peer.handleLine(line));

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${String(chunk)}`.slice(-4000);
  });

  child.on("error", (error) => {
    peer.close(error);
    connection = undefined;
  });

  child.on("exit", () => {
    peer.close(new Error(stderr.trim() || "Codex app-server exited."));
    connection = undefined;
  });

  const initialized = (async () => {
    await peer.request("initialize", {
      clientInfo: {
        name: "spool",
        title: "Spool",
        version: "0.1.0",
      },
    });
    peer.notify("initialized", {});
  })();

  connection = { process: child, peer, initialized };
  return connection;
}

async function requestCodex(method: string, params?: unknown) {
  const current = startConnection();
  await current.initialized;
  return current.peer.request(method, params);
}

export async function readCodexStatus(): Promise<CodexStatus> {
  try {
    const account = sanitizeAccountRead(await requestCodex("account/read", { refreshToken: false }));
    let rateLimits: CodexStatus["rateLimits"] = null;

    if (account.connected && account.account?.type === "chatgpt") {
      try {
        rateLimits = sanitizeRateLimits(await requestCodex("account/rateLimits/read"));
      } catch {
        rateLimits = null;
      }
    }

    return { available: true, ...account, rateLimits };
  } catch (error) {
    return {
      available: false,
      connected: false,
      account: null,
      error: error instanceof Error ? error.message : "Codex Local is unavailable.",
    };
  }
}

export async function startCodexDeviceLogin() {
  return requestCodex("account/login/start", { type: "chatgptDeviceCode" });
}

export async function cancelCodexLogin(loginId: string) {
  return requestCodex("account/login/cancel", { loginId });
}

export async function logoutCodex() {
  return requestCodex("account/logout");
}

function textFromItem(item: unknown) {
  const value = item as { type?: string; text?: unknown };
  if (value.type === "agentMessage" && typeof value.text === "string") return value.text;
  return "";
}

export async function generateTextWithCodex({ prompt, model }: { prompt: string; model: string }) {
  const status = await readCodexStatus();
  if (!status.available) throw new Error(status.error || "Codex Local is unavailable.");
  if (!status.connected) throw new Error("Connect ChatGPT through Codex Local in Settings.");
  if (status.rateLimits?.rateLimitReachedType) throw new Error("Codex usage limit reached. Wait for reset or switch provider.");

  const current = startConnection();
  await current.initialized;
  const threadResult = (await current.peer.request("thread/start", { model, serviceName: "spool" })) as { thread?: { id?: string } };
  const threadId = threadResult.thread?.id;
  if (!threadId) throw new Error("Codex app-server did not return a thread id.");

  let finalText = "";
  const unsubscribeDelta = current.peer.onNotification("item/agentMessage/delta", (params) => {
    const delta = params as { delta?: unknown; text?: unknown };
    finalText += typeof delta.delta === "string" ? delta.delta : typeof delta.text === "string" ? delta.text : "";
  });
  const unsubscribeCompleted = current.peer.onNotification("item/completed", (params) => {
    const completed = params as { item?: unknown };
    const itemText = textFromItem(completed.item);
    if (itemText) finalText = itemText;
  });

  try {
    const turnResult = (await current.peer.request("turn/start", {
      threadId,
      input: [{ type: "text", text: buildCodexPrompt(prompt) }],
      model,
      cwd: process.cwd(),
      approvalPolicy: "never",
      sandboxPolicy: { type: "readOnly" },
      outputSchema: { type: "object" },
    })) as { turn?: { id?: string; status?: string } };

    const turnId = turnResult.turn?.id;
    if (!turnId) throw new Error("Codex app-server did not return a turn id.");

    await new Promise<void>((resolve, reject) => {
      let cleanup: () => void = () => undefined;
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Codex Local generation timed out."));
      }, 180000);

      cleanup = current.peer.onNotification("turn/completed", (params) => {
        const turn = (params as { turn?: { id?: string; status?: string; error?: { message?: string } } }).turn;
        if (turn?.id !== turnId) return;
        clearTimeout(timeout);
        cleanup();
        if (turn.status === "failed") reject(new Error(turn.error?.message || "Codex Local generation failed."));
        else if (turn.status === "interrupted") reject(new Error("Codex Local generation was interrupted."));
        else resolve();
      });
    });

    if (!finalText.trim()) throw new Error("Codex Local returned no message content.");
    return finalText.trim();
  } finally {
    unsubscribeDelta();
    unsubscribeCompleted();
    current.peer.request("thread/unsubscribe", { threadId }).catch(() => undefined);
  }
}
