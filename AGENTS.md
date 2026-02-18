# Repository Guidelines

## Project Structure & Module Organization
- `src/`: library source code. Public exports start at `src/index.ts`; core form logic lives in `src/form.ts`; schema checks are in `src/schema.ts`.
- `tests/`: Vitest test suites (currently `*.test.ts` files, e.g. `tests/form.test.ts`).
- `docs/`: static project assets (for example `docs/logo.png`).
- `.github/workflows/`: CI and release automation (`unit-test.yml`, `release.yml`).
- Build output is generated into `dist/` and published from there.

## Build, Test, and Development Commands
- `pnpm install`: install dependencies.
- `pnpm run dev`: run `tsdown` in watch mode for local library development.
- `pnpm run build`: create production bundle and declarations in `dist/`.
- `pnpm run test`: run Vitest test suites.
- `pnpm run lint`: run Oxlint checks.
- `pnpm run lint:fix`: auto-fix lint issues where possible.
- `pnpm run typecheck`: run strict TypeScript checks without emitting files.

## Coding Style & Naming Conventions
- Language: TypeScript (ES modules).
- Formatting: Prettier (`.prettierrc`), 2-space indentation, double quotes, trailing commas where valid.
- Linting: Oxlint; keep code warning-free before opening a PR.
- Naming:
  - files: lowercase, concise (`form.ts`, `schema.ts`)
  - tests: `*.test.ts`
  - exported APIs: clear verb/noun names (`createForm`, `validateForm`).

## Testing Guidelines
- Framework: Vitest.
- Place tests in `tests/` and mirror the source behavior under test.
- Prefer behavior-focused `describe`/`it` names (e.g., `describe("validateForm")`).
- Run `pnpm run test` locally before pushing.
- No explicit coverage gate is configured; add tests for new behavior and bug fixes.

## Commit & Pull Request Guidelines
- Commit messages are required to follow Conventional Commits (for example: `feat:`, `fix:`, `chore:`, `docs:`, `config:`).
- Keep commit messages imperative and scoped to one logical change.
- PRs should include:
  - concise summary of change and rationale
  - linked issue(s) when applicable
  - test updates for behavior changes
  - notes on any API-impacting changes.
- Ensure CI passes (`build`, `lint`, `typecheck`, `test`) before merge.
