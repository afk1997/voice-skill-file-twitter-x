# Codex Local Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Codex Local provider that lets a local Spool instance use the user's ChatGPT-managed Codex sign-in for analysis and draft generation.

**Architecture:** Add `codex-local` as a first-class provider, then bridge the Next server to `codex app-server` over stdio JSON-RPC. The browser only talks to safe Next API routes for status/login/logout; all ChatGPT/Codex token handling stays inside Codex. Generation uses Codex thread/turn APIs and returns plain text into Spool's existing JSON parsing and repair flow.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest, Node `child_process` + `readline`, Codex app-server JSON-RPC over stdio.

---

## References

- Spec: `docs/superpowers/specs/2026-04-29-codex-local-provider-design.md`
- OpenAI Codex App Server docs: https://developers.openai.com/codex/app-server
- Relevant protocol methods: `initialize`, `initialized`, `account/read`, `account/login/start`, `account/login/cancel`, `account/logout`, `account/rateLimits/read`, `thread/start`, `turn/start`, `thread/unsubscribe`

## Current Worktree Note

At plan time, the worktree also has uncommitted homepage copy/layout edits in:
- `app/page.tsx`
- `app/layout.tsx`

Do not stage, revert, or rewrite those files while implementing Codex Local unless the user explicitly asks. Codex Local work should stage only the files named in each task.

## File Structure

Create:
- `lib/codex/jsonRpc.ts` - small JSON-RPC peer that sends newline-delimited JSON, tracks pending request IDs, handles notifications, and supports test injection.
- `lib/codex/appServer.ts` - server-only singleton that starts `codex app-server`, initializes it, exposes auth/status helpers, and runs text generation turns.
- `components/settings/CodexLocalPanel.tsx` - client UI for Codex Local status, device-code login, refresh, cancel, and logout.
- `app/api/codex/status/route.ts` - local status endpoint.
- `app/api/codex/login/start/route.ts` - starts ChatGPT device-code login.
- `app/api/codex/login/cancel/route.ts` - cancels pending device-code login.
- `app/api/codex/logout/route.ts` - logs out of the local Codex account.
- `tests/codex/jsonRpc.test.ts` - request/response/notification tests for the JSON-RPC peer.
- `tests/codex/appServer.test.ts` - sanitization and prompt-wrapper tests for Codex bridge helpers.
- `tests/codex/apiRoutes.test.ts` - API route tests with mocked bridge.
- `tests/llm/codexLocalClient.test.ts` - LLM client tests proving Codex Local uses the bridge and JSON repair path.

Modify:
- `lib/types.ts` - add `codex-local` provider type.
- `lib/request.ts` - preserve `codex-local` config fields.
- `lib/llm/providerMode.ts` - default Codex model and mode copy.
- `lib/llm/embeddings.ts` - make Codex Local explicitly non-embedding-capable.
- `lib/llm/client.ts` - route text generation and repair calls through Codex Local.
- `components/settings/ProviderSettingsForm.tsx` - add provider option and render `CodexLocalPanel`.
- `tests/request.test.ts`, `tests/llm/providerMode.test.ts`, `tests/llm/embeddings.test.ts` - provider foundation coverage.

---

### Task 0: Protect Existing Homepage Edits

**Files:**
- Inspect only: `app/page.tsx`
- Inspect only: `app/layout.tsx`

- [ ] **Step 1: Confirm current uncommitted files**

Run: `git status --short`

Expected: `app/page.tsx` and `app/layout.tsx` may appear as modified. They are not part of Codex Local.

- [ ] **Step 2: Keep staging scoped**

For every commit in this plan, run `git diff --cached --name-only` before committing.

Expected: no Codex Local commit stages `app/page.tsx` or `app/layout.tsx`.

---

