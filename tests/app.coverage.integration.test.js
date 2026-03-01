/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function setValue(id, value) {
  const input = document.getElementById(id);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function submit(formId) {
  const form = document.getElementById(formId);
  const controls = form.querySelectorAll('input, select, textarea, button');
  controls.forEach((control) => {
    if (control.id) {
      form[control.id] = control;
    }
  });
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('App integration flows for coverage', () => {
  beforeEach(() => {
    jest.resetModules();
    document.open();
    document.write(html);
    document.close();
    localStorage.clear();

    global.GBP_CURRENCY = 'GBP';
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
    global.prompt = jest.fn(() => 'Coverage Profile');
    global.STUDENT_LOAN_PLANS = { none: { threshold: Infinity }, plan1: { threshold: 24990, rate: 0.09 } };
    global.CryptoJS = {
      AES: {
        encrypt: jest.fn(() => ({ toString: () => 'encrypted-payload' })),
        decrypt: jest.fn(() => ({ toString: () => '{}' }))
      },
      enc: { Utf8: 'utf8' }
    };

  });

  test('exercises major interactive flows', async () => {
    require('../assets/js/app.js');

    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    window.dispatchEvent(new Event('load'));
    await Promise.resolve();

    const loadDemo = document.querySelector('[data-action="load-demo"]');
    if (loadDemo) loadDemo.click();
    const closeModal = document.querySelector('[data-action="close-modal"]');
    if (closeModal) closeModal.click();

    // Navigation/menu actions
    document.getElementById('menu-toggle').click();
    document.querySelector('[data-target="data-entry"]').click();
    document.querySelector('[data-target="forecasts"]').click();
    document.querySelector('[data-target="portfolio-analysis"]').click();
    document.querySelector('[data-target="calculators"]').click();
    document.querySelector('[data-target="settings"]').click();
    document.querySelector('[data-target="welcome"]').click();

    // Add income
    setValue('incomeName', 'Salary');
    setValue('incomeAmount', '5000');
    setValue('incomeFrequency', 'monthly');
    setValue('incomeStartDate', '2025-01-01');
    submit('incomeForm');

    // Add expense
    setValue('expenseName', 'Rent');
    setValue('expenseAmount', '1500');
    setValue('expenseFrequency', 'monthly');
    setValue('expenseStartDate', '2025-01-01');
    submit('expenseForm');

    // Add asset
    setValue('assetName', 'ISA');
    setValue('assetValue', '10000');
    setValue('assetReturn', '5');
    setValue('assetStartDate', '2025-01-01');
    setValue('assetTaxTreatment', 'tax-free');
    submit('assetForm');

    // Add liability
    setValue('liabilityName', 'Loan');
    setValue('liabilityValue', '3000');
    setValue('liabilityInterest', '2');
    setValue('liabilityPaymentAmount', '200');
    setValue('liabilityPaymentFrequency', 'monthly');
    setValue('liabilityStartDate', '2025-01-01');
    submit('liabilityForm');

    // Add event
    setValue('eventName', 'Windfall');
    setValue('eventDate', '2025-06-01');
    setValue('eventAmount', '1000');
    setValue('eventType', 'absolute');
    submit('eventForm');

    // Goal and forecast controls
    setValue('goalValue', '100000');
    setValue('goalYear', '2030');
    document.getElementById('goalBtn').click();
    submit('futurePortfolioForm');
    submit('inflationForm');
    submit('fireForecastForm');
    submit('stressTestForm');

    // Edit actions
    const editIncome = document.querySelector('[data-action="edit-income"]');
    if (editIncome) {
      editIncome.click();
      setValue('editIncomeName', 'Salary Updated');
      setValue('editIncomeAmount', '5200');
      submit('editIncomeFormModal');
    }

    const editExpense = document.querySelector('[data-action="edit-expense"]');
    if (editExpense) {
      editExpense.click();
      setValue('editExpenseName', 'Rent Updated');
      setValue('editExpenseAmount', '1600');
      submit('editExpenseFormModal');
    }

    const editAsset = document.querySelector('[data-action="edit-asset"]');
    if (editAsset) {
      editAsset.click();
      setValue('editAssetName', 'ISA Updated');
      setValue('editAssetValue', '12000');
      submit('editAssetFormModal');
    }

    const editLiability = document.querySelector('[data-action="edit-liability"]');
    if (editLiability) {
      editLiability.click();
      setValue('editLiabilityName', 'Loan Updated');
      setValue('editLiabilityValue', '2800');
      submit('editLiabilityFormModal');
    }

    // Calculator forms
    setValue('take-home-income', '50000');
    setValue('take-home-frequency', 'annual');
    setValue('take-home-student-loan', 'plan1');
    submit('takeHomePayForm');


    setValue('taxAssetValue', '10000');
    setValue('taxAssetReturn', '5');
    setValue('taxAssetTreatment', 'dividend');
    submit('taxImpactForm');

    setValue('stock-price', '100');
    setValue('target-return', '10');
    submit('stockProfitForm');

    setValue('stock-price-profit', '100');
    setValue('stock-shares-profit', '1000');
    setValue('target-profit', '500');
    submit('stockProfitAmountForm');

    setValue('ci-principal', '1000');
    setValue('ci-rate', '5');
    setValue('ci-years', '10');
    setValue('ci-contribution', '50');
    submit('compoundForm');

    setValue('si-principal', '1000');
    setValue('si-rate', '5');
    setValue('si-years', '10');
    submit('simpleInterestForm');

    setValue('passive-income-amount', '1500');
    setValue('passive-income-frequency', 'monthly');
    setValue('passive-income-return', '4');
    submit('passiveIncomeTargetForm');

    setValue('interest-difference-amount', '10000');
    setValue('interest-rate-a', '3');
    setValue('interest-rate-b', '4');
    submit('interestRateDifferenceForm');

    setValue('fireLivingExpenses', '30000');
    setValue('fireExpensesFrequency', 'annual');
    setValue('fireWithdrawalRate', '4');
    submit('fireForm');

    // Snapshot and profile actions
    document.getElementById('snapshotBtn').click();
    const exportPassword = document.getElementById('exportPassword');
    if (exportPassword) exportPassword.value = 'secret';
    const exportBtn = document.querySelector('[data-action="export-data"]');
    if (exportBtn) exportBtn.click();
    if (exportPassword) exportPassword.value = '';
    if (exportBtn) exportBtn.click();

    const updateBtn = document.querySelector('[data-action="update-app"]');
    if (updateBtn) updateBtn.click();

    document.getElementById('addProfileBtn').click();
    document.getElementById('renameProfileBtn').click();


    const goForecasts = document.querySelector('[data-action="go-forecasts"]');
    if (goForecasts) goForecasts.click();
    const goSettings = document.querySelector('[data-action="go-settings"]');
    if (goSettings) goSettings.click();
    const startNow = document.getElementById('startNowBtn');
    if (startNow) startNow.click();

    expect(document.getElementById('incomeTableBody').textContent).toContain('Salary');
    expect(document.getElementById('expenseTableBody').textContent).toContain('Rent');
    expect(document.getElementById('assetTableBody').textContent).toContain('ISA');
    expect(document.getElementById('liabilityTableBody').textContent).toContain('Loan');
    expect(document.getElementById('stockProfitResult').textContent.length).toBeGreaterThan(0);
    expect(document.getElementById('fireResult').textContent.length).toBeGreaterThan(0);
  });
});
