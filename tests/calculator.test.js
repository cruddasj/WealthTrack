const app = require('../assets/js/utilities.js');

describe('Calculator Functions', () => {
  test('calculatePersonalAllowance', () => {
    // Basic allowance
    expect(app.calculatePersonalAllowance('1257L', 50000)).toBe(12570);
    // Over 100k taper start
    expect(app.calculatePersonalAllowance('1257L', 110000)).toBe(12570 - (10000 / 2));
    expect(app.calculatePersonalAllowance('1257L', 150000)).toBe(0);
  });

  test('calculateUkIncomeTax', () => {
    // From earlier: basic limit 50270, higher 125140
    const pa = 12570;
    expect(app.calculateUkIncomeTax(10000, pa)).toBe(0);
    expect(app.calculateUkIncomeTax(30000, pa)).toBeCloseTo(3486, 2);
    expect(app.calculateUkIncomeTax(60000, pa)).toBeCloseTo(11432, 2);

    // Test with custom thresholds
    const customThresholds = { basicLimit: 20000, higherLimit: 50000 };
    expect(app.calculateUkIncomeTax(60000, 10000, customThresholds)).toBeGreaterThan(0);

    // Test with missing cfg properties (though it defaults)
    expect(app.calculateUkIncomeTax(60000, 10000, {})).toBeGreaterThan(0);
  });

  test('calculateUkNi', () => {
    expect(app.calculateUkNi(10000)).toBe(0);
    expect(app.calculateUkNi(30000)).toBeCloseTo(1394.4, 2);
    expect(app.calculateUkNi(60000)).toBeCloseTo(3210.6, 2);

    // Test with custom thresholds
    const customThresholds = { primaryNiThreshold: 5000, upperNiThreshold: 20000 };
    expect(app.calculateUkNi(30000, customThresholds)).toBeGreaterThan(0);
  });

  test('calculateStudentLoanRepayment', () => {
    expect(app.calculateStudentLoanRepayment(50000, 'none')).toBe(0);
    const plan1Expected = (50000 - 24990) * 0.09;
    expect(app.calculateStudentLoanRepayment(50000, 'plan1')).toBeCloseTo(plan1Expected, 2);
    expect(app.calculateStudentLoanRepayment(20000, 'plan1')).toBe(0);

    // Cover missing planKey
    expect(app.calculateStudentLoanRepayment(50000, 'unknown')).toBe(0);
  });

  test('calculateFutureValueFreq', () => {
    // P, contributionPerPeriod, annualRate, years, periodsPerYear
    // $1000, 0 cont, 5% rate, 1 year, 1 period/yr
    const fv = app.calculateFutureValueFreq(1000, 0, 5, 1, 1);
    expect(fv).toBeCloseTo(1050, 2);

    // With regular contributions: $1000, $100/mo, 5% annual, 1 year, 12 periods/yr
    const fvWithPmts = app.calculateFutureValueFreq(1000, 100, 5, 1, 12);
    expect(fvWithPmts).toBeGreaterThan(1050 + 1200); // Actually with interest it will be a bit more

    // With 0 rate
    expect(app.calculateFutureValueFreq(1000, 100, 0, 1, 12)).toBe(1000 + 100 * 12);
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

  test('calculateUkNi falls back to default threshold values when config keys are missing', () => {
    const withEmptyConfig = app.calculateUkNi(20000, {});
    const withDefaultConfig = app.calculateUkNi(20000);
    expect(withEmptyConfig).toBeCloseTo(withDefaultConfig, 2);

    const withOnlyPrimaryThreshold = app.calculateUkNi(60000, { primaryNiThreshold: 10000 });
    expect(withOnlyPrimaryThreshold).toBeGreaterThan(withDefaultConfig);
  });

  test('calculateFutureValueFreq uses monthly defaults when periods are omitted or zero', () => {
    expect(app.calculateFutureValueFreq(1000, 100, 0, 1)).toBe(2200);
    expect(app.calculateFutureValueFreq(1000, 100, 0, 1, 0)).toBe(2200);
  });
});
