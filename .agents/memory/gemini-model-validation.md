---
name: Direct-key Gemini validation
description: How to verify model availability when using the user's own Gemini API key
---

Do not choose a direct-key Gemini model solely from Replit AI Integrations' supported-model list or a successful model metadata lookup. Verify generation through the same credential path, including structured output and an image when scanning is involved.

**Why:** A model metadata lookup succeeded while generation requests failed and stalled the scan connection; another Flash model successfully generated through the same key. Metadata availability alone did not establish that scanning worked.

**How to apply:** Before changing or approving a scan model, test a small fictional prescription with no patient identifiers through the actual scan endpoint. Keep real prescription text and provider error bodies out of diagnostic output.

Set an explicit SDK retry budget rather than adding an outer retry loop without checking SDK defaults.

**Why:** The installed Google SDK defaults to five attempts. Layering another retry loop would multiply upstream requests and extend stalls rather than create a controlled retry policy.

**How to apply:** Inspect the installed SDK's retry options when changing failure handling; count the initial attempt in the budget and keep authentication, quota, and validation failures out of server-error retries.
