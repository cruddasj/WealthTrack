# WealthTrack

> **These works are a personal project and in no way associated with my employer.**

## Purpose

WealthTrack is now a streamlined Progressive Web App shell. It provides a responsive layout, theme controls, and update tooling that you can build upon when creating bespoke financial tooling or any other offline-first experience.

## Features

- **Responsive welcome experience** – Introduces the app and highlights Progressive Web App capabilities.
- **Settings dashboard** – Manage theme preferences, toggle first-time guidance, clear local data, and trigger update checks.
- **Dark mode & themes** – Switch between light/dark appearances and pick from predefined visual themes.
- **Changelog viewer** – Surfaces the latest release notes from `assets/changelog.json` so users stay informed.
- **Installable PWA** – Manifest and service worker support allow WealthTrack to run offline once cached.

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

1. The `manifest.webmanifest` file describes the app metadata and icon set.
2. `service-worker.js` caches the core assets so the app can load offline after the first visit.
3. `assets/js/app.js` registers the service worker and handles update checks from the Settings page.

To install the app, open it in a supporting browser (Chrome, Edge, or mobile equivalents) and use the “Install”/“Add to Home Screen” option.

## Development Notes

- Styles are built with Tailwind CSS (CLI, v3). The source stylesheet is `src/styles.css` and the compiled output is `assets/styles.css`, which is checked into the repo so GitHub Pages can deploy without a build step.
- All application state is stored in `localStorage`. Clearing the browser storage resets the app to defaults.
- The Settings page reads the version from `assets/version.json`. Keep it aligned with your release process.
- The in-app changelog reads from `assets/changelog.json`. Update both that file and `CHANGELOG.md` together when shipping a release.

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
