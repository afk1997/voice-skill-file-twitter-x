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
