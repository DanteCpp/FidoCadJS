# Agent Notes

FidoCadJS is a self-contained FidoCad parser and editor implemented in TypeScript, built with Vite, Vitest,
and jsdom. It was originaly developed as a browser port of FidoCadJ.

## Goals

- Preserve compatibility with the FidoCadJ file format and drawing semantics.
- Prefer clear TypeScript over broad abstractions.
- Keep browser behavior deterministic and covered by focused tests.
- Keep dependencies minimal; ask before adding any new package.

## Quality Rules

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
- Prefer e2e tests to unit tests. 
