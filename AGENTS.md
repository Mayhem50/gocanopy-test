# AGENTS.md

Drop-in operating instructions for coding agents. Read this file before every task.

Working code only. Finish the job. Plausibility is not correctness.

## Non-negotiables

1. Disagree when the user's premise is wrong.
2. Never fabricate paths, commands, APIs, versions, or test results.
3. Touch only what the request requires.
4. Read the files you will touch and the files that call them.
5. Validate with real commands before claiming success.

## Project Context

- Language/runtime: TypeScript on Node.js
- Package manager: pnpm
- Monorepo tool: Turbo
- Source layout: `apps/` for runnable targets, `packages/` for reusable libraries
- Tests: Vitest; Playwright only for browser behavior

## Commands

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run focused package commands during iteration. Run the repo-level verification before final handoff.

## TypeScript Rules

- Avoid production `any`.
- Prefer flat flows, early returns, and intent-named helpers.
- Use object parameters when a function needs more than three parameters.
- Use `on*` for callback props and public callback parameters.
- Avoid packages named `common`, `shared`, `utils`, or `helpers`.
- Cross-package imports use package names, not parent-relative paths.
- Environment variables use `UPPER_SNAKE_CASE` and are documented in `.env.example`.
- Do not leave `console.log` in production code.
- Comments explain non-obvious why, not what.

## Architecture Rules

- Follow SOLID, KISS, and pragmatic DRY. Do not abstract before duplication or complexity is real.
- Handlers and business services must receive providers through dependency injection. Never instantiate providers directly inside them.

## Testing Rules

- Tests should primarily describe user, business, or system flows. Test pure functions directly when that is the unit of behavior.
- Tests must be robust and scalable: do not assert internal implementation strings, private formatting, incidental logs, or other unstable details.
- Tests must respect encapsulation. Do not expose, weaken, or reshape internals just to make a test easy to write.

## Dependency Rules

- Package versions must be pinned. Do not use `latest`, floating ranges, or implicit tool defaults in committed manifests.
- Do not adopt a package version released less than two weeks ago unless the user explicitly approves the risk.

## Review Checklist

- The diff matches the requested scope.
- Root scripts exist and run.
- At least one baseline test proves the scaffold works.
- No fake Turbo scripts were added.
- Versions are pinned and old enough to satisfy the dependency age rule.
