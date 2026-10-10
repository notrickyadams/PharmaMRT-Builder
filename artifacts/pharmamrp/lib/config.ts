export const GEMINI_MODEL = "gemini-3.8-flash";

export const DEMO_MODE = true;

// Server routes only: deliberately select "personal" to use GEMINI_API_KEY.
// Never switch providers automatically after a managed failure.
export const GEMINI_PROVIDER: "managed" | "personal" = "managed";
