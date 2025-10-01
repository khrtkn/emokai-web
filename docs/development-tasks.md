# SOFU AR Character Creator – Development Task List

- [x] Project setup: repository structure, lint/test tooling, env handling, i18n scaffolding.
- [x] Design system components: Header, Instruction banner, Divider, Message block, Inputs, Tile grid, Card, Progress bar per `docs/design-spec.md`.
- [x] Step 0 flow: device detection, language toggle, terms consent, session ID generation, permissions notice, moderation pre-checks.
- [x] Stage flow (Step A): text entry with moderation, upload pipeline (camera/library permissions, EXIF strip, resize/WebP, cleanup), Nanobanana stage generation, selection UI.
- [x] Character flow (Step B): description moderation, Nanobanana character outputs, selection UI, progress bar kickoff, session lock.
- [x] Parallel jobs (Step C1–C3): TripoAPI model generation (timeouts, storage), Nanobanana composite, OpenAI narrative with sanitization and status updates.
- [x] Result screens (Step D): narrative view, composite display, AR entry gating, license notice, unload cancellation handling.
- [x] AR & 3D viewer (Step E): WebAR implementation, permission prompts, plane detection guidance, capture/save per OS, fallback viewer.
- [x] Persistence & sharing (Step F): daily limits, asset/metadata persistence, expiring share URLs, share sheet, OGP metadata.
- [x] Gallery (Step G): paginated public grid, detail view with AR/share options, license display, infinite scroll.
- [x] Error & retry framework: localized messaging, retries, partial success handling, cancellation notices, accessible alerts.
- [x] Data lifecycle jobs: temp cleanup after 30 min, 24h session purge, 7-day deletion, Supabase backup integration.
- [x] Analytics & monitoring: GA4 events, completion/drop-off metrics, error logging schema.
- [ ] Testing & QA: unit/integration coverage, mocked external APIs, AR/device compatibility, accessibility, localization validation.
  - Progress 2025-10-01: Added unit tests for lib modules (device detection, moderation flows, generation jobs, share URL, env loader). All unit suites pass (`pnpm test`), lint clean. Coverage report generated; next focus is increasing `src/lib/*` coverage toward 85% and wiring Playwright against a running preview.
- [ ] Deployment & ops: backend functions/background workers, secrets management, CI/CD, performance monitoring.
  - Add GitHub Actions workflow for Vercel preview deploy + Playwright E2E (`.github/workflows/preview-e2e.yml`). Requires `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets set in repo. E2E uses `PLAYWRIGHT_BASE_URL` from the deployed preview URL and runs with `VERCEL_ENV=preview`.
