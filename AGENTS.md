Agent Guidelines for WealthTrack

Scope: This file applies to the entire repository.

Overview
- WealthTrack is a static SPA (no backend). It uses Tailwind CSS (CLI v3) with a small custom stylesheet. The compiled CSS is committed for GitHub Pages deployment.
- Icon PNG assets are generated during the CI/CD pipeline; do not commit regenerated binaries.

Do
- Edit source styles in `src/styles.css` only. Rebuild CSS with:
  - `npm run build:css` (one-off) or `npm run watch:css` (during development).
- Keep the generated file `assets/styles.css` up to date and committed when changing styles.
- Ensure `tailwind.config.js` `content` globs cover any new HTML/JS files that use Tailwind classes (currently scans `index.html` and `assets/js/**/*.js`).
- Serve locally over HTTP for testing (service worker does not work with `file://`). Example: `python -m http.server 8080`.
- Preserve the project structure and naming; keep changes minimal and targeted.

Don't
- Don't reintroduce Tailwind via the CDN in `index.html`. The app now relies on the compiled stylesheet `assets/styles.css`.
- Don't edit `assets/styles.css` manually. It is a build artifact.
- Don't add bundlers or frameworks unless explicitly requested.

Environment
- Requires Node.js 16+ and npm.
- Tailwind CLI: v3 (configured via `tailwind.config.js`).

Deployment
- GitHub Pages workflow uploads the repository as-is and does not run a build step. Always commit the updated `assets/styles.css` when changing styles so Pages reflects the latest CSS.

