# WealthTrack

> **These works are a personal project and in no way associated with my employer.**

## Purpose

WealthTrack is a personal wealth projection and planning tool built as a single-page application. It helps you capture assets and goals, run forecasts, explore portfolio insights, and maintain historical snapshots.

## Features

- **Financial Inputs** – Track assets, liabilities, and savings targets.
- **Forecasts** – Model future balances with configurable growth assumptions, one-off events, and stress tests.
- **Portfolio Insights** – Visualise allocations, income projections, and stress scenarios.
- **Snapshots** – Save checkpoints and review progress over time.
- **Custom Themes** – Switch between dark mode and alternate visual themes.
- **Secure Profiles** – Create multiple profiles with optional password protection.

## Getting Started

Serve the repository with any static HTTP server. All logic is client-side, so no backend is required. Using `file://` will prevent the service worker from registering, so prefer a local HTTP server.

```bash
# Example: using a simple Python web server
python -m http.server 8080

# or Node's serve (if installed):
npx serve -l 8080
```

Then visit `http://localhost:8080` in your browser.

## Progressive Web App

WealthTrack is installable as a Progressive Web App (PWA):

1. The `manifest.webmanifest` file describes the app metadata and reuses the sidebar logo for install icons.
2. `service-worker.js` caches the core assets so the app can load offline after the first visit.
3. The `index.html` file registers the service worker and includes the manifest and icon references.

To install the app, open it in a supporting browser (Chrome, Edge, or mobile equivalents) and use the “Install”/“Add to Home Screen” option.

## Development Notes

- Styles are built with Tailwind CSS (CLI, v3). The source stylesheet is `src/styles.css` and the compiled output is `assets/styles.css`, which is checked into the repo so GitHub Pages can deploy without a build step.
- Chart.js powers the data visualisations; Hammer.js and the Chart.js Zoom plugin enable gesture controls.
- All application state is stored in `localStorage`. Clearing the browser storage resets the app to defaults.

### App Versioning

- The Settings page shows the current app version so users can reference it when sharing feedback.
- To avoid merge conflicts when multiple pull requests are open, version numbers and dates in `CHANGELOG.md` and `assets/changelog.json` should be represented with `[NEXT_VERSION]` and `[NEXT_DATE]` placeholders in PRs.
- The Pages deployment workflow (`.github/workflows/static.yml`) runs on pushes to `main`. It automatically computes the next version, replaces placeholders in changelogs, updates `assets/version.json` and `service-worker.js`, commits these back to the main branch, and creates the corresponding release tag. It also prunes older releases to keep only the five most recent.
- The service worker cache is stamped with the release version so clients automatically pick up the newest assets without needing to clear site data.

### Testing

The project uses Jest for unit testing and Playwright for end-to-end (E2E) testing. Automated tests help ensure the code remains functional and prevent regressions.

**Run unit tests (Jest):**
```bash
npm run test
```

**Run E2E tests (Playwright):**
```bash
# This will start a local server and run the Playwright test suite
npm run test:e2e
```

### Rebuilding CSS

Prerequisite: Node.js 16+ and npm.

Install dependencies (first time only):

```bash
npm install
```

Build once:

```bash
npm run build:css
```

Watch for changes during development:

```bash
npm run watch:css
```

Notes:
- Edit styles in `src/styles.css` (uses `@tailwind`/`@layer`/`@apply`).
- Do not edit `assets/styles.css` by hand; it is generated.
- If you add new HTML/JS files that include Tailwind classes, update `tailwind.config.js` `content` globs so the classes are included in the build.