### Task 1: Add Codex Local To Provider Foundation

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/request.ts`
- Modify: `lib/llm/providerMode.ts`
- Modify: `lib/llm/embeddings.ts`
- Modify: `components/settings/ProviderSettingsForm.tsx`
- Test: `tests/request.test.ts`
- Test: `tests/llm/providerMode.test.ts`
- Test: `tests/llm/embeddings.test.ts`

- [ ] **Step 1: Write provider foundation tests**

Add to `tests/request.test.ts`:

```ts
it("preserves Codex Local provider config without requiring browser credentials", () => {
  expect(
    providerConfigFromBody({
      providerConfig: {
        provider: "codex-local",
        model: "gpt-5.4",
        apiKey: "ignored-browser-key",
        baseUrl: "http://localhost:9999",
        embeddingModel: "ignored-embedding-model",
      },
    }),
  ).toEqual({
    provider: "codex-local",
    apiKey: undefined,
    model: "gpt-5.4",
    embeddingModel: undefined,
    baseUrl: undefined,
    contextWindowTokens: undefined,
  });
});
```

Add to `tests/llm/providerMode.test.ts`:

```ts
it("labels Codex Local as a local provider without a browser API key", () => {
  expect(defaultModelForProvider("codex-local")).toBe("gpt-5.4");
  expect(providerModeForConfig({ provider: "codex-local" })).toEqual({
    label: "Codex Local",
    description: "Uses your local Codex ChatGPT sign-in. Requires this app to run on your machine.",
    isQualityMode: false,
    isLocalDraftMode: true,
  });
});
```

Add to `tests/llm/embeddings.test.ts`:

```ts
expect(hasUsableEmbeddingProvider({ provider: "codex-local" })).toBe(false);
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- tests/request.test.ts tests/llm/providerMode.test.ts tests/llm/embeddings.test.ts`

Expected: TypeScript/test failures mentioning `"codex-local"` is not assignable or Codex mode is not implemented.

- [ ] **Step 3: Add `codex-local` to shared types**

Change `lib/types.ts`:

```ts
export type ProviderName = "anthropic" | "openai" | "openrouter" | "openai-compatible" | "codex-local";
```

- [ ] **Step 4: Sanitize Codex Local provider config**

Change `providerConfigFromBody()` in `lib/request.ts` so browser-supplied keys and endpoint fields are discarded for Codex Local:

```ts
export function providerConfigFromBody(body: { providerConfig?: LlmProviderConfig }): LlmProviderConfig {
  const supplied = body.providerConfig ?? {};
  const contextWindowTokens = Number(supplied.contextWindowTokens);

  if (supplied.provider === "codex-local") {
    return {
      provider: "codex-local",
      model: supplied.model,
      contextWindowTokens: Number.isFinite(contextWindowTokens) && contextWindowTokens > 0 ? contextWindowTokens : undefined,
    };
  }

  return {
    provider: supplied.provider,
    apiKey: supplied.apiKey,
    model: supplied.model,
    embeddingModel: supplied.embeddingModel,
    baseUrl: supplied.baseUrl,
    contextWindowTokens: Number.isFinite(contextWindowTokens) && contextWindowTokens > 0 ? contextWindowTokens : undefined,
  };
}
```

- [ ] **Step 5: Update provider mode**

Change `ProviderMode["label"]` in `lib/llm/providerMode.ts`:

```ts
label: "Setup Required" | "Quality" | "Alternate" | "Local Draft" | "Codex Local";
```

Change `defaultModelForProvider()`:

```ts
if (provider === "codex-local") return "gpt-5.4";
```

Add this branch near the top of `providerModeForConfig()`, before the missing-key branch:

```ts
if (config.provider === "codex-local") {
  return {
    label: "Codex Local",
    description: "Uses your local Codex ChatGPT sign-in. Requires this app to run on your machine.",
    isQualityMode: false,
    isLocalDraftMode: true,
  };
}
```

- [ ] **Step 6: Make embeddings explicitly reject Codex Local**

In `lib/llm/embeddings.ts`, make the resolver exhaustive for current embedding-capable providers:

```ts
function resolveEmbeddingProvider(config: LlmProviderConfig): ProviderName | undefined {
  if (config.provider === "openai" || config.provider === "openai-compatible") return config.provider;
  if (config.provider === "codex-local") return undefined;
  return embeddingProviderFromEnv();
}
```

- [ ] **Step 7: Add Codex Local to the settings provider select**

In `components/settings/ProviderSettingsForm.tsx`, add:

```ts
{ value: "codex-local", label: "Codex Local" },
```

Leave `DEFAULT_CONFIG.provider` as `"anthropic"`. Do not make Codex Local the default provider.

- [ ] **Step 8: Run focused tests**

Run: `npm test -- tests/request.test.ts tests/llm/providerMode.test.ts tests/llm/embeddings.test.ts`

Expected: all focused tests pass.

- [ ] **Step 9: Commit provider foundation**

Run:

```bash
git add lib/types.ts lib/request.ts lib/llm/providerMode.ts lib/llm/embeddings.ts components/settings/ProviderSettingsForm.tsx tests/request.test.ts tests/llm/providerMode.test.ts tests/llm/embeddings.test.ts
git diff --cached --name-only
git commit -m "feat: add codex local provider foundation"
```

Expected staged files: only the files listed in this task.

---

### Task 2: Build The JSON-RPC Peer

**Files:**
- Create: `lib/codex/jsonRpc.ts`
- Test: `tests/codex/jsonRpc.test.ts`

- [ ] **Step 1: Write JSON-RPC peer tests**

Create `tests/codex/jsonRpc.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { CodexJsonRpcPeer } from "@/lib/codex/jsonRpc";

