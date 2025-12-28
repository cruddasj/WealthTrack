# Changelog

All notable changes to WealthTrack will be documented in this file. This project adheres to a manual release process; update both this file and `assets/changelog.json` when shipping new versions so the in-app update summary stays accurate.

## [1.1.44] - 2025-12-28
- Split the Liabilities & Expenses card into dedicated Expenses and Liabilities cards so you can enter recurring outgoings with names, frequencies, and start dates while keeping debts separate.
- Base net cash flow forecasts and chart tooltips on income minus expenses (excluding liabilities) and simplify the tooltip label to “Net cash flow.”
- Update the Goals heading to read “Goal” for consistency across the dashboard.

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
