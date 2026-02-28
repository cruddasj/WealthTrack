/**
 * @jest-environment jsdom
 */

const app = require('../assets/js/app.js');

describe('App Core Logic', () => {
  beforeEach(() => {
    // Reset state before each test
    app.setAssets([]);
    app.setIncomes([]);
    app.setExpenses([]);
    app.setLiabilities([]);
    app.setSimEvents([]);
    app.setGoalValue(0);
    app.setInflationRate(2.5);
    app.invalidateTaxCache();

    // Mock Date.now() for consistency: Jan 1st 2025
    jest.useFakeTimers().setSystemTime(new Date('2025-01-01').getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('normalizeData should set defaults and process assets', () => {
    const asset = {
      name: 'Test Asset',
      value: 1000,
      return: 5,
      dateAdded: '2025-01-01'
    };
    app.setAssets([asset]);
    app.normalizeData();

    const processedAssets = app.getAssets();
    expect(processedAssets[0].frequency).toBe('none');
    expect(processedAssets[0].taxTreatment).toBe('tax-free');
    expect(processedAssets[0].includeInPassive).toBe(true);
    expect(processedAssets[0].lowGrowth).toBe(5);
    expect(processedAssets[0].highGrowth).toBe(5);
  });

  test('calculateNetWorth should sum up assets and subtract liabilities', () => {
    const now = Date.now();
    app.setAssets([
      { value: 1000, dateAdded: now, return: 0, startDate: now },
      { value: 2000, dateAdded: now, return: 0, startDate: now }
    ]);
    app.setLiabilities([
      { value: 500, dateAdded: now, interest: 0, startDate: now }
    ]);

    app.normalizeData();

    const netWorth = app.calculateNetWorth();
    expect(netWorth).toBe(2500);
  });

  test('calculatePassiveWorth should only include passive-eligible assets', () => {
    const now = Date.now();
    app.setAssets([
      { value: 1000, dateAdded: now, includeInPassive: true, return: 0, startDate: now },
      { value: 5000, dateAdded: now, includeInPassive: false, return: 0, startDate: now }
    ]);
    app.normalizeData();

    const passiveWorth = app.calculatePassiveWorth();
    expect(passiveWorth).toBe(1000);
  });

  test('buildForecastScenarios should generate projections', () => {
    const now = Date.now();
    app.setAssets([
      {
        name: 'Growth Asset',
        value: 10000,
        return: 12, // ~1% per month
        dateAdded: now,
        startDate: now,
        frequency: 'none'
      }
    ]);
    app.normalizeData();
    app.invalidateTaxCache();

    // Forecast for 1 year (12 months)
    const result = app.buildForecastScenarios(1);

    expect(result.labels).toHaveLength(13); // month 0 to 12
    expect(result.base).toHaveLength(13);

    // Month 0 should be initial value
    expect(result.base[0]).toBe(10000);

    // After 1 month, it should have grown by 1%
    // Note: buildForecastScenarios uses monthly compounding: 12% / 12 = 1%
    expect(result.base[1]).toBeCloseTo(10100, 0);

    // After 12 months: 10000 * (1.01)^12
    const expected = 10000 * Math.pow(1.01, 12);
    expect(result.base[12]).toBeCloseTo(expected, 0);
  });

  test('buildForecastScenarios should handle events', () => {
    const now = Date.now();
    app.setAssets([
      {
        name: 'Static Asset',
        value: 10000,
        return: 0,
        dateAdded: now,
        startDate: now,
        frequency: 'none'
      }
    ]);

    // Add a windfall event at month 6
    const eventDate = new Date('2025-07-01').getTime();
    app.setSimEvents([
      {
        date: eventDate,
        amount: 5000,
        isPercent: false,
        label: 'Windfall'
      }
    ]);

    app.normalizeData();
    app.invalidateTaxCache();

    const result = app.buildForecastScenarios(1);

    // Before event
    expect(result.base[0]).toBe(10000);
    expect(result.base[5]).toBe(10000);

    // After event (event happens in July, which is month 6)
    expect(result.base[6]).toBe(15000);
    expect(result.base[12]).toBe(15000);
  });

  test('buildForecastScenarios should handle liabilities', () => {
    const now = Date.now();
    app.setAssets([]);
    app.setLiabilities([
      {
        name: 'Mortgage',
        value: 10000,
        interest: 0,
        monthlyPayment: 1000,
        dateAdded: now,
        startDate: now
      }
    ]);

    app.normalizeData();

    const result = app.buildForecastScenarios(1);

    // Month 0: -10000
    expect(result.base[0]).toBe(-10000);

    // Month 1: -9000 (after 1000 payment)
    expect(result.base[1]).toBe(-9000);

    // Month 10: 0
    expect(result.base[10]).toBe(0);
  });

  test('normalizeData should process incomes', () => {
    const income = {
      name: 'Salary',
      amount: 5000,
      frequency: 'monthly',
      dateAdded: '2025-01-01'
    };
    app.setIncomes([income]);
    app.normalizeData();

    const processedIncomes = app.getIncomes();
    expect(processedIncomes[0].monthlyAmount).toBe(5000);
  });

  test('buildForecastScenarios should include income and expenses', () => {
    const now = Date.now();
    app.setAssets([]);
    app.setIncomes([
      {
        name: 'Job',
        amount: 2000,
        frequency: 'monthly',
        dateAdded: now,
        startDate: now
      }
    ]);
    app.setExpenses([
      {
        name: 'Rent',
        amount: 1500,
        frequency: 'monthly',
        dateAdded: now,
        startDate: now
      }
    ]);

    app.normalizeData();

    // With 2000 income and 1500 expense, net cash flow is +500/mo
    const result = app.buildForecastScenarios(1);

    expect(result.base[0]).toBe(0);
    expect(result.base[1]).toBe(500);
    expect(result.base[12]).toBe(6000);
  });
});
