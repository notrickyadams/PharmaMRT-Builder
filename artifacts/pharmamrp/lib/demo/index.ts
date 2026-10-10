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

// Both endpoints default to the first pair. Select another matching pair with
// ?example=2 or ?example=3 on both requests. Uploads are deliberately ignored:
// demo data is fictional and is never an interpretation of the supplied image.
export async function demoResponse(request: Request, kind: "scan" | "analyze") {
  const example = new URL(request.url).searchParams.get("example") ?? "1";
  if (!["1", "2", "3"].includes(example)) {
    return Response.json({
      ...(kind === "scan" ? { prescription: null } : { problems: null }),
      source: "failed",
      error: "Choose demo example 1, 2, or 3.",
    });
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 2_000));
  return Response.json(examples[Number(example) - 1]![kind], {
    headers: { "Cache-Control": "no-store" },
  });
}
