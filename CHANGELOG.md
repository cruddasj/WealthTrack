# Changelog

All notable changes to WealthTrack will be documented in this file. This project adheres to a manual release process; update both this file and `assets/changelog.json` when shipping new versions so the in-app update summary stays accurate.

## [1.1.24] - 2025-10-05
- Ensure the Future Portfolio card reflects one-off asset events that occur before the selected forecast date within the same month.

## [1.1.23] - 2025-10-05
- Keep the Future Portfolio card from including one-off events that occur after the selected date.

## [1.1.22] - 2025-10-05
- Keep the Forecast Progress Check from marking you behind the saved projection when you take a snapshot and review it on the same day.

## [1.1.21] - 2025-10-04
- Show exact asset values for both the base and compared portfolios in the Snapshot Comparison breakdown.

## [1.1.20] - 2025-10-04
- Collapse cards by default for first-time visitors and let welcome shortcuts open their target sections immediately without overriding saved preferences.

## [1.1.19] - 2025-10-04
- Clarify that Future Portfolio forecasts include one-off Scenario Modelling events.

## [1.1.18] - 2025-10-04
- Move the import data card ahead of the export data card so restoring data is the first action shown in Settings.

## [1.1.17] - 2025-10-04
- Move the Snapshot Comparison card into the Snapshots page alongside other snapshot tools.
- Rename Progress Check to Forecast Progress Check and clarify that progress uses the saved expected projections.

## [1.1.16] - 2025-10-04
- Rename the interest rate comparison fields to "Rate" and "Comparative rate" for clearer terminology.

## [1.1.15] - 2025-10-04
- Content corrections.

## [1.1.14] - 2025-10-04
- Simplify asset table deposit details by removing the end-of-period assumption text.

## [1.1.13] - 2025-10-04
- Keep asset tables and portfolio insights from adding scheduled deposits to the current value entered by the user.

## [1.1.12] - 2025-10-04
- Remove the deposit day selection for assets and explain that recurring contributions are assumed to land at the end of each period.
- Update wealth forecasts so recurring deposits are applied at the end of each period instead of being averaged across months.

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
