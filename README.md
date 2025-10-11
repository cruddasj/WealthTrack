# PWA Starter Template

> **These works are a personal project and in no way associated with my employer.**

## Purpose

This repository packages a progressive web app shell with the navigation layout, theming controls, and changelog tooling lifted from the original implementation. Use it as a starting point for projects that need an opinionated sidebar experience without rebuilding every component from scratch.

## Features

- **Responsive layout** – Persistent left navigation on desktop that condenses into a mobile drawer with the familiar toggle interactions.
- **Appearance settings** – Dark mode switch, theme selector, and mobile navigation pin toggle with persisted preferences.
- **Version tracking** – Ready-made Version and Changelog cards that connect to `assets/version.json` and `assets/changelog.json` for release notes.
- **PWA ready** – Manifest metadata, installable icons, and a service worker tuned for static hosting.
- **Accessible controls** – Keyboard friendly navigation, focus states, and semantic markup.

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

The template ships with everything required for installation as a Progressive Web App (PWA):

1. `manifest.webmanifest` describes the app metadata and references the bundled icons.
2. `service-worker.js` caches the core assets so the app can load offline after the first visit.
3. `index.html` registers the service worker and includes the manifest and icon references.

To install the app, open it in a supporting browser (Chrome, Edge, or mobile equivalents) and use the “Install”/“Add to Home Screen” option.

## Development Notes

- Styles are built with Tailwind CSS (CLI v3). The source stylesheet is `src/styles.css` and the compiled output is `assets/styles.css`, which is checked into the repo so GitHub Pages can deploy without a build step.
- All application state is stored in `localStorage`. Clearing the browser storage resets the app to defaults.
- Font Awesome powers the sidebar icons.

### App Versioning

- The Settings page shows the current template version and changelog, driven by `assets/version.json` and `assets/changelog.json`.
- Update both changelog files when shipping new releases so users see accurate notes inside the Version and Changelog cards.

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
