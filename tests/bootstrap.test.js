/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

describe('App bootstrap and page wiring', () => {
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
        resetZoom() {}
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
      json: async () => ({ version: '1.1.90' })
    });

    global.URL.createObjectURL = jest.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = jest.fn();
  });

  test('initializes on DOMContentLoaded and load without runtime errors', async () => {
    const app = require('../assets/js/app.js');

    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    window.dispatchEvent(new Event('load'));
    await Promise.resolve();

    expect(app.getAssets()).toEqual([]);
    expect(app.getIncomes()).toEqual([]);
    expect(app.getExpenses()).toEqual([]);
    expect(app.getLiabilities()).toEqual([]);

    expect(global.Chart.register).toHaveBeenCalledWith(global.ChartZoom);
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('service-worker.js');
  });
});
