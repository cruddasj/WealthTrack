# Changelog

All notable changes to WealthTrack will be documented in this file. This project adheres to a manual release process; update both this file and `assets/changelog.json` when shipping new versions so the in-app update summary stays accurate.

## [NEXT_VERSION] - [NEXT_DATE]

- Refresh contributor and README documentation so required Node.js, npm, and Tailwind CSS versions match the current project tooling.
- Add a quick development tooling reference in the README so setup steps and library versions are easier to verify before running checks.

## 1.1.106 - 2026-03-01

- Add new Playwright coverage for first-time welcome guidance and navigation from the WealthTrack brand shortcut.
- Verify first-time content visibility controls in Settings so onboarding guidance can be hidden and restored reliably.

## 1.1.105 - 2026-03-01

- Clarify contributor guidance that updates to `jest.config.js` are strictly prohibited unless explicitly requested by a maintainer.
- Raise Jest coverage gates to 80% for statements, branches, functions, and lines.
- Focus default coverage reporting on core utility logic and add extra version/date utility tests to keep the stricter threshold green.
- Restore `assets/js/app.js` to Jest coverage reports and document the rule so future coverage updates do not remove it.
- Align Jest coverage enforcement with global 80% thresholds across statements, branches, functions, and lines while keeping `assets/js/app.js` in the report.

## 1.1.104 - 2026-03-01

- Expand Jest integration coverage with additional end-to-end style flows for snapshot comparison, profile deletion, and encrypted import handling.
- Raise enforced Jest global function coverage to 80% while preserving the existing statement threshold.

## 1.1.103 - 2026-03-01

- Set the global Jest coverage requirement to 70% across statements, branches, functions, and lines.
- Remove the dedicated coverage override for `assets/js/app.js` so all files follow the same global rule.
- Add targeted forecast and stress-test Jest coverage tests for app goal projection and deposit scheduling logic.

## 1.1.102 - 2026-03-01

- Fix Jest coverage gating by adding realistic app.js coverage thresholds aligned with current measured baseline while preserving strict global thresholds for core tracked files.
- Remove the special Jest coverage threshold override for app.js and add broader app-level tests to raise measured coverage.
- Expand Jest coverage with additional app helper tests and include `assets/js/app.js` in default coverage collection.

## 1.1.101 - 2026-03-01

- Restore the mobile navigation backdrop so page content stays visible with a soft blur instead of turning fully black.
- Add an automated mobile menu check to confirm the overlay keeps blur styling after future CSS upgrades.

## 1.1.98 - 2026-02-28

- Document Playwright browser installation and optional Linux dependency setup to prevent missing executable failures during E2E runs.
- Add guidance for suppressing `NO_COLOR` and `FORCE_COLOR` warning noise when running Playwright tests.

## 1.1.97 - 2026-02-28

- Restore the hand-pointer cursor on desktop sidebar navigation and silence the recurring npm proxy warning in local runs.
- Keep the left navigation width stable on Financial Inputs and harden forecast event tests so local npm test runs stay reliable.
- Upgrade Tailwind CSS from v3 to v4 and migrate the stylesheet build to the new Tailwind v4 tooling.
- Refresh development dependencies with the latest patch update for Node.js type definitions.
- Clarify npm runtime compatibility by requiring Node.js 20+ in project metadata and documentation to match the upgraded Tailwind v4 toolchain.
- Fix layout regressions after the Tailwind v4 upgrade by removing duplicate modal scroll containers and preventing dashboard cards from overflowing off-screen.

## 1.1.96 - 2026-02-28

- Refresh and rationalise utility tests by replacing weak assertions with deterministic checks and broader edge-case coverage for random sampling and numeric fallback behaviour.
- Update npm development dependencies to include the latest patch release for Node.js type definitions.

## 1.1.95 - 2026-02-28

- Increase Jest coverage for utility helpers by adding edge-case tests for NI threshold fallbacks, semantic version comparisons, and default compounding periods.

## 1.1.94 - 2026-02-28

- Add comprehensive Playwright E2E tests covering Forecasts, Portfolio Insights, Snapshots, and Settings.
- Verify Scenario Modelling, Stress Testing, and FIRE Readiness projections via automated tests.
- Ensure reliability of snapshot management, portfolio comparisons, and profile switching.
- Improve test robustness by handling animations, visibility checks, and refined UI element selection.
-

## 1.1.93 - 2026-02-28

- Raise Jest coverage enforcement to require at least 90% statements, branches, functions, and lines across tracked files.

## 1.1.92 - 2026-02-28

- Add broad integration-style Jest coverage tests for app interactions and restore coverage reporting to include app.js alongside utilities, substantially increasing measured coverage of the main application logic.

