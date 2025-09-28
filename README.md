# WealthTrack

WealthTrack is a personal wealth projection and planning tool built as a single-page application. It helps you capture assets and goals, run forecasts, explore portfolio insights, and maintain historical snapshots.

## Features

- **Assets & Goals** – Track assets, liabilities, and savings targets.
- **Forecasts** – Model future balances with configurable growth assumptions, one-off events, and stress tests.
- **UK tax modelling** – Configure allowances and taxpayer band, choose per-asset tax treatments, and review detailed after-tax estimates.
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
# npx serve -l 8080
```

Then visit `http://localhost:8080` in your browser.

## Progressive Web App

WealthTrack is installable as a Progressive Web App (PWA):

1. The `manifest.webmanifest` file describes the app metadata and reuses the sidebar logo for install icons.
2. `service-worker.js` caches the core assets so the app can load offline after the first visit.
3. The `index.html` file registers the service worker and includes the manifest and icon references.

To install the app, open it in a supporting browser (Chrome, Edge, or mobile equivalents) and use the “Install”/“Add to Home Screen” option.

## UK tax modelling

WealthTrack includes tooling to model UK taxes across interest, dividends, and capital gains so projections show after-tax growth.

- **Tax settings card** – Set your taxpayer band (basic or higher/additional) and update the annual allowances that apply to savings interest, dividends, and capital gains. These allowances are stored per profile and reset each April in real life, so adjust them whenever the rules change.
- **Per-asset tax treatment** – When adding or editing an asset, pick whether the holding is tax-free, income-taxable, dividend-taxable, or subject to capital gains (standard or the higher property band). The model shares allowances evenly between assets with the same treatment and applies the relevant rates for your band.
- **After-tax forecasts** – Forecasts, passive income summaries, and the FIRE projection all deduct tax before reinvesting growth so you can see realistic net outcomes.
- **Asset tax calculator** – Use the calculator button in the assets table to open a detailed breakdown of the allowance share, taxable amount, and estimated tax due for the next year based on your expected returns.

If you need a different allowance split across assets, update the allowance values in Settings and the calculator will reflect the new share immediately.

## Deploying to GitHub Pages

1. Push the repository to GitHub.
2. In the repository settings, enable **GitHub Pages** and select the `main` branch with the `/ (root)` folder.
3. After GitHub builds the site, your app will be available at `https://<username>.github.io/wealth-tracker/`.
4. Because the manifest uses relative paths, the PWA will work whether you host it locally or via GitHub Pages.

## Development Notes

- Styles are built with Tailwind CSS (CLI, v3). The source stylesheet is `src/styles.css` and the compiled output is `assets/styles.css`, which is checked into the repo so GitHub Pages can deploy without a build step.
- Chart.js powers the data visualisations; Hammer.js and the Chart.js Zoom plugin enable gesture controls.
- All application state is stored in `localStorage`. Clearing the browser storage resets the app to defaults.

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

## License

This project is provided as-is; feel free to adapt it to suit your needs.
