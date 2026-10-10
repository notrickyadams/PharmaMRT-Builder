import scan1 from "./scan-1.json" with { type: "json" };
import scan2 from "./scan-2.json" with { type: "json" };
import scan3 from "./scan-3.json" with { type: "json" };
import analyze1 from "./analyze-1.json" with { type: "json" };
import analyze2 from "./analyze-2.json" with { type: "json" };
import analyze3 from "./analyze-3.json" with { type: "json" };

const examples = [
  { scan: scan1, analyze: analyze1 },
  { scan: scan2, analyze: analyze2 },
  { scan: scan3, analyze: analyze3 },
] as const;

const nextExample = { scan: 0, analyze: 0 };

// Each endpoint rotates 1 -> 2 -> 3 -> 1 for standalone requests. An analyze
// request with { prescription: { id } } or { prescriptionId } uses the matching
// fictional scan even if requests arrive out of order. ?example=1|2|3 pins a
// pair without advancing the rotation. Uploaded images are never interpreted.
// Rotation is presentation-only, in memory, and resets on a server restart.
export async function demoResponse(request: Request, kind: "scan" | "analyze") {
  const selector = new URL(request.url).searchParams.get("example");
  if (selector !== null && !["1", "2", "3"].includes(selector)) {
    return Response.json({
      ...(kind === "scan" ? { prescription: null } : { problems: null }),
      source: "failed",
      error: "Choose demo example 1, 2, or 3.",
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  let index = selector === null ? nextExample[kind] : Number(selector) - 1;
  if (selector === null && kind === "analyze" &&
    request.headers.get("content-type")?.includes("application/json")) {
    // Only the fictional ID selects a fixture. All clinical input is ignored;
    // invalid JSON simply behaves like a standalone demo request.
    const body: unknown = await request.json().catch(() => null);
    if (typeof body === "object" && body !== null) {
      const prescription = "prescription" in body ? body.prescription : null;
      const id = typeof prescription === "object" && prescription !== null && "id" in prescription
        ? prescription.id : "prescriptionId" in body ? body.prescriptionId : null;
      const matching = examples.findIndex(({ scan }) => scan.prescription.id === id);
      if (matching !== -1) index = matching;
    }
  }
  // Reserve the example before waiting so concurrent requests do not repeat it.
  if (selector === null) nextExample[kind] = (index + 1) % examples.length;
  await new Promise<void>((resolve) => setTimeout(resolve, kind === "scan" ? 5_000 : 3_000));
  return Response.json(examples[index]![kind], {
    headers: { "Cache-Control": "no-store" },
  });
}
