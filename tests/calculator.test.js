const app = require('../assets/js/app.js');

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
  });

  test('calculateUkNi', () => {
    expect(app.calculateUkNi(10000)).toBe(0);
    expect(app.calculateUkNi(30000)).toBeCloseTo(1394.4, 2);
    expect(app.calculateUkNi(60000)).toBeCloseTo(3210.6, 2);
  });

  test('calculateStudentLoanRepayment', () => {
    expect(app.calculateStudentLoanRepayment(50000, 'none')).toBe(0);
    const plan1Expected = (50000 - 24990) * 0.09;
    expect(app.calculateStudentLoanRepayment(50000, 'plan1')).toBeCloseTo(plan1Expected, 2);
    expect(app.calculateStudentLoanRepayment(20000, 'plan1')).toBe(0);
  });

  test('calculateFutureValueFreq', () => {
    // P, contributionPerPeriod, annualRate, years, periodsPerYear
    // $1000, 0 cont, 5% rate, 1 year, 1 period/yr
    const fv = app.calculateFutureValueFreq(1000, 0, 5, 1, 1);
    expect(fv).toBeCloseTo(1050, 2);

    // With regular contributions: $1000, $100/mo, 5% annual, 1 year, 12 periods/yr
    const fvWithPmts = app.calculateFutureValueFreq(1000, 100, 5, 1, 12);
    expect(fvWithPmts).toBeGreaterThan(1050 + 1200); // Actually with interest it will be a bit more
  });
});
