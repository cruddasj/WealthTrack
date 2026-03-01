/**
 * @jest-environment jsdom
 */

const app = require('../assets/js/app.js');

describe('Goal forecasting and stress helpers', () => {
  beforeEach(() => {
    app.setAssets([]);
    app.setIncomes([]);
    app.setExpenses([]);
    app.setLiabilities([]);
    app.setSimEvents([]);
    app.setScenarioEventsEnabled(true);
    app.setGoalValue(0);
    app.setInflationRate(2.5);
    app.invalidateTaxCache();
    jest.useFakeTimers().setSystemTime(new Date('2025-01-01T00:00:00Z').getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('deposit iterators accumulate scheduled deposits across month boundaries', () => {
    const now = Date.now();
    const asset = {
      value: 1000,
      originalDeposit: 100,
      frequency: 'monthly',
      startDate: now,
      dateAdded: now,
      return: 0,
      taxTreatment: 'tax-free'
    };

    const iterator = app.createDepositIterator(asset, now);
    expect(iterator).not.toBeNull();
    expect(iterator.peekNext()).toBeGreaterThan(now);

    const afterTwoMonths = new Date('2025-03-15T00:00:00Z').getTime();
    expect(iterator.consumeBefore(afterTwoMonths)).toBe(200);

    const afterFourMonths = new Date('2025-05-15T00:00:00Z').getTime();
    expect(iterator.consumeBefore(afterFourMonths)).toBe(200);

    expect(app.createDepositIterator({ frequency: 'none', originalDeposit: 100 }, now)).toBeNull();
    expect(app.createDepositIterator({ frequency: 'monthly', originalDeposit: 0 }, now)).toBeNull();
  });

  test('forecastGoalDate handles global and asset-specific events', () => {
    const now = Date.now();
    const asset = {
      name: 'Core ETF',
      value: 10000,
      return: 0,
      lowGrowth: 0,
      highGrowth: 0,
      frequency: 'none',
      dateAdded: now,
      startDate: now,
      taxTreatment: 'tax-free'
    };
    app.setAssets([asset]);
    app.setGoalValue(10500);
    app.setSimEvents([
      { date: new Date('2025-02-01T00:00:00Z').getTime(), amount: 1000, isPercent: false, assetId: now },
      { date: new Date('2025-03-01T00:00:00Z').getTime(), amount: 10, isPercent: true }
    ]);
    app.normalizeData();
    app.invalidateTaxCache();

    const base = app.forecastGoalDate([], 'base', new Set([now]));
    expect(base.hitDate).not.toBeNull();

    app.setScenarioEventsEnabled(false);
    const withoutScenarioEvents = app.forecastGoalDate([], 'base', new Set([now]));
    expect(withoutScenarioEvents.hitDate).toBeNull();

    const extraEventsHit = app.forecastGoalDate([
      { date: new Date('2025-02-01T00:00:00Z').getTime(), amount: 3000, isPercent: false }
    ], 'high', new Set([now]));
    expect(extraEventsHit.hitDate).not.toBeNull();
  });


  test('buildForecastScenarios supports passive-only breakdown output', () => {
    const now = Date.now();
    const futureStart = new Date('2025-06-01T00:00:00Z').getTime();
    app.setAssets([
      {
        name: 'Passive Bond',
        value: 5000,
        return: 4,
        lowGrowth: 2,
        highGrowth: 6,
        frequency: 'quarterly',
        originalDeposit: 250,
        dateAdded: now,
        startDate: futureStart,
        taxTreatment: 'tax-free',
        includeInPassive: true
      },
      {
        name: 'Excluded Asset',
        value: 3000,
        return: 4,
        frequency: 'none',
        dateAdded: now + 1,
        startDate: now,
        includeInPassive: false,
        taxTreatment: 'tax-free'
      }
    ]);
    app.setIncomes([{ name: 'Salary', amount: 1000, frequency: 'monthly', startDate: now, dateAdded: now }]);
    app.setExpenses([{ name: 'Bills', amount: 600, frequency: 'monthly', startDate: now, dateAdded: now }]);
    app.setLiabilities([{ name: 'Loan', value: 1200, interest: 0, monthlyPayment: 100, startDate: now, dateAdded: now }]);
    app.setSimEvents([
      { date: new Date('2025-04-01T00:00:00Z').getTime(), amount: 5, isPercent: true, assetId: now },
      { date: new Date('2025-05-01T00:00:00Z').getTime(), amount: 250, isPercent: false }
    ]);
    app.normalizeData();
    app.invalidateTaxCache();

    const scenarios = app.buildForecastScenarios(2, { passiveOnly: true, includeBreakdown: true });

    expect(scenarios.labels).toHaveLength(25);
    expect(scenarios.assetDetails.length).toBeGreaterThan(0);
    expect(scenarios.currentBaseline).toBeGreaterThanOrEqual(0);
    expect(Math.min(...scenarios.base)).toBe(scenarios.minSeriesValue);
  });

  test('runStressTest returns deterministic aggregates with mocked randomness', () => {
    const now = Date.now();
    app.setAssets([
      {
        name: 'Index Fund',
        value: 10000,
        return: 5,
        lowGrowth: 2,
        highGrowth: 8,
        frequency: 'none',
        dateAdded: now,
        startDate: now,
        taxTreatment: 'tax-free'
      }
    ]);
    app.setGoalValue(12000);
    app.normalizeData();
    app.invalidateTaxCache();

    jest.spyOn(Math, 'random').mockReturnValue(0.95);

    const stats = app.runStressTest(3, 'low', [now]);

    expect(stats.sample).toBeTruthy();
    expect(stats.sample.events).toEqual([]);
    expect(stats.pct).toBe(100);
    expect(stats.baseline).not.toBeNull();
    expect(stats.earliest).not.toBeNull();
    expect(stats.latest).not.toBeNull();

    const empty = app.runStressTest(0, 'base', [now]);
    expect(empty.pct).toBe(0);
    expect(empty.sample).toBeNull();
  });
});