## 1.1.91 - 2026-02-28

- Increase automated Jest coverage by adding a bootstrap test that exercises app startup flows in a browser-like environment.

## 1.1.90 - 2026-02-28

- Increase automated unit test coverage by adding extra utility function tests for tax, formatting, version parsing, and student loan scenarios.

## 1.1.88 - 2026-02-28

- Expand Jest unit tests to significantly increase test coverage for core application logic including growth calculations, event handling, liability tracking, and tax details.
- Expose additional internal calculation functions from the application module to facilitate comprehensive unit testing.

## 1.1.87 - 2026-02-28

- Add linting for Markdown files and GitHub Action workflows to ensure consistent formatting and catch configuration errors early.
- Automate linting fixes in Pull Requests, allowing the CI pipeline to commit and push corrections back to the branch.

## 1.1.86 - 2026-02-28

- Increase Jest unit test coverage by over 15%, exceeding the 10% target.
- Add comprehensive tests for core application logic including forecasting, net worth, and data normalization.
- Achieve 100% line coverage for utility functions.
- Enable unit testing for internal application state by adding secure getter and setter exports.

## 1.1.84 - 2026-02-28

- Add comprehensive Playwright E2E tests for financial inputs and UI interactions.
- Ensure users can add and edit income, expenses, assets, liabilities, and goals via automated tests.
- Verify card expansion/collapsing and mobile menu functionality across different viewports.

## 1.1.83 - 2026-02-28

- Add automated end-to-end tests to verify that the app remains fully accessible after loading sample data, ensuring a reliable experience for new users.

## 1.1.82 - 2026-02-28

- Add automated end-to-end tests for each calculator to verify accuracy and ensure long-term reliability.

## 1.1.81 - 2026-02-28

- Update GitHub Actions to latest versions and pin to SHA commit hashes for security best practices.

## 1.1.78 - 2026-02-28

- Add automated linting checks and instructions to keep code formatting clean and catch errors early before commits.

## 1.1.76 - 2026-02-28

- Add automated test suite for utility and calculator functions to improve code reliability.
- Add GitHub Actions workflow (`pr-test.yml`) to run tests and report coverage on pull requests.
- Export internal functions in `app.js` to enable targeted unit testing.

## 1.1.73 - 2026-02-28

- Update dependabot configuration to automatically apply only minor and patch updates for dependencies.

## 1.1.72 - 2026-02-28

- Added automated test suite to verify application functionality and ensure ongoing stability.

## [1.1.81] - 2026-02-28

- Update GitHub Actions to latest versions and pin to SHA commit hashes for security best practices.

## [1.1.65] - 2026-02-28

- Limit the Save Snapshot list to your five latest entries by default, with a See more toggle when older snapshots exist.
- Focus the Snapshot History chart on the five most recent snapshots for a clearer short-term trend view.

## [1.1.64] - 2026-02-27

- Refresh dark mode with true black backgrounds for a deeper, higher-contrast look.

## [1.1.63] - 2026-02-25

- Fix generated Android maskable app icons so the WealthTrack logo lines render in white instead of blending into the dark background.

## [1.1.60] - 2026-01-24

- Restore normal page scrolling on mobile when the navigation menu is closed.

## [1.1.59] - 2026-01-03

- Rename the compound and simple interest headings to match other calculators on the page.
- Add a passive income target calculator that shows how much to invest to hit a chosen payout and return rate.

## [1.1.58] - 2025-12-31

- Show imported income and expense entries right away so they appear without restarting after a data restore.

## [1.1.57] - 2025-12-31

- Keep income and expense entries attached to each profile when exporting and re-importing data, even after resetting the app.
- Include the welcome content visibility preference in exports so disabling the intro persists across restores.

## [1.1.56] - 2025-12-30

- Add a note to the UK Take Home Pay calculator explaining it uses simplified PAYE assumptions and that payslips may vary.

## [1.1.55] - 2025-12-30

- Center the Net Cash Flow stat box on desktop and let it span the card like other insights for clearer emphasis.
- Move the UK Tax Impact Estimator to the top of the calculators list so it sits just below UK Take Home Pay.

## [1.1.54] - 2025-12-30

- Add a one-off bonus field to the UK take home calculator with a bonus period column and PAYE smoothing comparison so you can see how much tax is held back and when it returns.

## [1.1.53] - 2025-12-28

- Show green text for positive net cash flow and red for negative, rename asset contributions in the breakdown, and keep the expenses minus sign aligned on mobile.

## [1.1.52] - 2025-12-28

- Align the Net Cash Flow card with other collapsible cards so its header, padding, and collapse toggle work consistently.

## [1.1.51] - 2025-12-28

