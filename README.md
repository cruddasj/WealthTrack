# WealthTrack

WealthTrack is a personal wealth projection and planning tool built as a single-page application. It helps you capture assets and goals, run forecasts, explore portfolio insights, and maintain historical snapshots.

## Features

- **Assets & Goals** – Track assets, liabilities, and savings targets.
- **Forecasts** – Model future balances with configurable growth assumptions, one-off events, and stress tests.
- **Portfolio Insights** – Visualise allocations, income projections, and stress scenarios.
- **UK Tax Tools** – Choose your tax band, classify each asset's tax treatment, and see projections after UK income, dividend, or capital gains tax.
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

## UK Tax Tools

WealthTrack now includes optional UK tax handling so you can plan on an after-tax basis:

- **Profile-level settings** – Choose a tax band (Basic, Higher, Additional, or ignore UK tax entirely) in the **Settings → UK Tax Settings** card. Each profile keeps its own selection.
- **Asset tax treatment** – Mark assets as tax-free, taxed as income, dividends, or capital gains directly in the asset form. Tax-free assets always retain their full returns.
- **Net-of-tax projections** – Forecasts, passive income estimates, and the UK Tax Helper calculator automatically apply the selected rates to taxable assets.
- **Transparent calculations** – The UK Tax Helper tab breaks down gross growth, tax deducted, and the final net amount so you can follow every step.

> ℹ️ Personal allowances (Savings, Dividend, Capital Gains) and tax shelters such as ISAs or pensions are not modelled automatically. Adjust expected returns or asset values if part of the growth will be sheltered from tax.

## License

This project is provided as-is; feel free to adapt it to suit your needs.
