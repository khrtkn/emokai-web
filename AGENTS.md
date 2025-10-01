# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Next.js application code organized under `/app` for routes and `/components` for shared UI built from `docs/design-spec.md`.
- `lib/`: client/server helpers for API integration (OpenAI, Nanobanana, Tripo, Supabase) with a subfolder per provider.
- `public/`: static assets, placeholders, and localized JSON copies of legal text.
- `tests/`: Playwright and Jest specs mirroring `src/` paths (e.g., `tests/app/stage/create.spec.ts`).
- `docs/`: product/design references and `development-tasks.md`; update alongside code changes.

## Build, Test, and Development Commands
Use pnpm for consistency:
- `pnpm install` — install dependencies.
- `pnpm dev` — run Next.js locally with API stubs.
- `pnpm lint` — execute ESLint + Prettier check.
- `pnpm test` — run Jest unit suites.
- `pnpm test:e2e` — execute Playwright flows (requires `VERCEL_ENV=preview`).

## Coding Style & Naming Conventions
- TypeScript everywhere; 2-space indent; prefer functional React components.
- Component files: `PascalCase.tsx`; hooks: `useThing.ts` inside `src/hooks/`.
- API handlers live in `src/app/api/<service>/route.ts`; name helper modules `serviceClient.ts`.
- Run `pnpm lint` before committing; prettier config enforces single quotes and trailing commas.

## Testing Guidelines
- Co-locate Jest specs under `__tests__` next to the unit under test.
- Snapshot only for stable UI states; otherwise assert on semantics.
- Target ≥85% coverage for `src/lib/` integrations; add regression tests for every bug fix.
- Playwright specs should cover Step A–G happy paths plus permission-denied branches.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`); scope maps to top-level folder (e.g., `feat(src-app): ...`).
- Keep commits atomic and reference task IDs from `docs/development-tasks.md` where possible.
- PR description must include: summary, testing notes (`pnpm test`, `pnpm lint`), screenshots/GIFs for UI, and linked issue.
- Update `docs/development-tasks.md` checklist immediately after finishing each task so progress stays reliable.
- Request review from engineering + the designer when modifying shared components.

## Security & Configuration Tips
- Store secrets in Vercel project settings; never commit `.env` values.
- Provide `.env.example` with placeholder keys; guard runtime access behind type-safe loaders.
- Log moderation/analytics events without storing IPs beyond hash required for rate limiting.