describe("CodexJsonRpcPeer", () => {
  it("sends requests with ids and resolves matching responses", async () => {
    const writes: string[] = [];
    const peer = new CodexJsonRpcPeer({ write: (line) => writes.push(line), timeoutMs: 1000 });

    const pending = peer.request("account/read", { refreshToken: false });
    expect(JSON.parse(writes[0])).toEqual({
      method: "account/read",
      id: 1,
      params: { refreshToken: false },
    });

    peer.handleLine(JSON.stringify({ id: 1, result: { account: null } }));
    await expect(pending).resolves.toEqual({ account: null });
  });

  it("rejects matching error responses", async () => {
    const peer = new CodexJsonRpcPeer({ write: vi.fn(), timeoutMs: 1000 });
    const pending = peer.request("account/rateLimits/read");

    peer.handleLine(JSON.stringify({ id: 1, error: { code: -32000, message: "Not signed in" } }));

    await expect(pending).rejects.toThrow("Not signed in");
  });

  it("delivers notifications to listeners", () => {
    const peer = new CodexJsonRpcPeer({ write: vi.fn(), timeoutMs: 1000 });
    const handler = vi.fn();
    const unsubscribe = peer.onNotification("account/updated", handler);

    peer.handleLine(JSON.stringify({ method: "account/updated", params: { authMode: "chatgpt", planType: "plus" } }));
    unsubscribe();
    peer.handleLine(JSON.stringify({ method: "account/updated", params: { authMode: null, planType: null } }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ authMode: "chatgpt", planType: "plus" });
  });

  it("rejects pending requests when closed", async () => {
    const peer = new CodexJsonRpcPeer({ write: vi.fn(), timeoutMs: 1000 });
    const pending = peer.request("thread/start");

    peer.close(new Error("codex app-server exited"));

    await expect(pending).rejects.toThrow("codex app-server exited");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/codex/jsonRpc.test.ts`

Expected: FAIL because `lib/codex/jsonRpc.ts` does not exist.

- [ ] **Step 3: Implement the JSON-RPC peer**

Create `lib/codex/jsonRpc.ts`:

```ts
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
```

- [ ] **Step 4: Run JSON-RPC tests**

Run: `npm test -- tests/codex/jsonRpc.test.ts`

Expected: all JSON-RPC tests pass.

- [ ] **Step 5: Commit JSON-RPC peer**

Run:

```bash
git add lib/codex/jsonRpc.ts tests/codex/jsonRpc.test.ts
git diff --cached --name-only
git commit -m "feat: add codex json rpc peer"
```

Expected staged files: `lib/codex/jsonRpc.ts`, `tests/codex/jsonRpc.test.ts`.

---

### Task 3: Build Codex App-Server Bridge

**Files:**
- Create: `lib/codex/appServer.ts`
- Test: `tests/codex/appServer.test.ts`

- [ ] **Step 1: Write bridge helper tests**

Create `tests/codex/appServer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCodexPrompt, sanitizeAccountRead, sanitizeRateLimits } from "@/lib/codex/appServer";

describe("Codex app-server bridge helpers", () => {
  it("sanitizes ChatGPT account data without exposing tokens", () => {
    expect(
      sanitizeAccountRead({
        account: {
          type: "chatgpt",
          email: "user@example.com",
          planType: "plus",
          accessToken: "secret",
        },
        requiresOpenaiAuth: true,
      }),
    ).toEqual({
      connected: true,
      requiresOpenaiAuth: true,
      account: {
        type: "chatgpt",
        email: "user@example.com",
        planType: "plus",
      },
    });
  });

  it("sanitizes disconnected account state", () => {
    expect(sanitizeAccountRead({ account: null, requiresOpenaiAuth: true })).toEqual({
      connected: false,
      requiresOpenaiAuth: true,
      account: null,
    });
  });

  it("sanitizes primary rate-limit data", () => {
    expect(
      sanitizeRateLimits({
        rateLimits: {
          limitId: "codex",
          primary: { usedPercent: 42, windowDurationMins: 15, resetsAt: 1730947200 },
          rateLimitReachedType: null,
        },
      }),
    ).toEqual({
      limitId: "codex",
      usedPercent: 42,
      windowDurationMins: 15,
      resetsAt: 1730947200,
      rateLimitReachedType: null,
    });
  });

  it("wraps prompts so Codex returns content only", () => {
    expect(buildCodexPrompt("Return {\"ok\":true}.")).toContain("Return only the final answer text");
    expect(buildCodexPrompt("Return {\"ok\":true}.")).toContain("Do not edit files");
    expect(buildCodexPrompt("Return {\"ok\":true}.")).toContain("Return {\"ok\":true}.");
  });
});
```

- [ ] **Step 2: Run bridge helper tests to verify they fail**

Run: `npm test -- tests/codex/appServer.test.ts`

Expected: FAIL because `lib/codex/appServer.ts` does not exist.

- [ ] **Step 3: Implement bridge types, sanitizers, and prompt wrapper**

Create `lib/codex/appServer.ts` with these exported helpers first:

```ts
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
```

- [ ] **Step 4: Implement process startup and initialization**

In the same file, add the singleton connection:

```ts
type CodexConnection = {
  process: ChildProcessWithoutNullStreams;
  peer: CodexJsonRpcPeer;
  initialized: Promise<void>;
};

let connection: CodexConnection | undefined;

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
```

- [ ] **Step 5: Implement auth/status helpers**

Add:

```ts
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
```

- [ ] **Step 6: Implement generation helper**

Add:

```ts
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
  const threadResult = (await current.peer.request("thread/start", { model })) as { thread?: { id?: string } };
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
      let cleanup = () => undefined;
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
```

- [ ] **Step 7: Run bridge tests**

Run: `npm test -- tests/codex/appServer.test.ts`

Expected: all bridge helper tests pass.

- [ ] **Step 8: Commit app-server bridge**

Run:

```bash
git add lib/codex/appServer.ts tests/codex/appServer.test.ts
git diff --cached --name-only
git commit -m "feat: add codex app server bridge"
```

Expected staged files: `lib/codex/appServer.ts`, `tests/codex/appServer.test.ts`.

---

### Task 4: Add Codex Local API Routes

**Files:**
- Create: `app/api/codex/status/route.ts`
- Create: `app/api/codex/login/start/route.ts`
- Create: `app/api/codex/login/cancel/route.ts`
- Create: `app/api/codex/logout/route.ts`
- Test: `tests/codex/apiRoutes.test.ts`

- [ ] **Step 1: Write route tests with mocked bridge**

Create `tests/codex/apiRoutes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({
  readCodexStatus: vi.fn(),
  startCodexDeviceLogin: vi.fn(),
  cancelCodexLogin: vi.fn(),
  logoutCodex: vi.fn(),
}));

vi.mock("@/lib/codex/appServer", () => bridge);

describe("Codex Local API routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns sanitized status", async () => {
    bridge.readCodexStatus.mockResolvedValue({
      available: true,
      connected: true,
      account: { type: "chatgpt", email: "user@example.com", planType: "plus" },
      rateLimits: { limitId: "codex", usedPercent: 10 },
    });

    const { GET } = await import("@/app/api/codex/status/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ connected: true, account: { email: "user@example.com" } });
  });

  it("starts device-code login", async () => {
    bridge.startCodexDeviceLogin.mockResolvedValue({
      type: "chatgptDeviceCode",
      loginId: "login-1",
      verificationUrl: "https://auth.openai.com/codex/device",
      userCode: "ABCD-1234",
    });

    const { POST } = await import("@/app/api/codex/login/start/route");
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ loginId: "login-1", userCode: "ABCD-1234" });
  });

  it("requires loginId when canceling login", async () => {
    const { POST } = await import("@/app/api/codex/login/cancel/route");
    const response = await POST(new Request("http://localhost/api/codex/login/cancel", { method: "POST", body: "{}" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "loginId is required." });
  });

  it("logs out", async () => {
    bridge.logoutCodex.mockResolvedValue({});

    const { POST } = await import("@/app/api/codex/logout/route");
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run route tests to verify they fail**

Run: `npm test -- tests/codex/apiRoutes.test.ts`

Expected: FAIL because the routes do not exist.

- [ ] **Step 3: Add status route**

Create `app/api/codex/status/route.ts`:

```ts
import { readCodexStatus } from "@/lib/codex/appServer";
import { jsonOk } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return jsonOk(await readCodexStatus());
}
```

- [ ] **Step 4: Add login start route**

Create `app/api/codex/login/start/route.ts`:

```ts
import { startCodexDeviceLogin } from "@/lib/codex/appServer";
import { jsonErrorFromUnknown, jsonOk } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return jsonOk(await startCodexDeviceLogin());
  } catch (error) {
    return jsonErrorFromUnknown(error, "Could not start Codex Local login.", 502);
  }
}
```

- [ ] **Step 5: Add login cancel route**

Create `app/api/codex/login/cancel/route.ts`:

```ts
import { cancelCodexLogin } from "@/lib/codex/appServer";
import { jsonError, jsonErrorFromUnknown, jsonOk } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { loginId?: unknown };
    if (typeof body.loginId !== "string" || body.loginId.length === 0) return jsonError("loginId is required.", 400);
    await cancelCodexLogin(body.loginId);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonErrorFromUnknown(error, "Could not cancel Codex Local login.", 502);
  }
}
```

- [ ] **Step 6: Add logout route**

Create `app/api/codex/logout/route.ts`:

```ts
import { logoutCodex } from "@/lib/codex/appServer";
import { jsonErrorFromUnknown, jsonOk } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await logoutCodex();
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonErrorFromUnknown(error, "Could not log out of Codex Local.", 502);
  }
}
```

- [ ] **Step 7: Run route tests**

Run: `npm test -- tests/codex/apiRoutes.test.ts`

Expected: all route tests pass.

- [ ] **Step 8: Commit API routes**

Run:

```bash
git add app/api/codex/status/route.ts app/api/codex/login/start/route.ts app/api/codex/login/cancel/route.ts app/api/codex/logout/route.ts tests/codex/apiRoutes.test.ts
git diff --cached --name-only
git commit -m "feat: add codex local api routes"
```

Expected staged files: only the route files and route test.

---

### Task 5: Add Codex Local Settings UI

**Files:**
- Create: `components/settings/CodexLocalPanel.tsx`
- Modify: `components/settings/ProviderSettingsForm.tsx`

- [ ] **Step 1: Create CodexLocalPanel**

Create `components/settings/CodexLocalPanel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { readApiJson } from "@/lib/http/readApiJson";

type CodexStatus = {
  available: boolean;
  connected: boolean;
  account: {
    type: string;
    email?: string;
    planType?: string | null;
  } | null;
  rateLimits?: {
    limitId?: string;
    usedPercent?: number;
    windowDurationMins?: number;
    resetsAt?: number;
    rateLimitReachedType?: string | null;
  } | null;
  error?: string;
};

type LoginState = {
  loginId: string;
  verificationUrl: string;
  userCode: string;
};

function formatReset(seconds?: number) {
  if (!seconds) return "";
  return new Date(seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function CodexLocalPanel() {
  const [status, setStatus] = useState<CodexStatus | null>(null);
  const [login, setLogin] = useState<LoginState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refreshStatus() {
    const response = await fetch("/api/codex/status", { cache: "no-store" });
    const json = await readApiJson<CodexStatus & { error?: string }>(response);
    setStatus(json);
    if (json.connected) setLogin(null);
  }

  useEffect(() => {
    refreshStatus().catch((nextError) => setError(nextError instanceof Error ? nextError.message : "Could not read Codex Local status."));
  }, []);

  useEffect(() => {
    if (!login) return;
    const id = window.setInterval(() => {
      refreshStatus().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(id);
  }, [login]);

  async function startLogin() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/codex/login/start", { method: "POST" });
      const json = await readApiJson<LoginState & { error?: string }>(response);
      setLogin(json);
      await refreshStatus();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not start Codex Local login.");
    } finally {
      setLoading(false);
    }
  }

  async function cancelLogin() {
    if (!login) return;
    setLoading(true);
    setError("");
    try {
      await fetch("/api/codex/login/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loginId: login.loginId }),
      });
      setLogin(null);
      await refreshStatus();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not cancel Codex Local login.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);
    setError("");
    try {
      await fetch("/api/codex/logout", { method: "POST" });
      setLogin(null);
      await refreshStatus();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not log out of Codex Local.");
    } finally {
      setLoading(false);
    }
  }

  const rateLimit = status?.rateLimits;

  return (
    <section className="space-y-4 spool-plate-soft p-4">
      <div>
        <p className="text-sm font-semibold text-ink">Codex Local</p>
        <p className="mt-1 text-sm text-muted">Uses your local Codex ChatGPT sign-in. Nothing here stores ChatGPT tokens in Spool.</p>
      </div>

      {status ? (
        <div className="space-y-2 text-sm text-muted">
          <p>
            Status: <span className="font-semibold text-ink">{status.connected ? "Connected" : status.available ? "Ready to connect" : "Unavailable"}</span>
          </p>
          {status.account?.email ? <p>Account: {status.account.email}</p> : null}
          {status.account?.planType ? <p>Plan: {status.account.planType}</p> : null}
          {rateLimit?.usedPercent !== undefined ? (
            <p>
              Codex usage: {rateLimit.usedPercent}% used{rateLimit.resetsAt ? `, resets around ${formatReset(rateLimit.resetsAt)}` : ""}
            </p>
          ) : null}
          {status.error ? <p className="text-weak">{status.error}</p> : null}
        </div>
      ) : (
        <p className="text-sm text-muted">Checking Codex Local...</p>
      )}

      {login ? (
        <div className="space-y-3 border-[1.5px] border-ink bg-light p-3">
          <p className="text-sm font-semibold text-ink">Finish sign-in</p>
          <p className="text-sm text-muted">Open the verification page and enter this code.</p>
          <a href={login.verificationUrl} target="_blank" rel="noreferrer" className="spool-button-secondary">
            Open verification page
          </a>
          <p className="font-mono text-lg font-semibold text-ink">{login.userCode}</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-weak">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {!status?.connected && !login ? (
          <button type="button" className="spool-button" onClick={startLogin} disabled={loading}>
            {loading ? "Starting..." : "Start ChatGPT login"}
          </button>
        ) : null}
        {login ? (
          <button type="button" className="spool-button-secondary" onClick={cancelLogin} disabled={loading}>
            Cancel login
          </button>
        ) : null}
        {status?.connected ? (
          <button type="button" className="spool-button-secondary" onClick={logout} disabled={loading}>
            Logout
          </button>
        ) : null}
        <button type="button" className="spool-button-secondary" onClick={() => refreshStatus()} disabled={loading}>
          Refresh status
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Render the panel for Codex Local**

In `components/settings/ProviderSettingsForm.tsx`, import:

```ts
import { CodexLocalPanel } from "@/components/settings/CodexLocalPanel";
```

Render after the provider label:

```tsx
{config.provider === "codex-local" ? <CodexLocalPanel /> : null}
```

- [ ] **Step 3: Hide irrelevant credential fields for Codex Local**

Wrap the existing model/base URL/context/embedding/API key fields in conditionals:

```tsx
{config.provider !== "codex-local" ? (
  <>
    {/* existing Base URL, Context window tokens, Embedding model, API key labels stay here */}
  </>
) : null}
```

Keep the model field visible for Codex Local, but update its helper text:

```tsx
{config.provider === "codex-local" ? (
  <span className="text-xs text-muted">Defaults to gpt-5.4 through your local Codex app-server.</span>
) : config.provider === "anthropic" ? (
  <span className="text-xs text-muted">Recommended quality model: claude-sonnet-4-6.</span>
) : null}
```

- [ ] **Step 4: Run type/build checks for settings UI**

Run: `npm run build`

Expected: build completes without TypeScript errors.

- [ ] **Step 5: Commit settings UI**

Run:

```bash
git add components/settings/CodexLocalPanel.tsx components/settings/ProviderSettingsForm.tsx
git diff --cached --name-only
git commit -m "feat: add codex local settings"
```

Expected staged files: the panel and settings form only.

---

### Task 6: Route LLM Generation Through Codex Local

**Files:**
- Modify: `lib/llm/client.ts`
- Test: `tests/llm/codexLocalClient.test.ts`

- [ ] **Step 1: Write Codex Local LLM client tests**

Create `tests/llm/codexLocalClient.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

const codexBridge = vi.hoisted(() => ({
  generateTextWithCodex: vi.fn(),
}));

vi.mock("@/lib/codex/appServer", () => codexBridge);

describe("Codex Local LLM client", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("routes JSON generation through Codex Local without requiring an API key", async () => {
    codexBridge.generateTextWithCodex.mockResolvedValue("{\"ok\":true}");
    const { generateJsonWithLlm, hasUsableProvider } = await import("@/lib/llm/client");

    expect(hasUsableProvider({ provider: "codex-local" })).toBe(true);
    await expect(
      generateJsonWithLlm<{ ok: boolean }>({
        providerConfig: { provider: "codex-local" },
        prompt: "Return JSON.",
      }),
    ).resolves.toEqual({ ok: true });

    expect(codexBridge.generateTextWithCodex).toHaveBeenCalledWith({
      prompt: "Return JSON.",
      model: "gpt-5.4",
    });
  });

  it("uses Codex Local for JSON repair follow-up calls", async () => {
    codexBridge.generateTextWithCodex
      .mockResolvedValueOnce("{\"ok\": true\n\"items\": []}")
      .mockResolvedValueOnce("{\"ok\":true,\"items\":[]}");
    const { generateJsonWithLlm } = await import("@/lib/llm/client");

    await expect(
      generateJsonWithLlm<{ ok: boolean; items: string[] }>({
        providerConfig: { provider: "codex-local", model: "gpt-5.5" },
        prompt: "Return JSON.",
      }),
    ).resolves.toEqual({ ok: true, items: [] });

    expect(codexBridge.generateTextWithCodex).toHaveBeenCalledTimes(2);
    expect(codexBridge.generateTextWithCodex).toHaveBeenLastCalledWith(
      expect.objectContaining({
        model: "gpt-5.5",
      }),
    );
  });
});
```

- [ ] **Step 2: Run client tests to verify they fail**

Run: `npm test -- tests/llm/codexLocalClient.test.ts`

Expected: FAIL because `lib/llm/client.ts` does not route Codex Local yet.

- [ ] **Step 3: Import the Codex bridge**

At the top of `lib/llm/client.ts`, add:

```ts
import { generateTextWithCodex } from "@/lib/codex/appServer";
```

- [ ] **Step 4: Resolve Codex Local as a provider without API keys**

Update `resolveProvider()`:

```ts
if (config.provider === "codex-local") return "codex-local";
```

Place it before the existing Anthropic/OpenAI/OpenRouter/OpenAI-compatible branch.

Update `hasUsableProvider()`:

```ts
export function hasUsableProvider(config: LlmProviderConfig) {
  const provider = resolveProvider(config);
  if (provider === "codex-local") return true;
  return Boolean(provider && (config.apiKey || envKey(provider)));
}
```

- [ ] **Step 5: Branch text generation to Codex Local**

In `generateTextWithLlm()`, add this immediately after resolving the provider and before reading `apiKey`:

```ts
if (provider === "codex-local") {
  return generateTextWithCodex({
    prompt,
    model: providerConfig.model || defaultModelForProvider(provider),
  });
}
```

Keep the existing key-based error for all other providers.

- [ ] **Step 6: Run Codex Local client tests**

Run: `npm test -- tests/llm/codexLocalClient.test.ts tests/llm/client.test.ts`

Expected: Codex Local tests and existing client tests pass.

- [ ] **Step 7: Commit LLM integration**

Run:

```bash
git add lib/llm/client.ts tests/llm/codexLocalClient.test.ts
git diff --cached --name-only
git commit -m "feat: route llm calls through codex local"
```

Expected staged files: `lib/llm/client.ts`, `tests/llm/codexLocalClient.test.ts`.

---

### Task 7: Verify Provider Status Copy In Workflows

**Files:**
- Inspect: `components/studio/TweetStudio.tsx`
- Inspect: `components/voice-report/AnalyzeVoicePanel.tsx`
- No source edits expected.

- [ ] **Step 1: Inspect provider badges**

Run:

```bash
rg -n "providerModeForConfig|mode\\.label|mode\\.description" components/studio/TweetStudio.tsx components/voice-report/AnalyzeVoicePanel.tsx
```

Expected: both components call `providerModeForConfig()` and display `mode.label` / `mode.description`.

- [ ] **Step 2: Confirm shared mode copy is enough**

Expected: `Codex Local` appears automatically after Task 1 because the shared provider mode handles it.

- [ ] **Step 3: Run provider mode tests**

Run: `npm test -- tests/llm/providerMode.test.ts`

Expected: provider mode tests pass and no files are staged.

---

### Task 8: Full Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Run unit tests**

Run: `npm test`

Expected: all Vitest files pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint -- --max-warnings=0`

Expected: no ESLint warnings or errors.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: Next.js build completes successfully.

- [ ] **Step 4: Restart dev server**

If a dev server is already running, stop it with Ctrl-C in its terminal session. Then run:

```bash
npm run dev
```

Expected: local server reports ready at `http://localhost:3000`.

- [ ] **Step 5: Smoke-test local HTTP routes**

Run:

```bash
curl -s -o /tmp/spool-settings.html -w "%{http_code}" http://localhost:3000/settings
curl -s -o /tmp/spool-codex-status.json -w "%{http_code}" http://localhost:3000/api/codex/status
```

Expected:
- `/settings` returns `200`
- `/api/codex/status` returns `200`
- status JSON contains either `available: true` or a friendly `error` string explaining Codex Local is unavailable

- [ ] **Step 6: Browser smoke test**

Use the in-app browser at `http://localhost:3000/settings`.

Expected:
- settings page loads
- provider select includes `Codex Local`
- selecting Codex Local shows the Codex Local panel
- model field remains available
- base URL, embedding model, context window, and API key fields are hidden for Codex Local
- if Codex CLI is unavailable, the panel shows an unavailable message instead of crashing

- [ ] **Step 7: Manual Codex login test when Codex CLI is installed**

Run: `which codex`

If Codex CLI exists, use the settings page:
- select Codex Local
- click Start ChatGPT login
- open verification URL
- enter user code
- refresh status

Expected:
- connected account state appears
- email and plan type appear when app-server returns them
- rate-limit status appears when app-server returns it

- [ ] **Step 8: Manual generation test when connected**

In a brand with an active Skill File:
- select Codex Local in Settings
- open Studio
- generate one draft

Expected:
- generation request reaches Codex Local
- the UI saves and shows at least one generation
- if Codex returns invalid JSON, the repair call runs through Codex Local
- if Codex usage is depleted, the UI shows the rate-limit error from the API response

- [ ] **Step 9: Final git status**

Run: `git status --short`

Expected:
- Codex Local implementation files are clean after commits
- `app/page.tsx` and `app/layout.tsx` may still be modified from the prior homepage copy work
