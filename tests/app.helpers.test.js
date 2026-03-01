/**
 * @jest-environment jsdom
 */

const app = require('../assets/js/app.js');

describe('App helper utilities coverage', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  test('storage helpers persist and read values', () => {
    const key = app.storageKey('sample');
    app.save(key, { ok: true });
    expect(app.load(key, null)).toEqual({ ok: true });
    expect(app.getLocalStorageItem(key)).toContain('ok');
  });

  test('getImportFileToken handles file-like values', () => {
    expect(app.getImportFileToken(null)).toBeNull();
    expect(
      app.getImportFileToken({ name: 'backup.json', size: 10, lastModified: 22 }),
    ).toBe('backup.json|10|22');
  });

  test('migrateStorageKeys upgrades legacy values', () => {
    localStorage.setItem('assets', '[1]');
    localStorage.setItem('cardCollapsed:abc', '1');

    app.migrateStorageKeys();

    expect(localStorage.getItem('assets')).toBeNull();
    expect(localStorage.getItem('wealthtrack:assets')).toBe('[1]');
    expect(localStorage.getItem('cardCollapsed:abc')).toBeNull();
    expect(localStorage.getItem('wealthtrack:cardCollapsed:abc')).toBe('1');
  });

  test('first-time content preference can be stored', () => {
    app.setStoredFirstTimeHidden(true);
    expect(app.getStoredFirstTimeHidden()).toBe(true);
    expect(app.isFirstTimeContentHidden({ firstTimeContentHidden: 0 })).toBe(false);
    expect(app.isFirstTimeContentHidden({ firstTimeContentHidden: 1 })).toBe(true);
  });

  test('normalizes card headings and import hint text', () => {
    document.body.innerHTML = `
      <div class="card"><h3>  Heading  </h3></div>
      <div id="importProfileHint"></div>
      <div id="importProfileHint"></div>
    `;

    app.normalizeCardHeadings();
    app.setImportProfileHint('Select a profile');

    expect(document.querySelector('.card h3').textContent).toBe('Heading');
    expect(
      Array.from(document.querySelectorAll('#importProfileHint')).map((el) => el.textContent),
    ).toEqual(['Select a profile', 'Select a profile']);
  });

  test('sanitizes theme and mobile nav settings', () => {
    expect(app.sanitizeThemeChoice('inverted')).toBe('inverted');
    expect(app.sanitizeThemeChoice('unknown')).toBe('default');

    expect(app.sanitizeMobileNavSticky(null, false)).toBe(false);
    expect(app.sanitizeMobileNavSticky(0, true)).toBe(false);

    localStorage.setItem(app.storageKey('mobileNavSticky'), '0');
    expect(app.readStoredMobileNavSticky()).toBe(false);
  });

  test('array and passive selection helpers sanitize values', () => {
    expect(app.ensureArray([1, 2])).toEqual([1, 2]);
    expect(app.ensureArray('x')).toEqual([]);

    expect(app.sanitizePassiveSelection([1, 1, 2], new Set([1, 2, 3]))).toEqual([1, 2]);
    expect(app.sanitizePassiveSelection([])).toEqual([]);
  });

  test('date and deposit helpers produce expected values', () => {
    expect(app.clampDepositDay(31)).toBe(31);
    expect(app.daysInMonth(2024, 1)).toBe(29);

    const base = app.buildDepositDate(2025, 1, 31);
    expect(new Date(base).getDate()).toBe(28);

    const next = app.addMonthsForDeposit(base, 1, 31);
    expect(new Date(next).getMonth()).toBe(2);

    const first = app.firstDepositOnOrAfter(new Date('2025-01-10T00:00:00Z').getTime(), 1, 31);
    expect(Number.isFinite(first)).toBe(true);

    const today = app.startOfToday();
    expect(new Date(today).getHours()).toBe(0);

    expect(app.toTimestamp('2025-01-01')).toBeGreaterThan(0);
    expect(app.parseDateInput('2025-01-01')).toBeGreaterThan(0);
    expect(app.toDateInputValue(new Date('2025-01-02T12:00:00Z'))).toBe('2025-01-02');
  });
});