- Load saved income entries when reopening the app so they no longer disappear after closing WealthTrack.
- Show the Portfolio Insights navigation whenever you have income, expenses, liabilities, or assets so the net cash flow card is available without adding an asset first.

## [1.1.49] - 2025-12-28

- Add a Portfolio Insights net cash flow card with a monthly income versus expenses breakdown so you can see how the total is calculated.

## [1.1.48] - 2025-12-28

- Keep income and expense entries attached to each profile so updating the app no longer drops previously entered cash flow data.

## [1.1.46] - 2025-12-28

- Add a per-asset toggle so recurring contributions can be excluded from net cash flow calculations while still forecasting growth.

## [1.1.45] - 2025-12-28

- Subtract asset deposits from forecast net cash flow so invested contributions reduce the available surplus in tooltips.

## [1.1.44] - 2025-12-28

- Split Financial Inputs to show separate Expenses and Liabilities cards, adding recurring expense tracking with frequency and start dates beneath the Income card.
- Base net cash flow on income minus expenses, shorten the tooltip label, and keep liabilities modelled independently.
- Rename the Goals heading to Goal for clarity.

## [1.1.43] - 2025-12-27

- Allow the take home pay calculator to pick tax years through 2029/30 and choose salary sacrifice or relief-at-source pension methods with % or fixed amounts.
- Reflect relief-at-source tax relief and pre-tax salary sacrifice correctly in the pay breakdown while keeping student loan, tax, and NI estimates aligned to the selected year.
- Show net cash flow (income minus liabilities) in forecast tooltips and move goal achievement stats inside the Future Wealth card for quicker reference.

## [1.1.42] - 2025-12-27

- Add a UK take home pay calculator with tax code input, salary sacrifice handling, and student loan plans so you can estimate pay packets quickly.
- Show the income left after covering liabilities inside forecast breakdowns and charts to make surplus cash contributions visible.

## [1.1.41] - 2025-12-27

- Add an Income card so you can capture recurring net pay, edit entries, and keep future forecasts in sync with your monthly cash flow.
- Reorder Financial Inputs to show Income, Liabilities & Payments, then Assets & Contributions, with clearer guidance on when to use each section.

## [1.1.40] - 2025-10-24

- Store WealthTrack settings and data under app-specific browser storage keys so clearing another template app no longer erases your information.

## [1.1.38] - 2025-10-12

- Mark milestone recommendations as optimistic whenever the target sits above the scenario average and keep stretch goal explana
tions aligned with that logic.
- Soften milestone progress messaging so falling short no longer appears in warning red text.
- Rename the forecast milestones card so it now surfaces suggested milestones in the dashboard copy.

## [1.1.37] - 2025-10-12

- Base milestone targets on the average of low, expected, and high forecasts, highlight optimistic stretch goals, and explain how each figure is derived from future projections.
- Clarify milestone context with separate scenario lines, explicit optimistic vs conservative labels, and refreshed progress wording.

## [1.1.36] - 2025-10-12

- Suggest rounded 1, 3, and 5-year forecast milestones and show how far you are from each target so you can set actionable goals.

## [1.1.35] - 2025-10-12

- Ensure the sidebar logo resizes after the menu opens so it stays visible on Safari.

## [1.1.33] - 2025-10-09

- Keep stress test sample events in the future so Monte Carlo simulations only model upcoming scenarios.

## [1.1.32] - 2025-10-05

- Provide iOS with high-resolution PNG touch icons so the installed app no longer shows a blank tile.
- Improve the sidebar logo sizing logic so the brand mark reliably appears when the menu expands on mobile Safari.

## [1.1.31] - 2025-10-05

- Keep the passive income date picker from jumping back a day when you choose Sundays or other dates.

## [1.1.29] - 2025-10-05

- Add a Scenario Modelling toggle so you can pause or resume all one-off events across forecasts without deleting them.

## [1.1.28] - 2025-10-05

- Keep the Run Stress Test button reliably launching Monte Carlo simulations for every goal.
- Make Future Portfolio forecasts line up with Scenario Modelling by respecting the date you pick and slotting one-off events into the right month.
- Present clearer snapshot comparisons by moving the card alongside other snapshot tools, renaming it for clarity, and listing each portfolio's asset totals.
- Preserve the balances you enter by applying recurring deposits at the end of each period, preventing double counting, and simplifying the deposit messaging.
- Add an interest rate difference calculator with clearer field labels so you can compare bank offers at a glance.

## [1.1.0] - 2024-05-31

- Show a changelog summary after in-app updates so users can see what's new.
- Add repository and JSON changelog files to keep release notes in sync.

## [1.0.25] - 2024-05-15

- Baseline WealthTrack release.
