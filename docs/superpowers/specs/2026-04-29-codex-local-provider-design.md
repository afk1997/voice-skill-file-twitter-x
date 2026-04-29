# Codex Local Provider Design

## Context

Spool currently treats model providers as a local browser setting. The settings page stores `providerConfig` in `localStorage`, client components send that config to Next API routes, and the server calls `lib/llm/client.ts` to get JSON from Anthropic, OpenAI, OpenRouter, or an OpenAI-compatible endpoint.

OpenAI's Codex app-server is a local JSON-RPC interface for rich Codex clients. It supports ChatGPT-managed auth, account state, rate-limit reads, conversation threads, turns, and streamed agent events. The documented transports are stdio and an experimental WebSocket mode. The auth surface supports ChatGPT browser login and device-code login, and surfaces the current auth mode and plan type.

Source references:
- https://developers.openai.com/codex/app-server
- https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan/

## Goal

Add an optional **Codex Local** provider so a user running Spool locally can sign into ChatGPT through Codex and use their Codex access for Spool's agentic drafting workflow.

This should feel like an advanced local provider, not a hosted SaaS billing shortcut.

## Non-Goals

- Do not use ChatGPT/Codex login as a generic OpenAI API key substitute for hosted Spool.
- Do not store ChatGPT or Codex tokens in Spool's database or browser storage.
- Do not expose Codex app-server directly to the browser.
- Do not rely on the experimental unauthenticated WebSocket transport.
- Do not use Codex for embeddings in v1. Retrieval should fall back to Spool's existing voice-only example selection when no embedding provider is configured.

## User Experience

Settings gains a provider option named **Codex Local**.

When selected, the settings page shows:
- local availability: whether `codex app-server` can start
- account state: disconnected, login pending, connected
- connected account details when available: email and plan type
- Codex usage/rate-limit status when app-server returns it
- actions: Start ChatGPT login, Cancel login, Refresh status, Logout

The login flow should use device-code login for v1:
1. User clicks **Start ChatGPT login**.
2. Spool calls a local Next API route.
3. The route starts `account/login/start` with `type: "chatgptDeviceCode"`.
4. The UI shows the verification URL and user code.
5. The UI polls local status until `account/login/completed` / `account/updated` says the user is connected.

Browser login is out of scope for v1. Device-code login is the v1 flow because it avoids confusion around local callback ports.

In generation and analysis screens, the provider badge should read **Codex Local** with copy like:

> Uses your local Codex ChatGPT sign-in. Requires this app to run on your machine.

## Architecture

### Provider Type

Add a new provider name:

```ts
type ProviderName = "anthropic" | "openai" | "openrouter" | "openai-compatible" | "codex-local";
```

`codex-local` does not use `apiKey`, `baseUrl`, or browser-stored credentials. The selected provider can still be stored in `localStorage`, but auth state remains owned by Codex.

### Local App-Server Bridge

Create a server-only Codex app-server bridge at `lib/codex/appServer.ts`.

Responsibilities:
- lazily spawn `codex app-server` over stdio
- perform the JSON-RPC `initialize` / `initialized` handshake once
- send requests with incrementing IDs
- route responses and notifications
- expose account helpers:
  - `readAccount({ refreshToken })`
  - `startChatGptDeviceLogin()`
  - `cancelLogin(loginId)`
  - `logout()`
  - `readRateLimits()`
- expose generation helper:
  - `generateTextWithCodex({ prompt, model })`

Use stdio, not WebSocket, for v1. This keeps the bridge local to the Next server process and avoids browser-origin/auth pitfalls.

### Next API Routes

Add local-only Codex routes:

- `GET /api/codex/status`
  - returns app-server availability, account, plan type, and rate limits when available
- `POST /api/codex/login/start`
  - starts `chatgptDeviceCode` login and returns `verificationUrl`, `userCode`, and `loginId`
- `POST /api/codex/login/cancel`
  - cancels a pending login
- `POST /api/codex/logout`
  - logs out of Codex locally

Every route should run server-side only and never return raw access tokens.

### LLM Client Integration

`lib/llm/client.ts` should branch before key-based providers:

```ts
if (provider === "codex-local") {
  return generateTextWithCodex({ prompt, model: providerConfig.model || defaultModelForProvider(provider) });
}
```

The Codex prompt wrapper should be strict:

- return only the requested JSON
- do not edit files
- do not run commands
- do not explain the answer
- if data is insufficient, still return the required JSON shape with conservative values

`generateJsonWithLlm` can keep using the existing JSON parse and repair path. If Codex returns invalid JSON, the repair request should also go through Codex when `codex-local` is selected.

### Embeddings And Retrieval

Codex Local does not provide embeddings in v1. Existing behavior already supports this: when `hasUsableEmbeddingProvider()` returns false, Spool uses voice-only selection.

For `codex-local`:
- `hasUsableEmbeddingProvider()` returns false
- no embedding model field is shown by default
- hybrid retrieval is skipped in v1 unless the selected provider is changed to OpenAI/OpenAI-compatible before generation

### Error Handling

Show actionable messages:

- Codex CLI missing: "Install Codex CLI and run Spool locally to use Codex Local."
- Not signed in: "Connect ChatGPT through Codex Local in Settings."
- Rate limit reached: "Codex usage limit reached. Wait for reset or switch provider."
- App-server crashed: "Codex Local stopped unexpectedly. Refresh status or restart the dev server."
- Unsupported hosted environment: "Codex Local only works when this server is running on your machine."

### Security

- Spool never receives or stores ChatGPT tokens directly.
- The browser never connects to Codex app-server.
- The local bridge uses stdio instead of opening a network listener.
- Device login code and account email may be shown in UI; tokens are never shown.
- API routes should avoid logging full JSON-RPC payloads that could include sensitive account data.

## Testing

Unit tests:
- provider normalization accepts `codex-local`
- provider mode labels Codex Local correctly
- request parsing preserves `codex-local`
- embedding availability is false for Codex Local
- app-server JSON-RPC client routes responses to matching request IDs
- login status helpers sanitize returned account data

Integration/manual verification:
- settings loads with Codex Local selected
- missing Codex CLI shows a friendly setup message
- device-code login starts and polls correctly when Codex CLI is installed
- connected state shows email/plan/rate limits
- draft generation can run through Codex Local and create saved generations
- voice analysis can run through Codex Local or fails with a useful message if the model output cannot be parsed
- existing Anthropic/OpenAI/OpenRouter/OpenAI-compatible providers still work

## Rollout

Ship in two implementation phases:

1. **Auth and Settings**
   - add provider option
   - add app-server bridge account methods
   - add `/api/codex/*` auth/status routes
   - show Codex Local connection state in settings

2. **Generation Path**
   - add Codex Local branch to `lib/llm/client.ts`
   - use Codex for JSON generation/repair
   - keep retrieval voice-only unless another embedding provider exists
   - verify analysis, generation, revision, and feedback flows

This keeps the risky auth/control-plane work separate from the model-output path.
