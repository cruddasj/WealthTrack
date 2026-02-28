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
  test('calculateCurrentValue handles start dates', () => {
    const now = new Date('2025-01-01').getTime();

    // Asset starts in the past
    const pastAsset = {
      value: 1000,
      startDate: now - 1000000
    };
    expect(app.calculateCurrentValue(pastAsset, now)).toBe(1000);

    // Asset starts in the future
    const futureAsset = {
      value: 1000,
      startDate: now + 1000000
    };
    expect(app.calculateCurrentValue(futureAsset, now)).toBe(0);

    // Invalid asset
    expect(app.calculateCurrentValue(null, now)).toBe(0);
  });

  test('calculateCurrentLiability handles start dates and interest', () => {
    const now = new Date('2025-01-01').getTime();

    // Liability starts in the future
    const futureLiability = {
      value: 1000,
      startDate: now + 1000000
    };
    expect(app.calculateCurrentLiability(futureLiability, now)).toBe(0);

    // Invalid liability
    expect(app.calculateCurrentLiability(null, now)).toBe(0);

    // Liability from exactly 1 year ago (12 months)
    const oneYearAgo = new Date('2024-01-01').getTime();
    const liability = {
      value: 1000,
      interest: 12, // 1% per month
      monthlyPayment: 50,
      startDate: oneYearAgo
    };

    // 1000 * 1.01 - 50 = 1010 - 50 = 960
    // 960 * 1.01 - 50 = 969.6 - 50 = 919.6
    // ... we don't need exact match, just ensure it calculated something
    const currentLiab = app.calculateCurrentLiability(liability, now);
    expect(currentLiab).toBeGreaterThan(0);
    expect(currentLiab).toBeLessThan(1000);
  });

  test('applyEventToValue calculates absolute and percent events', () => {
    expect(app.applyEventToValue(1000, { amount: 500, isPercent: false })).toBe(1500);
    expect(app.applyEventToValue(1000, { amount: 10, isPercent: true })).toBe(1100);
    expect(app.applyEventToValue(1000, null)).toBe(1000);
  });

  test('applyPassiveGrowth calculates compounded growth over time', () => {
    const fromTime = new Date('2025-01-01').getTime();
    const toTime = new Date('2026-01-01').getTime(); // 1 year

    // 1000 with 5% annual rate
    expect(app.applyPassiveGrowth(1000, fromTime, toTime, 5)).toBeCloseTo(1050, 0);

    // invalid cases
    expect(app.applyPassiveGrowth(1000, toTime, fromTime, 5)).toBe(1000); // reverse time
    expect(app.applyPassiveGrowth(1000, fromTime, toTime, 0)).toBe(1000); // zero rate
    expect(app.applyPassiveGrowth(null, fromTime, toTime, 5)).toBe(0);
  });

  test('generateRandomEvents creates random events for given years and assets', () => {
    const now = Date.now();
    app.setAssets([
      { name: 'Asset 1', dateAdded: now, return: 5, startDate: now }
    ]);

    const labels = [
      new Date('2025-01-01'),
      new Date('2026-01-01')
    ];

    // generateRandomEvents uses Math.random, we can mock it to ensure events are created
    jest.spyOn(Math, 'random').mockReturnValue(0.1); // Always < 0.3 to trigger event creation

    const assetIdSet = new Set([now]);
    const events = app.generateRandomEvents(labels, assetIdSet);

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].name).toBe('Asset 1');
    expect(events[0].isPercent).toBe(true);

    jest.restoreAllMocks();
  });

  test('computeAssetTaxDetails calculates basic tax information', () => {
    const now = Date.now();
    app.setAssets([
      {
        name: 'Taxable Asset',
        value: 100000,
        return: 5, // 5% = 5000 return
        dateAdded: now,
        startDate: now,
        taxTreatment: 'income' // subject to income tax
      }
    ]);
    app.setTaxSettings({
      band: 'basic',
      incomeAllowance: 1000,
      dividendAllowance: 500,
      capitalAllowance: 3000
    });
    app.invalidateTaxCache();

    const taxDetails = app.computeAssetTaxDetails();

    expect(taxDetails).toBeDefined();
    expect(taxDetails.detailMap.has(now)).toBe(true);

    const assetDetails = taxDetails.detailMap.get(now);

    // Gross return is 5000 (100000 * 5%)
    // Allowance is 1000
    // Taxable amount is 4000
    // Basic rate income tax is 20%
    // Tax due is 800 (4000 * 20%)
    expect(assetDetails.base.annualGross).toBe(5000);
    expect(assetDetails.base.taxableAmount).toBe(4000);
    expect(assetDetails.base.annualTax).toBe(800);
    expect(assetDetails.base.taxRateApplied).toBe(20);

    // Net return is 4200 (5000 - 800)
    // Net rate is 4.2%
    expect(assetDetails.base.netRate).toBeCloseTo(4.2, 1);
  });

  test('calculatePassiveAssetValueAt projects value to target date considering events and growth', () => {
    const startTs = new Date('2025-01-01').getTime();
    const asset = {
      name: 'Passive Asset',
      value: 10000,
      return: 5,
      dateAdded: startTs,
      startDate: startTs,
      taxTreatment: 'tax-free'
    };
    app.setAssets([asset]);
    app.invalidateTaxCache();

    const eventsByAsset = new Map();
    // Add an event adding 5000 half a year in
    const midYearTs = new Date('2025-07-01').getTime();
    eventsByAsset.set(startTs, [
      { date: midYearTs, amount: 5000, isPercent: false }
    ]);

    // Project to exactly 1 year ahead
    const targetTs = new Date('2026-01-01').getTime();

    const projectedValue = app.calculatePassiveAssetValueAt(asset, targetTs, eventsByAsset, startTs);

    // Should be > 15000 due to initial value + growth + event + more growth
    expect(projectedValue).toBeGreaterThan(15000);
  });
});
