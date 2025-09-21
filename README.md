# WealthTrack

WealthTrack is a personal wealth projection and planning tool built as a single-page application. It helps you capture assets and goals, run forecasts, explore portfolio insights, and maintain historical snapshots.

## Features

- **Assets & Goals** – Track assets, liabilities, and savings targets.
- **Forecasts** – Model future balances with configurable growth assumptions, one-off events, and stress tests.
- **Portfolio Insights** – Visualise allocations, income projections, and stress scenarios.
- **Snapshots** – Save checkpoints and review progress over time.
- **Custom Themes** – Switch between dark mode and alternate visual themes.
- **Secure Profiles** – Create multiple profiles with optional password protection.

## Getting Started

Open `index.html` in a modern browser or serve the repository with any static HTTP server. All logic is client-side, so no backend is required.

```bash
# Example: using a simple Python web server
python -m http.server 8080
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

- Tailwind CSS is loaded through the CDN build and configured in `tailwind-config.js` if you need customisations.
- Chart.js powers the data visualisations; Hammer.js and the Chart.js Zoom plugin enable gesture controls.
- All application state is stored in `localStorage`. Clearing the browser storage resets the app to defaults.

## License

This project is provided as-is; feel free to adapt it to suit your needs.
