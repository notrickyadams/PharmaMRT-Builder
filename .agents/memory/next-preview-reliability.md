---
name: Next.js preview reliability
description: Why persisted development caches are disabled in this workspace.
---

Keep development and production output isolated and generated Next.js caches out of version tracking. Avoid re-enabling persisted Turbopack development caching without checking workspace restore behavior.

**Why:** Persisted task metadata referenced missing cache files in this workspace, causing compiler panics and HTTP 500 responses before the scan handler could run. Generated Next.js output had been tracked as project files.

**How to apply:** When adjusting build or development configuration, preserve output isolation and treat compiler-cache failures separately from scan-handler failures.
