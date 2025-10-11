'use strict';

const LS_KEYS = {
  seenVersion: 'template.lastSeenVersion',
  darkMode: 'template.darkMode',
  themeChoice: 'template.themeChoice',
  navSticky: 'template.navSticky',
};

const THEMES = {
  default: {
    label: 'Default',
  },
  inverted: {
    label: 'Inverted',
  },
  glass: {
    label: 'Glass',
  },
};

const state = {
  latestVersion: null,
  changelog: [],
  checkingUpdates: false,
  updateError: false,
  metadataLoaded: false,
};

let lastSeenVersion = null;
let isDarkMode = false;
let currentThemeChoice = 'default';
let isMobileNavSticky = true;
const desktopQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(min-width: 768px)')
  : null;
let mobileNavOpen = false;

function isDesktop() {
  return Boolean(desktopQuery && desktopQuery.matches);
}

function onMediaQueryChange(query, handler) {
  if (!query || typeof handler !== 'function') return;
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', handler);
  } else if (typeof query.addListener === 'function') {
    query.addListener(handler);
  }
}

function updateSidebarForViewport() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.querySelector('[data-nav-overlay]');
  const toggleBtn = document.querySelector('[data-action="toggle-sidebar"]');
  const showSidebar = mobileNavOpen || isDesktop();
  if (sidebar) {
    sidebar.classList.toggle('-translate-x-full', !showSidebar);
    sidebar.setAttribute('aria-hidden', showSidebar ? 'false' : 'true');
  }
  const showOverlay = mobileNavOpen && !isDesktop();
  if (overlay) {
    overlay.hidden = !showOverlay;
    overlay.setAttribute('aria-hidden', showOverlay ? 'false' : 'true');
    overlay.classList.toggle('hidden', !showOverlay);
  }
  if (document.body) {
    document.body.classList.toggle('mobile-nav-open', showOverlay);
  }
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-expanded', showOverlay ? 'true' : 'false');
  }
}

function setMobileSidebar(open) {
  mobileNavOpen = Boolean(open);
  updateSidebarForViewport();
  if (mobileNavOpen && !isDesktop()) {
    const activeButton = document.querySelector('[data-nav-target].active');
    const fallbackButton = document.querySelector('[data-nav-target]');
    const focusTarget = activeButton || fallbackButton;
    if (focusTarget) focusTarget.focus();
  }
}

