# Changelog

All notable changes to WealthTrack will be documented in this file. This project adheres to a manual release process; update both this file and `assets/changelog.json` when shipping new versions so the in-app update summary stays accurate.

## [1.1.8] - 2025-10-04
- Fix update confirmations so newly installed versions surface the right changelog entries by tracking the service worker's version.
- Keep the Settings version display aligned with the installed release instead of the latest download to avoid mismatched notes.

## [1.1.6] - 2025-10-08
- Restore exported tax settings and the sticky navigation preference when importing profile backups.
- Keep asset values at the amount entered by defaulting recurring deposits to month-end, allowing a custom deposit day, and updating the form labels.

## [1.1.5] - 2025-10-07
- Harden the in-app changelog loader so the Settings card reliably reports when release notes fail to load.

## [1.1.4] - 2025-10-06
- Ensure in-app update confirmations consistently include release notes by preserving the prior version and skipping race conditions.
- Add a changelog card to the Settings page with the five most recent updates as a fallback for missed popups.

## [1.1.3] - 2025-10-05
- Rename portfolio allocation labels from "Share" to "Portfolio %" for clearer terminology.

## [1.1.2] - 2025-10-04
- Fix the in-app update confirmation so it reliably shows changelog details after installing a new version.

## [1.1.1] - 2025-10-04
- Add an interest rate difference calculator to compare yearly earnings between two banks.

## [1.1.0] - 2024-05-31
- Show a changelog summary after in-app updates so users can see what's new.
- Add repository and JSON changelog files to keep release notes in sync.

## [1.0.25] - 2024-05-15
- Baseline WealthTrack release.
