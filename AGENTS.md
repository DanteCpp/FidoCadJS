# Agent Notes

FidoCadJS is a TypeScript browser port of FidoCadJ, built with Vite, Vitest,
and jsdom. Keep the project small, readable, and close to the Java reference
where that helps preserve FCL behavior.

## Goals

- Preserve compatibility with the FidoCadJ file format and drawing semantics.
- Prefer clear TypeScript over broad abstractions.
- Keep browser behavior deterministic and covered by focused tests.
- Use `~/FidoCadJ` only as read-only reference material.
- Keep dependencies minimal; ask before adding any new package.

## Quality Rules

- Read `AGENTS.md` before meaningful work. 
- Write tests alongside new modules and meaningful behavior changes.
- Run the relevant build or test command after non-trivial edits.
- Comment only where code intent is not obvious from local context.
- Do not add boilerplate file headers to new files.
- Prefer in-code comment to separate documentation. 

## Branching & CI

- `main` is the single long-lived branch and the source of deploys.
- Do all work on short-lived feature branches cut from `main`
  (e.g. `feat/...`, `fix/...`) and merge back through a pull request.
- CI runs on every pull request to `main` and on every push to `main`;
  keep a PR green before merging.
- A green `main` build auto-deploys to GitHub Pages (`deploy.yml`).
- `audit.yml` runs nightly to track dependency vulnerabilities.

## Layout

- `src/`: TypeScript implementation and browser-facing code.
- `test/`: Vitest, jsdom, and browser regression coverage.
- `docs/`: project documentation.
- `scripts/`: repository automation and validation helpers.
- `public/`: static assets served by Vite.
- `FIDOSPECS.md`: FidoCad/FidoCadJ format reference.

## Testing

- Use `npm test` for the main Vitest suite.
- Use `npm run build` for production build validation.
- Use Playwright or browser tests only when changing interactive UI behavior.

