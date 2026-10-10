import { DEMO_MODE } from "@/lib/config";
import { demoResponse } from "@/lib/demo/index";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (DEMO_MODE) return demoResponse(request, "analyze");

  // There is no live analyze implementation yet; do not simulate an AI result.
  return Response.json({
    problems: null,
    source: "failed",
    error: "Live analysis is not implemented. Enable demo mode to use fictional examples.",
  });
}
