const app = require('../assets/js/app.js');

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
  });

  test('getTaxYearConfig', () => {
    expect(app.getTaxYearConfig('2024')).toBeDefined();
    expect(app.getTaxYearConfig('2025')).toHaveProperty('basicLimit', 50270);
    expect(app.getTaxYearConfig('unknown')).toBeDefined();
  });

  test('getAllowanceFromTaxCode', () => {
    expect(app.getAllowanceFromTaxCode('1257L')).toBe(12570);
    expect(app.getAllowanceFromTaxCode('1000L')).toBe(10000);
    expect(app.getAllowanceFromTaxCode('BR')).toBe(12570); // the function returns 12570 for invalid or 0
    expect(app.getAllowanceFromTaxCode('invalid')).toBe(12570);
  });

  test('formatGrossNetRate', () => {
    expect(app.formatGrossNetRate(5.5)).toBe('5.5%');
    expect(app.formatGrossNetRate(5.5, 4.4)).toBe('5.5% \u2192 4.4% after tax');
  });

  test('getGrossRate', () => {
    const asset1 = { return: 5, lowGrowth: 3, highGrowth: 8 };
    expect(app.getGrossRate(asset1, 'base')).toBe(5);
    expect(app.getGrossRate(asset1, 'low')).toBe(3);
    expect(app.getGrossRate(asset1, 'high')).toBe(8);
    expect(app.getGrossRate({}, 'base')).toBe(0);
    expect(app.getGrossRate(null)).toBe(0);
  });
});
