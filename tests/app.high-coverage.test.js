/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function bootApp() {
  jest.resetModules();
  document.open();
  document.write(html);
  document.close();
  localStorage.clear();

  global.GBP_CURRENCY = { symbol: '£' };
  global.ChartZoom = {};
  global.Chart = function Chart() {
    return {
      destroy() {},
      update() {},
      resetZoom() {},
      data: { datasets: [] },
      scales: { x: { min: 0, max: 12 } },
      options: {
        scales: {
          x: { min: 0, max: 12, time: {}, grid: {}, ticks: {} },
          y: { grid: {}, ticks: {} }
        },
        layout: { padding: { top: 0 } },
        plugins: { legend: { labels: {} }, title: {} }
      }
    };
  };
  global.Chart.defaults = { font: {} };
  global.Chart.register = jest.fn();

  Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({
      canvas: {},
      measureText: () => ({ width: 0 })
    })
  });

  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: jest.fn().mockResolvedValue({}),
      addEventListener: jest.fn(),
      controller: null
    }
  });

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ version: '1.1.91' })
  });

  global.URL.createObjectURL = jest.fn(() => 'blob:mock');
  global.URL.revokeObjectURL = jest.fn();
  global.alert = jest.fn();
  global.confirm = jest.fn(() => true);
  global.prompt = jest.fn(() => 'High Coverage Profile');
  global.STUDENT_LOAN_PLANS = {
    none: { threshold: Infinity, rate: 0 },
    plan1: { threshold: 24990, rate: 0.09 }
  };

  const app = require('../assets/js/app.js');
  document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
  window.dispatchEvent(new Event('load'));
  return app;
}

describe('App high-level coverage helpers', () => {
  test('calls additional exported flows to increase app.js coverage', () => {
    const app = bootApp();

    const now = Date.now();
    app.setAssets([
      {
        name: 'Pension',
        value: 12000,
        return: 6,
        lowGrowth: 3,
        highGrowth: 8,
        frequency: 'monthly',
        originalDeposit: 250,
        depositDay: 15,
        taxTreatment: 'taxed-income',
        includeInPassive: true,
        dateAdded: now - 5000,
        startDate: now - 5000
      }
    ]);
    app.setIncomes([
      {
        name: 'Salary',
        amount: 4500,
        frequency: 'monthly',
        dateAdded: now - 5000,
        startDate: now - 5000
      }
    ]);
    app.setExpenses([
      {
        name: 'Bills',
        amount: 1800,
        frequency: 'monthly',
        dateAdded: now - 5000,
        startDate: now - 5000
      }
    ]);
    app.setLiabilities([
      {
        name: 'Loan',
        value: 9000,
        interest: 4,
        monthlyPayment: 150,
        dateAdded: now - 5000,
        startDate: now - 5000
      }
    ]);
    app.setSimEvents([
      {
        date: now + 1000 * 60 * 60 * 24 * 45,
        amount: 5,
        isPercent: true,
        label: 'Market bump'
      }
    ]);

    app.normalizeData();
    app.invalidateTaxCache();

    expect(() => app.updateTotals()).not.toThrow();
    expect(() => app.updateTaxSettingsUI()).not.toThrow();
    expect(() => app.computeAssetTaxDetails()).not.toThrow();
    expect(() => app.applyTaxSettingsChanges({ refreshUI: true, clearCalculator: true })).not.toThrow();

    expect(() => app.updatePassiveIncome()).not.toThrow();
    expect(() => app.updateFireForecastCard()).not.toThrow();
    expect(() => app.refreshFireProjection()).not.toThrow();
    expect(() => app.runStressTest()).not.toThrow();
    expect(() => app.forecastGoalDate()).not.toThrow();

    expect(() => app.applyMobileNavSticky(false)).not.toThrow();
    expect(() => app.applyThemeChoice('glass')).not.toThrow();
    expect(() => app.applyDarkMode(true)).not.toThrow();
    expect(() => app.applyProfilePreferences()).not.toThrow();

    expect(() => app.buildForecastScenarios(5)).not.toThrow();
  });

  test('covers import normalization and parsing paths', () => {
    const app = bootApp();

    const normalized = app.normalizeImportedProfile({
      name: 'Imported Data',
      assets: [{ name: 'ETF', value: 1000 }],
      passiveIncomeSelection: ['100', '100', '200'],
      themeChoice: 'bad-choice',
      mobileNavSticky: null
    });

    expect(normalized.name).toBe('Imported Data');
    expect(normalized.assets[0].depositDay).toBe(31);
    expect(normalized.themeChoice).toBe('default');
    expect(normalized.passiveIncomeAssetSelection).toEqual([100, 200]);

    const prepared = app.prepareImportedProfiles({ profiles: [normalized], activeProfileId: normalized.id });
    expect(prepared.profiles).toHaveLength(1);

    const payload = JSON.stringify({
      id: 99,
      name: 'Single',
      assets: [{ name: 'Cash', value: 10 }],
      incomes: []
    });
    const parsed = app.parseImportPayload(payload, '');
    expect(parsed.profiles).toHaveLength(1);

    expect(() => app.loadPassiveAssetSelection(parsed.profiles[0])).not.toThrow();
    expect(() => app.saveCurrentProfile()).not.toThrow();
    expect(() => app.persist()).not.toThrow();
  });
});
