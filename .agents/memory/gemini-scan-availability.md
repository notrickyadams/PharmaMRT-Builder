---
name: Gemini scan availability
description: Distinguishing application validation failures from Gemini generation access and overload failures.
---

A successful Gemini model listing does not establish generation quota or structured-output compatibility. Diagnose with a minimal generation request before changing the model or clinical validation.

**Why:** During scan investigation, model listing succeeded but both plain text and structured generation returned HTTP 503 high-demand rejections. Later, plain generation and a fictional prescription scan returned HTTP 429 with a free-tier quota rejection. These failures occurred before prescription parsing.

**How to apply:** When live generation is blocked, retain the validated prescription contract and report that live success remains unverified. Do not treat mocked successful output as proof of provider access, and do not switch models or relax citation validation to conceal an external rejection.

Keep a single provider attempt within the scan deadline rather than allowing SDK retries to consume it.

**Why:** The SDK defaults to five attempts. The scan returned HTTP 504 after approximately fourteen seconds while single-attempt minimal requests exposed the HTTP 503 rejection in under a second.

**How to apply:** Preserve bounded scan timing and distinguish provider quota, access, availability, timeout, and unusable output using allowlisted diagnostics only. Never log raw provider exception bodies or clinical text.
