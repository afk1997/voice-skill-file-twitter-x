import { providerFromEnv } from "@/lib/llm/client";
import { jsonOk } from "@/lib/request";

export async function GET() {
  const provider = providerFromEnv();
  return jsonOk({
    hasServerProvider: Boolean(provider),
    provider,
  });
}
