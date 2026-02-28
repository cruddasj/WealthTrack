const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('WealthTrack app.js Pure Functions', () => {
  let dom;
  let window;
  let document;

  beforeAll(() => {
    const htmlPath = path.resolve(__dirname, '../index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // Create DOM and a mock global environment for app.js
    dom = new JSDOM(htmlContent, {
      url: 'http://localhost/',
      runScripts: 'dangerously'
    });
    window = dom.window;
    document = window.document;

    // Provide mock objects that app.js expects to be present in the window/global scope
    window.CryptoJS = {
      AES: {
        encrypt: () => ({ toString: () => 'encrypted' }),
        decrypt: () => ({ toString: () => '{"profiles":[]}' })
      },
      enc: {
        Utf8: {}
      }
    };

    window.Chart = function() {};
    window.Chart.register = function() {};
    window.Chart.defaults = { font: {}, color: '' };
    window.ChartZoom = {};

    // Provide polyfills / mocks if needed
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ version: '1.0.0' })
    }));
    window.URL.createObjectURL = jest.fn();

    const scriptPath = path.resolve(__dirname, '../assets/js/app.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

    // Evaluate the script within JSDOM
    const scriptEl = document.createElement('script');
    // Ensure `const` declarations in app.js at the top-level are attached to `window` for testing
    // By wrapping them, or running it without block-scope isolation, or replacing `const` with `var`.
    // Alternatively, just replace the few `const` we want to test with `var`.
    let modifiedScript = scriptContent.replace(/^const fmtCurrency =/m, 'window.fmtCurrency =');
    modifiedScript = modifiedScript.replace(/^const fmtPercent =/m, 'window.fmtPercent =');

    // We also need calculateUkIncomeTax, calculateUkNi, calculateStudentLoanRepayment
    // They are declared as `function calculateUkIncomeTax`, which should normally hoist to window,
    // but just to be sure we can test them too since they passed, they must be attached to window correctly.

    scriptEl.textContent = modifiedScript;
    document.head.appendChild(scriptEl);
  });

  test('fmtCurrency formats numbers correctly', () => {
    // fmtCurrency formats to GBP. Ensure we capture the result.
    const result = window.fmtCurrency(1234.56);
    expect(result).toMatch(/£1,234.56/);

    const zeroResult = window.fmtCurrency(0);
    expect(zeroResult).toMatch(/£0.00/);

    const negativeResult = window.fmtCurrency(-50);
    expect(negativeResult).toMatch(/-£50.00/);
  });

  test('fmtPercent formats percentages correctly', () => {
    const result = window.fmtPercent(5.678);
    expect(result).toBe('5.68%');

    const negResult = window.fmtPercent(-3.14159);
    expect(negResult).toBe('-3.14%');

    const zeroResult = window.fmtPercent(0);
    expect(zeroResult).toBe('0%');
  });

  test('calculateStudentLoanRepayment computes correctly', () => {
    // none: 0
    expect(window.calculateStudentLoanRepayment(50000, 'none')).toBe(0);

    // plan1: { threshold: 24990, rate: 0.09 }
    const plan1Expected = (50000 - 24990) * 0.09;
    expect(window.calculateStudentLoanRepayment(50000, 'plan1')).toBeCloseTo(plan1Expected, 2);

    // Income below threshold
    expect(window.calculateStudentLoanRepayment(20000, 'plan1')).toBe(0);
  });

  test('calculateUkIncomeTax computes basic tax bands', () => {
    // TAX_YEAR_THRESHOLDS[2025]: { basicLimit: 50270, higherLimit: 125140 }

    // Below personal allowance
    const pa = 12570;
    expect(window.calculateUkIncomeTax(10000, pa)).toBe(0);

    // Basic rate (20% on income above PA up to 50270)
    // Income 30000, PA 12570 -> taxable 17430
    // Tax = 17430 * 0.2 = 3486
    expect(window.calculateUkIncomeTax(30000, pa)).toBeCloseTo(3486, 2);

    // Higher rate (40% on income above 50270 up to 125140)
    // Income 60000. PA 12570.
    // Basic band: (50270 - 12570) = 37700 * 0.2 = 7540
    // Higher band: (60000 - 50270) = 9730 * 0.4 = 3892
    // Total = 11432
    expect(window.calculateUkIncomeTax(60000, pa)).toBeCloseTo(11432, 2);
  });

  test('calculateUkNi computes national insurance', () => {
    // primaryNiThreshold: 12570, upperNiThreshold: 50270
    // Below primary
    expect(window.calculateUkNi(10000)).toBe(0);

    // Between primary and upper: 8% on (income - 12570)
    // Income 30000. (30000 - 12570) = 17430. 17430 * 0.08 = 1394.4
    expect(window.calculateUkNi(30000)).toBeCloseTo(1394.4, 2);

    // Above upper: 2% on (income - 50270) + main band
    // Income 60000.
    // Main band: (50270 - 12570) = 37700 * 0.08 = 3016
    // Upper band: (60000 - 50270) = 9730 * 0.02 = 194.6
    // Total = 3210.6
    expect(window.calculateUkNi(60000)).toBeCloseTo(3210.6, 2);
  });
});