function safeLoad(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function safeStore(key, value) {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch (_) {
    // ignore storage errors (Safari private mode, etc.)
  }
}

function normalizeVersion(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return match.slice(1).map((part) => Number.parseInt(part, 10));
}

function versionToString(parts) {
  if (!Array.isArray(parts) || parts.length !== 3) return null;
  return parts.join('.');
}

function compareVersions(a, b) {
  const pa = normalizeVersion(Array.isArray(a) ? versionToString(a) : a);
  const pb = normalizeVersion(Array.isArray(b) ? versionToString(b) : b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < pa.length; i += 1) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (_) {
    return value;
  }
}

function setDarkMode(enabled, { persist = true } = {}) {
  isDarkMode = Boolean(enabled);
  document.documentElement.classList.toggle('dark', isDarkMode);
  document.body.classList.toggle('dark', isDarkMode);
  if (persist) safeStore(LS_KEYS.darkMode, isDarkMode ? '1' : '0');
  document.querySelectorAll('[data-theme-toggle]').forEach((toggle) => {
    toggle.checked = isDarkMode;
    toggle.setAttribute('aria-checked', isDarkMode ? 'true' : 'false');
  });
}

function applyMobileNavSticky(enabled, { persist = true } = {}) {
  const normalized = Boolean(enabled);
  isMobileNavSticky = normalized;
  document.body.classList.toggle('mobile-header-static', !normalized);
  const toggle = document.getElementById('mobileNavStickyToggle');
  if (toggle && toggle.checked !== normalized) {
    toggle.checked = normalized;
  }
  if (persist) safeStore(LS_KEYS.navSticky, normalized ? '1' : '0');
}

function applyThemeChoice(choice, { persist = true } = {}) {
  const normalized = Object.prototype.hasOwnProperty.call(THEMES, choice)
    ? choice
    : 'default';
  currentThemeChoice = normalized;
  const root = document.documentElement;
  root.classList.remove('theme-inverted', 'theme-glass');
  if (normalized === 'inverted') root.classList.add('theme-inverted');
  if (normalized === 'glass') root.classList.add('theme-glass');
  if (persist) safeStore(LS_KEYS.themeChoice, normalized);
  const select = document.getElementById('themeSelect');
  if (select && select.value !== normalized) {
    select.value = normalized;
  }
}

function readPreferences() {
  const storedTheme = safeLoad(LS_KEYS.themeChoice);
  if (storedTheme) currentThemeChoice = storedTheme;
  const storedDark = safeLoad(LS_KEYS.darkMode);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  isDarkMode = storedDark ? storedDark === '1' : prefersDark;
  const storedNavSticky = safeLoad(LS_KEYS.navSticky);
  if (storedNavSticky === '0' || storedNavSticky === '1') {
    isMobileNavSticky = storedNavSticky === '1';
  }
  lastSeenVersion = safeLoad(LS_KEYS.seenVersion);
  applyThemeChoice(currentThemeChoice, { persist: false });
  setDarkMode(isDarkMode, { persist: false });
  applyMobileNavSticky(isMobileNavSticky, { persist: false });
}

function renderNav(targetView) {
  const buttons = document.querySelectorAll('[data-nav-target]');
  const views = document.querySelectorAll('[data-view]');
  buttons.forEach((btn) => {
    const isActive = btn.dataset.navTarget === targetView;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
  views.forEach((view) => {
    const isActive = view.dataset.view === targetView;
    view.classList.toggle('hidden', !isActive);
    view.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  });
  if (!isDesktop()) setMobileSidebar(false);
}

function renderFooterVersion() {
  const label = document.querySelector('[data-version-label]');
  if (!label) return;
  const latest = state.latestVersion ? state.latestVersion : '—';
  label.textContent = `Version ${latest}`;
}

function renderVersionCard() {
  const versionEl = document.querySelector('[data-app-version]');
  const statusEl = document.querySelector('[data-version-status]');
  if (versionEl) {
    versionEl.textContent = state.latestVersion || '—';
  }
  if (!statusEl) return;

  if (state.updateError) {
    statusEl.textContent = "We couldn't check for updates just now. Try again shortly.";
    return;
  }

  if (state.checkingUpdates) {
    statusEl.textContent = 'Checking for updates…';
    return;
  }

  if (!state.metadataLoaded) {
    statusEl.textContent = 'Tap “Check for updates” to refresh the changelog.';
    return;
  }

  if (state.latestVersion) {
    statusEl.textContent = `Latest available version: ${state.latestVersion}.`;
  } else {
    statusEl.textContent = 'Version information is unavailable.';
  }
}

function renderChangelogList() {
  const card = document.getElementById('changelogCard');
  if (!card) return;
  const list = card.querySelector('[data-changelog-list]');
  const empty = card.querySelector('[data-changelog-empty]');
  const error = card.querySelector('[data-changelog-error]');
  if (!list || !empty || !error) return;

  const previouslyOpen = Array.from(list.querySelectorAll('details[data-version]'))
    .filter((entry) => entry.open)
    .map((entry) => entry.dataset.version);

  if (state.updateError && !state.metadataLoaded) {
    list.innerHTML = '';
    list.classList.add('hidden');
    empty.classList.add('hidden');
    error.classList.remove('hidden');
    return;
  }

  if (!state.metadataLoaded) {
    list.innerHTML = '';
    list.classList.add('hidden');
    empty.classList.add('hidden');
    error.classList.add('hidden');
    return;
  }

  error.classList.add('hidden');

  if (!state.changelog.length) {
    list.innerHTML = '';
    list.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  const entries = state.changelog
    .slice()
    .sort((a, b) => compareVersions(b.version, a.version))
    .slice(0, 5);

  list.innerHTML = '';
  entries.forEach((entry) => {
    const details = document.createElement('details');
    details.className = 'changelog-accordion';
    details.dataset.version = entry.version;
    if (
      previouslyOpen.includes(entry.version) ||
      (!previouslyOpen.length && entry === entries[0])
    ) {
      details.open = true;
    }

    const summary = document.createElement('summary');
    summary.className = 'changelog-accordion__summary';

    const header = document.createElement('div');
    header.className = 'changelog-accordion__header';

    const heading = document.createElement('span');
    heading.className = 'changelog-accordion__title';
    const formattedDate = entry.date ? formatDate(entry.date) : null;
    heading.textContent = `Version ${entry.version}`;
    header.appendChild(heading);

    if (formattedDate) {
      const dateEl = document.createElement('span');
      dateEl.className = 'changelog-accordion__date';
      dateEl.textContent = formattedDate;
      header.appendChild(dateEl);
    }

    summary.appendChild(header);

    const icon = document.createElement('i');
    icon.className = 'changelog-accordion__icon fa-solid fa-chevron-down';
    icon.setAttribute('aria-hidden', 'true');
    summary.appendChild(icon);

    details.appendChild(summary);

    const content = document.createElement('div');
    content.className = 'changelog-accordion__content';

    const changes = document.createElement('ul');
    changes.className = 'list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300';
    entry.changes.forEach((change) => {
      const item = document.createElement('li');
      item.textContent = change;
      changes.appendChild(item);
    });
    content.appendChild(changes);

    details.appendChild(content);

    list.appendChild(details);
  });

  list.classList.remove('hidden');
  empty.classList.add('hidden');
  error.classList.toggle('hidden', !state.updateError);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  const data = await response.json();
  return data;
}

async function fetchMetadata() {
  const [versionData, changelogData] = await Promise.all([
    fetchJson('assets/version.json'),
    fetchJson('assets/changelog.json'),
  ]);

  const normalizedVersion = versionToString(normalizeVersion(versionData?.version));
  const changelog = Array.isArray(changelogData)
    ? changelogData
        .map((entry) => {
          if (!entry || typeof entry.version !== 'string') return null;
          const normalized = versionToString(normalizeVersion(entry.version));
          if (!normalized) return null;
          const changes = Array.isArray(entry.changes)
            ? entry.changes.map((change) => (typeof change === 'string' ? change.trim() : '')).filter(Boolean)
            : [];
          if (!changes.length) return null;
          return {
            version: normalized,
            date: typeof entry.date === 'string' ? entry.date : null,
            changes,
          };
        })
        .filter(Boolean)
    : [];

  state.latestVersion = normalizedVersion;
  state.changelog = changelog;
  state.metadataLoaded = true;
}

async function checkForUpdates() {
  if (state.checkingUpdates) return;
  state.checkingUpdates = true;
  state.updateError = false;
  toggleUpdateButtons(true);
  renderVersionCard();
  const hadMetadata = state.metadataLoaded;
  try {
    await fetchMetadata();
    renderFooterVersion();
    renderChangelogList();
    renderVersionCard();
    if (!lastSeenVersion && state.latestVersion) {
      lastSeenVersion = state.latestVersion;
      safeStore(LS_KEYS.seenVersion, lastSeenVersion);
    }
  } catch (error) {
    console.error('Failed to refresh metadata', error);
    state.updateError = true;
    if (!hadMetadata) {
      state.metadataLoaded = false;
    }
    renderChangelogList();
    renderVersionCard();
  } finally {
    state.checkingUpdates = false;
    toggleUpdateButtons(false);
    renderVersionCard();
  }
}

function toggleUpdateButtons(disabled) {
  document.querySelectorAll('[data-action="check-updates"]').forEach((btn) => {
    const originalLabel = btn.dataset.originalLabel || btn.textContent.trim();
    btn.dataset.originalLabel = originalLabel;
    const loadingLabel = btn.dataset.loadingLabel || 'Checking…';
    if (disabled) {
      btn.disabled = true;
      btn.classList.add('loading');
      btn.setAttribute('aria-busy', 'true');
      btn.innerHTML = `
        <span class="flex items-center justify-center gap-2">
          <span
            class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          ></span>
          <span>${loadingLabel}</span>
        </span>
      `;
    } else {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.setAttribute('aria-busy', 'false');
      btn.textContent = originalLabel;
    }
  });
}

function setupEventListeners() {
  document.querySelectorAll('[data-nav-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      renderNav(btn.dataset.navTarget);
    });
  });

  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const target = link.dataset.navLink;
      renderNav(target);
      const section = document.querySelector(`[data-view="${target}"]`);
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.querySelectorAll('[data-action="check-updates"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      checkForUpdates();
    });
  });

  document.querySelectorAll('[data-theme-toggle]').forEach((toggle) => {
    toggle.addEventListener('change', (event) => {
      setDarkMode(event.target.checked);
    });
  });

  const navStickyToggle = document.getElementById('mobileNavStickyToggle');
  if (navStickyToggle) {
    navStickyToggle.addEventListener('change', (event) => {
      applyMobileNavSticky(event.target.checked);
    });
  }

  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.addEventListener('change', (event) => {
      applyThemeChoice(event.target.value);
    });
  }

  const overlay = document.querySelector('[data-nav-overlay]');
  if (overlay) {
    overlay.addEventListener('click', () => {
      setMobileSidebar(false);
    });
  }

  const closeButton = document.querySelector('[data-action="close-sidebar"]');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      setMobileSidebar(false);
    });
  }

  const toggleButton = document.querySelector('[data-action="toggle-sidebar"]');
  if (toggleButton) {
    toggleButton.addEventListener('click', () => {
      setMobileSidebar(!mobileNavOpen);
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobileNavOpen && !isDesktop()) {
      setMobileSidebar(false);
    }
  });

  onMediaQueryChange(desktopQuery, () => {
    if (isDesktop()) {
      mobileNavOpen = false;
    }
    updateSidebarForViewport();
  });
}

function initFooterYear() {
  const yearEl = document.querySelector('[data-year]');
  if (!yearEl) return;
  yearEl.textContent = new Date().getFullYear();
}

function initView() {
  renderNav('welcome');
}

async function init() {
  readPreferences();
  updateSidebarForViewport();
  initFooterYear();
  initView();
  setupEventListeners();
  renderFooterVersion();
  renderVersionCard();
  renderChangelogList();
  await checkForUpdates();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('service-worker.js')
      .catch((error) => console.error('Service worker registration failed:', error));
  });
}
