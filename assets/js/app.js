'use strict';

(function () {
  const root = document.documentElement;
  const body = document.body;
  const LS_KEYS = {
    themeDark: 'themeDark',
    themeChoice: 'themeChoice',
    welcomeDisabled: 'welcomeDisabled',
    activeView: 'activeView',
  };

  const storage = {
    read(key) {
      try {
        return localStorage.getItem(key);
      } catch (_) {
        return null;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (_) {}
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (_) {}
    },
    clear() {
      try {
        localStorage.clear();
      } catch (_) {}
    },
  };

  function $(id) {
    return document.getElementById(id);
  }

  function $all(selector, scope = document) {
    return Array.from(scope.querySelectorAll(selector));
  }

  function resolveDarkPreference() {
    const stored = storage.read(LS_KEYS.themeDark);
    if (stored === '1') return true;
    if (stored === '0') return false;
    if (window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  }

  function applyDarkMode(enabled, { persist = true } = {}) {
    root.classList.toggle('dark', !!enabled);
    const toggle = $('themeToggle');
    if (toggle && toggle.checked !== !!enabled) {
      toggle.checked = !!enabled;
    }
    if (persist) {
      storage.write(LS_KEYS.themeDark, enabled ? '1' : '0');
    }
  }

  function resolveThemeChoice() {
    const stored = storage.read(LS_KEYS.themeChoice);
    if (stored === 'inverted' || stored === 'glass') {
      return stored;
    }
    return 'default';
  }

  function applyThemeChoice(choice, { persist = true } = {}) {
    const normalized = choice === 'inverted' || choice === 'glass' ? choice : 'default';
    root.classList.remove('theme-inverted', 'theme-glass');
    if (normalized === 'inverted') {
      root.classList.add('theme-inverted');
    } else if (normalized === 'glass') {
      root.classList.add('theme-glass');
    }
    const select = $('themeSelect');
    if (select && select.value !== normalized) {
      select.value = normalized;
    }
    if (persist) {
      storage.write(LS_KEYS.themeChoice, normalized);
    }
  }

  function applyWelcomeHidden(hidden, { persist = true } = {}) {
    const normalized = !!hidden;
    $all('[data-first-time]').forEach((el) => {
      el.classList.toggle('hidden', normalized);
    });
    const toggle = $('welcomeToggle');
    if (toggle) {
      toggle.checked = !normalized;
    }
    if (persist) {
      storage.write(LS_KEYS.welcomeDisabled, normalized ? '1' : '0');
    }
  }

  function readWelcomeHidden() {
    return storage.read(LS_KEYS.welcomeDisabled) === '1';
  }

  function openSidebar() {
    const sidebar = $('sidebar');
    const overlay = $('overlay');
    if (sidebar) sidebar.classList.remove('-translate-x-full');
    if (overlay) overlay.classList.remove('hidden');
    if (body) body.classList.add('overflow-hidden');
  }

  function closeSidebar() {
    const sidebar = $('sidebar');
    const overlay = $('overlay');
    if (sidebar) sidebar.classList.add('-translate-x-full');
    if (overlay) overlay.classList.add('hidden');
    if (body) body.classList.remove('overflow-hidden');
  }

  function setupNavigation() {
    const sections = new Map();
    $all('.content-section').forEach((section) => {
      if (section.id) sections.set(section.id, section);
    });

    const navButtons = $all('.nav-btn');

    function showSection(id) {
      sections.forEach((section, key) => {
        section.classList.toggle('active', key === id);
      });
      navButtons.forEach((btn) => {
        const isActive = btn.dataset.target === id;
        btn.classList.toggle('active-nav-button', isActive);
      });
    }

    function navigateTo(id) {
      if (!sections.has(id)) return;
      showSection(id);
      storage.write(LS_KEYS.activeView, id);
      closeSidebar();
    }

    navButtons.forEach((btn) => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.target));
    });

    const brandHome = $('brandHome');
    if (brandHome) {
      brandHome.addEventListener('click', () => navigateTo('welcome'));
    }

    $all('[data-action="go-settings"]').forEach((btn) => {
      btn.addEventListener('click', () => navigateTo('settings'));
    });

    const storedView = storage.read(LS_KEYS.activeView);
    if (storedView && sections.has(storedView)) {
      showSection(storedView);
    } else {
      showSection('welcome');
    }
  }

  function setupSidebarControls() {
    const menuToggle = $('menu-toggle');
    const overlay = $('overlay');
    if (menuToggle) {
      menuToggle.addEventListener('click', () => {
        const sidebar = $('sidebar');
        if (!sidebar) return;
        if (sidebar.classList.contains('-translate-x-full')) {
          openSidebar();
        } else {
          closeSidebar();
        }
      });
    }
    if (overlay) {
      overlay.addEventListener('click', closeSidebar);
    }
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768) {
        closeSidebar();
      }
    });
  }

  async function loadVersion() {
    const target = document.querySelector('[data-app-version]');
    if (!target) return;
    try {
      const response = await fetch('assets/version.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load version');
      const data = await response.json();
      if (data && data.version) {
        target.textContent = data.version;
      }
    } catch (_) {
      target.textContent = 'unknown';
    }
  }

  function buildChangeItem(change) {
    const wrapper = document.createElement('article');
    wrapper.className = 'rounded-lg bg-gray-50 dark:bg-gray-800/60 p-4 space-y-2';

    const heading = document.createElement('div');
    heading.className = 'flex flex-wrap items-center justify-between gap-2';

    const title = document.createElement('h4');
    title.className = 'text-lg font-semibold text-gray-900 dark:text-gray-100';
    title.textContent = change.version || 'Unversioned';

    const date = document.createElement('span');
    date.className = 'text-sm text-gray-500 dark:text-gray-400';
    if (change.date) {
      date.textContent = change.date;
    }

    heading.appendChild(title);
    if (change.date) heading.appendChild(date);

    const list = document.createElement('ul');
    list.className = 'list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300';

    if (Array.isArray(change.changes) && change.changes.length) {
      change.changes.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'No additional details provided.';
      list.appendChild(li);
    }

    wrapper.appendChild(heading);
    wrapper.appendChild(list);
    return wrapper;
  }

  async function loadChangelog() {
    const list = document.querySelector('[data-changelog-list]');
    const empty = document.querySelector('[data-changelog-empty]');
    const error = document.querySelector('[data-changelog-error]');
    if (!list) return;
    list.innerHTML = '';
    if (empty) empty.classList.add('hidden');
    if (error) error.classList.add('hidden');
    try {
      const response = await fetch('assets/changelog.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load changelog');
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        if (empty) empty.classList.remove('hidden');
        return;
      }
      data.slice(0, 5).forEach((entry) => {
        list.appendChild(buildChangeItem(entry));
      });
    } catch (_) {
      if (error) error.classList.remove('hidden');
    }
  }

  function setupUpdateHandler() {
    const updateBtn = document.querySelector('[data-action="update-app"]');
    if (!updateBtn) return;
    updateBtn.addEventListener('click', async () => {
      if (!('serviceWorker' in navigator)) {
        window.location.reload();
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          window.location.reload();
          return;
        }
        let handled = false;
        const reload = () => {
          if (handled) return;
          handled = true;
          window.location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
        await registration.update();
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          return;
        }
        if (registration.installing) {
          registration.installing.addEventListener('statechange', () => {
            if (registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          });
          return;
        }
        navigator.serviceWorker.removeEventListener('controllerchange', reload);
        window.alert('You already have the latest version installed.');
      } catch (_) {
        window.alert('Unable to check for updates right now.');
      }
    });
  }

  function setupClearData() {
    const clearBtn = document.querySelector('[data-action="clear-data"]');
    if (!clearBtn) return;
    clearBtn.addEventListener('click', () => {
      if (!window.confirm('This will remove all locally stored WealthTrack data. Continue?')) {
        return;
      }
      storage.clear();
      try {
        sessionStorage.clear();
      } catch (_) {}
      applyDarkMode(resolveDarkPreference(), { persist: false });
      applyThemeChoice('default', { persist: false });
      applyWelcomeHidden(false, { persist: false });
      storage.remove(LS_KEYS.activeView);
      window.location.reload();
    });
  }

  function setupThemeControls() {
    const themeToggle = $('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('change', (event) => {
        applyDarkMode(event.target.checked);
      });
    }

    const themeSelect = $('themeSelect');
    if (themeSelect) {
      themeSelect.addEventListener('change', (event) => {
        applyThemeChoice(event.target.value);
      });
    }

    const welcomeToggle = $('welcomeToggle');
    if (welcomeToggle) {
      welcomeToggle.addEventListener('change', (event) => {
        applyWelcomeHidden(!event.target.checked);
      });
    }

    if (window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (event) => {
        const stored = storage.read(LS_KEYS.themeDark);
        if (stored === null) {
          applyDarkMode(event.matches, { persist: false });
        }
      };
      if (media.addEventListener) {
        media.addEventListener('change', listener);
      } else if (media.addListener) {
        media.addListener(listener);
      }
    }
  }

  applyDarkMode(resolveDarkPreference(), { persist: false });
  applyThemeChoice(resolveThemeChoice(), { persist: false });

  document.addEventListener('DOMContentLoaded', () => {
    applyDarkMode(resolveDarkPreference(), { persist: false });
    applyThemeChoice(resolveThemeChoice(), { persist: false });
    applyWelcomeHidden(readWelcomeHidden(), { persist: false });

    setupNavigation();
    setupSidebarControls();
    setupThemeControls();
    setupUpdateHandler();
    setupClearData();
    loadVersion();
    loadChangelog();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
})();
