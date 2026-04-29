import { readCodexStatus } from "@/lib/codex/appServer";
import { jsonOk } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return jsonOk(await readCodexStatus());
}
