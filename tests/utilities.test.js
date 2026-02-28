const app = require('../assets/js/utilities.js');

describe('Utility/Tax Functions', () => {
  test('toNonNegativeNumber', () => {
    expect(app.toNonNegativeNumber(10)).toBe(10);
    expect(app.toNonNegativeNumber(-5)).toBe(0);
    expect(app.toNonNegativeNumber('abc', 10)).toBe(10);
    expect(app.toNonNegativeNumber('abc')).toBe(0);
  });

  test('normalizeTaxTreatment', () => {
    expect(app.normalizeTaxTreatment('income')).toBe('income');
    expect(app.normalizeTaxTreatment('dividend')).toBe('dividend');
    expect(app.normalizeTaxTreatment('unknown')).toBe('tax-free');
    expect(app.normalizeTaxTreatment()).toBe('tax-free');
  });

  test('getTaxTreatmentMeta', () => {
    expect(app.getTaxTreatmentMeta('tax-free')).toHaveProperty('label', 'Tax-free or sheltered (ISA, pension)');
    expect(app.getTaxTreatmentMeta('income')).toHaveProperty('label', 'Income tax (interest, rent, bonds)');
    expect(app.getTaxTreatmentMeta('unknown_treatment')).toHaveProperty('label', 'Tax-free or sheltered (ISA, pension)');
  });

  test('normalizeTaxSettings', () => {
    const defaultSettings = app.normalizeTaxSettings();
    expect(defaultSettings.band).toBeDefined();
    expect(defaultSettings.incomeAllowance).toBeGreaterThanOrEqual(0);
    expect(defaultSettings.dividendAllowance).toBeGreaterThanOrEqual(0);
    expect(defaultSettings.capitalAllowance).toBeGreaterThanOrEqual(0);

    const mergedSettings = app.normalizeTaxSettings({
      band: 'higher',
      incomeAllowance: 500
    });
    expect(mergedSettings.band).toBe('higher');
    expect(mergedSettings.incomeAllowance).toBe(500);

    const invalidSettings = app.normalizeTaxSettings(null);
    expect(invalidSettings.band).toBe('basic');
  });

  test('getTaxYearConfig', () => {
    expect(app.getTaxYearConfig('2024')).toBeDefined();
    expect(app.getTaxYearConfig('2025')).toHaveProperty('basicLimit', 50270);
    expect(app.getTaxYearConfig('unknown')).toBeDefined();
    expect(app.getTaxYearConfig(2025).key).toBe(2025);
  });

  test('getAllowanceFromTaxCode', () => {
    expect(app.getAllowanceFromTaxCode('1257L')).toBe(12570);
    expect(app.getAllowanceFromTaxCode('1000L')).toBe(10000);
    expect(app.getAllowanceFromTaxCode('BR')).toBe(12570); // the function returns 12570 for invalid or 0
    expect(app.getAllowanceFromTaxCode('invalid')).toBe(12570);
    expect(app.getAllowanceFromTaxCode(null)).toBe(12570);
  });

  test('formatGrossNetRate', () => {
    expect(app.formatGrossNetRate(5.5)).toBe('5.5%');
    expect(app.formatGrossNetRate('invalid')).toBe('0%');
    expect(app.formatGrossNetRate(5.5, 4.4)).toBe('5.5% → 4.4% after tax');
    expect(app.formatGrossNetRate(5.5, 5.5)).toBe('5.5%');
    expect(app.formatGrossNetRate(5.5, 'invalid')).toBe('5.5%');
  });

  test('getGrossRate', () => {
    const asset1 = { return: 5, lowGrowth: 3, highGrowth: 8 };
    expect(app.getGrossRate(asset1, 'base')).toBe(5);
    expect(app.getGrossRate(asset1, 'low')).toBe(3);
    expect(app.getGrossRate(asset1, 'high')).toBe(8);
    expect(app.getGrossRate({}, 'base')).toBe(0);
    expect(app.getGrossRate(null)).toBe(0);

    // Testing defaults when low/high are null
    const asset2 = { return: 6 };
    expect(app.getGrossRate(asset2, 'low')).toBe(6);
    expect(app.getGrossRate(asset2, 'high')).toBe(6);
    expect(app.getGrossRate(asset2, 'unknown')).toBe(6);

    const asset3 = { return: 6, lowGrowth: 'invalid', highGrowth: 'invalid' };
    expect(app.getGrossRate(asset3, 'low')).toBe(6);
    expect(app.getGrossRate(asset3, 'high')).toBe(6);
  });

  test('fmtCurrency', () => {
    expect(app.fmtCurrency(1000)).toContain('£1,000.00');
    expect(app.fmtCurrency('2000')).toContain('£2,000.00');
    expect(app.fmtCurrency(null)).toContain('£0.00');
    expect(app.fmtCurrency(undefined)).toContain('£0.00');
    expect(app.fmtCurrency('abc')).toContain('£0.00');
  });

  test('fmtPercent', () => {
    expect(app.fmtPercent(5)).toBe('5%');
    expect(app.fmtPercent(5.1234, { digits: 2 })).toBe('5.12%');
    expect(app.fmtPercent(5, { signed: true })).toBe('+5%');
    expect(app.fmtPercent(-5)).toBe('-5%');
    expect(app.fmtPercent(0)).toBe('0%');
    expect(app.fmtPercent('invalid')).toBe('0%');
  });

  test('parseCssNumber', () => {
    expect(app.parseCssNumber('10px')).toBe(10);
    expect(app.parseCssNumber('5.5')).toBe(5.5);
    expect(app.parseCssNumber('abc')).toBe(0);
    expect(app.parseCssNumber(10)).toBe(0); // only handles strings
  });

  test('formatDateForInput', () => {
    const date = new Date(2023, 0, 1); // Jan 1st 2023
    expect(app.formatDateForInput(date)).toBe('2023-01-01');
  });

  test('formatChangelogDate', () => {
    expect(app.formatChangelogDate(null)).toBeNull();
    expect(app.formatChangelogDate('2023-01-01')).toBeDefined();
    expect(app.formatChangelogDate('invalid')).toBe('invalid');

    // Simulate error in toLocaleDateString
    const invalidDate = {
      getTime: () => 1000,
      toLocaleDateString: (locales, options) => {
        if (options) throw new Error();
        return 'fallback';
      }
    };
    // Need to mock Date for this.
    const originalDate = global.Date;
    global.Date = jest.fn(() => invalidDate);
    expect(app.formatChangelogDate('anything')).toBe('fallback');
    global.Date = originalDate;
  });

  test('compareAppVersions', () => {
    expect(app.compareAppVersions('1.0.0', '1.0.0')).toBe(0);
    expect(app.compareAppVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(app.compareAppVersions('1.1.0', '1.0.1')).toBe(1);
    expect(app.compareAppVersions('1.0.0', '1.0')).toBe(0);
    expect(app.compareAppVersions('1.0', '1.0.0')).toBe(0);
    expect(app.compareAppVersions('1.0-alpha', '1.0-beta')).toBe(-1);
    expect(app.compareAppVersions(null, '1.0.0')).toBe(-1);
    expect(app.compareAppVersions('1.0.0', null)).toBe(1);
    expect(app.compareAppVersions(null, null)).toBe(0);

    // Test different part types
    expect(app.compareAppVersions('1.0.0', '1.0.a')).toBe(-1);
    expect(app.compareAppVersions('1.0.a', '1.0.b')).toBe(-1);
    expect(app.compareAppVersions('1.0.a', '1.0.a')).toBe(0);
  });

  test('normalizeAppVersion', () => {
    expect(app.normalizeAppVersion('v1.0.0')).toBe('1.0.0');
    expect(app.normalizeAppVersion('  V1.2.3  ')).toBe('1.2.3');
    expect(app.normalizeAppVersion('')).toBeNull();
    expect(app.normalizeAppVersion(null)).toBeNull();
  });

  test('randomNormal', () => {
    const val = app.randomNormal(0, 1);
    expect(typeof val).toBe('number');
  });

  test('getBandSummary', () => {
    const summary = app.getBandSummary('basic');
    expect(summary).toContain('Basic rate');
    expect(summary).toContain('20% income');
  });

  test('formatPercent', () => {
    expect(app.formatPercent(0.5)).toBe('0.5%');
    expect(app.formatPercent(5)).toBe('5%');
    expect(app.formatPercent('invalid')).toBe('0%');
  });

  test('toNonNegativeNumber handles invalid and negative values', () => {
    expect(app.toNonNegativeNumber('12.5')).toBe(12.5);
    expect(app.toNonNegativeNumber(-1)).toBe(0);
    expect(app.toNonNegativeNumber('invalid', 99)).toBe(99);
  });

  test('fmtPercent applies defaults for non-finite and signed values', () => {
    expect(app.fmtPercent(Infinity)).toBe('0%');
    expect(app.fmtPercent(2.345, { digits: 1 })).toBe('2.3%');
    expect(app.fmtPercent(2.345, { digits: 1, signed: true })).toBe('+2.3%');
  });

  test('getTaxBandConfig falls back to basic band for unknown keys', () => {
    expect(app.getTaxBandConfig('not-a-band').incomeRate).toBe(20);
    expect(app.getTaxBandConfig('additional').incomeRate).toBe(45);
  });

  test('normalizeTaxTreatment and getTaxTreatmentMeta default safely', () => {
    expect(app.normalizeTaxTreatment('income')).toBe('income');
    expect(app.normalizeTaxTreatment('made-up')).toBe('tax-free');
    expect(app.getTaxTreatmentMeta('capital-gains').allowanceKey).toBe('capital');
    expect(app.getTaxTreatmentMeta('unknown').allowanceLabel).toBe('No allowance needed');
  });

  test('toAppVersionParts splits semantic and prerelease components', () => {
    expect(app.toAppVersionParts('1.2.3-beta.4')).toEqual([1, 2, 3, 'beta', 4]);
    expect(app.toAppVersionParts(123)).toEqual([]);
  });

  test('calculateStudentLoanRepayment includes all supported plans', () => {
    expect(app.calculateStudentLoanRepayment(32000, 'plan4')).toBeCloseTo((32000 - 31295) * 0.09, 2);
    expect(app.calculateStudentLoanRepayment(26000, 'plan5')).toBeCloseTo((26000 - 25000) * 0.09, 2);
    expect(app.calculateStudentLoanRepayment(22000, 'postgrad')).toBeCloseTo((22000 - 21000) * 0.06, 2);
  });

  test('calculateUkIncomeTax and calculateUkNi respect fallback thresholds', () => {
    const tax = app.calculateUkIncomeTax(70000, 12570, { basicLimit: 37700, higherLimit: 80000 });
    const ni = app.calculateUkNi(70000, { primaryNiThreshold: 10000, upperNiThreshold: 50000 });
    expect(tax).toBeGreaterThan(0);
    expect(ni).toBeGreaterThan(0);
  });
});
