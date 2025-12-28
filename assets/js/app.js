'use strict';
// --- State ---
let profiles = [];
let activeProfile = null;
let assets = [];
let incomes = [];
let liabilities = [];
let snapshots = [];
let simEvents = [];
let scenarioEventsEnabled = true;
let stressAssetIds = new Set();
let goalValue = 0;
let goalTargetDate = null;
let inflationRate = 2.5;
let wealthChart, snapshotChart, assetBreakdownChart, futurePortfolioChart;
let assetForecasts = new Map();
let liabilityForecasts = new Map();
let netCashFlowForecasts = null;
let lastForecastScenarios = null;
let progressCheckSelection = null;
let snapshotComparisonState = {
  baseDate: null,
  mode: "current",
  targetDate: null,
};
let fireExpenses = 0;
let fireExpensesFrequency = "annual";
let fireWithdrawalRate = 4;
let fireProjectionYears = 30;
let fireLastInputs = null;
let fireForecastCosts = 0;
let fireForecastFrequency = "annual";
let fireForecastInflation = 2.5;
let fireForecastRetireDate = null;
let passiveIncomeAsOf = null;
let passiveAssetSelection = null;
let passiveAssetPicker = null;
let mobileHeaderResizeObserver = null;

const profilePickers = {};
let importFileContent = null;
let importFileToken = null;
let importPreviewData = null;
const getImportFileToken = (file) =>
  file && file.name != null
    ? `${file.name}|${file.size}|${file.lastModified}`
    : null;

// --- DOM helpers ---
const $ = (id) => document.getElementById(id);
const on = (el, ev, fn) => el.addEventListener(ev, fn);
const getLatestById = (id) => {
  const nodes = document.querySelectorAll(`[id="${id}"]`);
  return nodes.length ? nodes[nodes.length - 1] : null;
};
const LS_PREFIX = "wealthtrack:";
const storageKey = (key) => `${LS_PREFIX}${key}`;
const LEGACY_LS_KEYS = {
  assets: "assets",
  liabs: "liabilities",
  snaps: "snapshots",
  events: "simEvents",
  goal: "goalValue",
  goalDate: "goalDate",
  welcome: "welcomeSeen",
  welcomeDisabled: "welcomeDisabled",
  onboardPending: "onboardDataPending",
  onboardSeen: "onboardDataSeen",
  theme: "themeDark",
  themeChoice: "themeChoice",
  mobileNavSticky: "mobileNavSticky",
  profiles: "profiles",
  activeProfile: "activeProfile",
  forecastTip: "forecastTipSeen",
  view: "activeView",
};
const LS = Object.fromEntries(
  Object.entries(LEGACY_LS_KEYS).map(([name, key]) => [name, storageKey(key)]),
);
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const load = (k, d) => JSON.parse(localStorage.getItem(k)) || d;
const getLocalStorageItem = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
};

const migrateStorageKeys = () => {
  if (typeof localStorage === "undefined") return;
  try {
    Object.values(LEGACY_LS_KEYS).forEach((legacyKey) => {
      const prefixedKey = storageKey(legacyKey);
      const existingPrefixed = localStorage.getItem(prefixedKey);
      if (existingPrefixed !== null) {
        localStorage.removeItem(legacyKey);
        return;
      }
      const legacyValue = localStorage.getItem(legacyKey);
      if (legacyValue !== null) {
        localStorage.setItem(prefixedKey, legacyValue);
        localStorage.removeItem(legacyKey);
      }
    });

    const legacyCollapseKeys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || key.startsWith(LS_PREFIX)) continue;
      if (key.startsWith("cardCollapsed:")) legacyCollapseKeys.push(key);
    }

    legacyCollapseKeys.forEach((legacyKey) => {
      const prefixedKey = storageKey(legacyKey);
      if (localStorage.getItem(prefixedKey) === null) {
        const legacyValue = localStorage.getItem(legacyKey);
        if (legacyValue !== null) {
          localStorage.setItem(prefixedKey, legacyValue);
        }
      }
      localStorage.removeItem(legacyKey);
    });
  } catch (_) {}
};

migrateStorageKeys();

const COLLAPSE_CARDS_BY_DEFAULT = (() => {
  try {
    return localStorage.getItem(LS.welcome) !== "1";
  } catch (_) {
    return true;
  }
})();

const getStoredFirstTimeHidden = () => {
  try {
    return localStorage.getItem(LS.welcomeDisabled) === "1";
  } catch (_) {
    return false;
  }
};

const setStoredFirstTimeHidden = (hidden) => {
  try {
    localStorage.setItem(LS.welcomeDisabled, hidden ? "1" : "0");
  } catch (_) {}
};

function isFirstTimeContentHidden(profile = activeProfile) {
  if (profile && Object.prototype.hasOwnProperty.call(profile, "firstTimeContentHidden")) {
    return !!profile.firstTimeContentHidden;
  }
  return getStoredFirstTimeHidden();
}

function updateFirstTimeContentVisibility(hidden) {
  const welcomeBtn = document.querySelector('nav button[data-target="welcome"]');
  if (welcomeBtn) welcomeBtn.classList.toggle("hidden", hidden);
  document
    .querySelectorAll("[data-first-time]")
    .forEach((el) => el.classList.toggle("hidden", hidden));
  const welcomeToggle = $("welcomeToggle");
  if (welcomeToggle && welcomeToggle.checked === hidden) {
    welcomeToggle.checked = !hidden;
  }
}

function applyFirstTimeContentHidden(hidden, { persistProfile = true } = {}) {
  const normalized = !!hidden;
  setStoredFirstTimeHidden(normalized);
  if (activeProfile) {
    activeProfile.firstTimeContentHidden = normalized;
    if (persistProfile) persist();
  }
  updateFirstTimeContentVisibility(normalized);
  return normalized;
}

function normalizeCardHeadings(root = document) {
  root
    .querySelectorAll(".card > h3, .card > h4")
    .forEach((heading) => {
      if (heading && heading.childElementCount === 0) {
        heading.textContent = heading.textContent.trim();
      }
    });
}

const IMPORT_PROFILE_DEFAULT_HINT =
  "Profiles from the selected file will appear here once the password (if any) is provided.";

function setImportProfileHint(message) {
  document
    .querySelectorAll('[id="importProfileHint"]')
    .forEach((el) => (el.textContent = message));
}

function closeProfilePicker(key) {
  const picker = profilePickers[key];
  if (!picker) return;
  picker.menu.classList.add("hidden");
  picker.toggle.setAttribute("aria-expanded", "false");
}

function closeAllProfilePickers() {
  Object.keys(profilePickers).forEach((key) => closeProfilePicker(key));
}

function updateProfilePickerSummary(key) {
  const picker = profilePickers[key];
  if (!picker) return;
  const total = picker.optionIds.size;
  if (total === 0) {
    picker.summary.textContent = picker.emptySummary;
    return;
  }
  const selected = Array.from(picker.selected);
  if (selected.length === 0) {
    picker.summary.textContent = "No profiles selected";
  } else if (selected.length === total) {
    picker.summary.textContent = "All profiles selected";
  } else if (selected.length === 1) {
    picker.summary.textContent =
      picker.names.get(selected[0]) || "1 profile selected";
  } else {
    picker.summary.textContent = `${selected.length} of ${total} profiles`;
  }
}

function populateProfilePickerOptions(key, profilesList) {
  const picker = profilePickers[key];
  if (!picker) return;
  const prevSelected = new Set(picker.selected);
  const prevOptionIds = new Set(picker.optionIds);
  picker.options.innerHTML = "";
  picker.selected = new Set();
  picker.optionIds = new Set();
  picker.names = new Map();
  profilesList.forEach((profile, index) => {
    const id = String(profile?.id ?? Date.now() + index);
    picker.optionIds.add(id);
    const label = profile?.name || `Profile ${index + 1}`;
    picker.names.set(id, label);
    const isNew = !prevOptionIds.has(id);
    const shouldSelect =
      (prevOptionIds.size === 0 && prevSelected.size === 0) ||
      prevSelected.has(id) ||
      isNew;
    if (shouldSelect) picker.selected.add(id);
    const optionLabel = document.createElement("label");
    optionLabel.className =
      "flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = id;
    checkbox.checked = shouldSelect;
    checkbox.className =
      "mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500";
    optionLabel.appendChild(checkbox);
    const span = document.createElement("span");
    span.textContent = label;
    optionLabel.appendChild(span);
    picker.options.appendChild(optionLabel);
  });
  picker.disabled = profilesList.length === 0;
  picker.toggle.disabled = picker.disabled;
  picker.toggle.setAttribute("aria-expanded", "false");
  picker.menu.classList.add("hidden");
  if (picker.disabled) {
    picker.summary.textContent = picker.emptySummary;
  } else {
    updateProfilePickerSummary(key);
  }
  if (key === "import") {
    if (profilesList.length === 0) {
      setImportProfileHint("No profiles were found in the selected file.");
    } else {
      setImportProfileHint(
        "All profiles are selected by default. Deselect any you don't want to import.",
      );
    }
  }
}

function resetProfilePicker(key, summaryMessage, { hint } = {}) {
  const picker = profilePickers[key];
  if (!picker) return;
  picker.options.innerHTML = "";
  picker.selected = new Set();
  picker.optionIds = new Set();
  picker.names = new Map();
  picker.disabled = true;
  picker.toggle.disabled = true;
  picker.summary.textContent = summaryMessage || picker.emptySummary;
  picker.menu.classList.add("hidden");
  picker.toggle.setAttribute("aria-expanded", "false");
  if (key === "import") {
    setImportProfileHint(hint || IMPORT_PROFILE_DEFAULT_HINT);
  }
}

function getProfilePickerSelection(key) {
  const picker = profilePickers[key];
  if (!picker) return [];
  return Array.from(picker.selected);
}

const getPassiveEligibleAssets = () =>
  [...assets]
    .filter((asset) => asset && asset.includeInPassive !== false)
    .sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, {
        sensitivity: "base",
      }),
    );

function closePassiveAssetPicker() {
  if (!passiveAssetPicker) return;
  passiveAssetPicker.menu.classList.add("hidden");
  passiveAssetPicker.toggle.setAttribute("aria-expanded", "false");
}

function updatePassiveAssetSummary() {
  if (!passiveAssetPicker) return;
  const total = Array.isArray(passiveAssetPicker.ids)
    ? passiveAssetPicker.ids.length
    : 0;
  const summary = passiveAssetPicker.summary;
  if (!summary) return;
  if (total === 0) {
    summary.textContent = "No passive income assets";
    return;
  }
  if (passiveAssetSelection === null) {
    summary.textContent = "All passive assets selected";
    return;
  }
  let selectedCount = 0;
  let singleName = null;
  passiveAssetSelection.forEach((id) => {
    if (passiveAssetPicker.names?.has(id)) {
      selectedCount += 1;
      if (!singleName) singleName = passiveAssetPicker.names.get(id);
    }
  });
  if (selectedCount === 0) {
    summary.textContent = "No assets selected";
  } else if (selectedCount === 1 && singleName) {
    summary.textContent = singleName;
  } else if (selectedCount === total) {
    summary.textContent = "All passive assets selected";
  } else {
    summary.textContent = `${selectedCount} of ${total} assets`;
  }
}

function syncPassiveAssetCheckboxes() {
  if (!passiveAssetPicker) return;
  const checkboxes = passiveAssetPicker.options?.querySelectorAll(
    'input[type="checkbox"]',
  );
  if (!checkboxes) return;
  const selectedIds =
    passiveAssetSelection === null
      ? new Set(passiveAssetPicker.ids || [])
      : passiveAssetSelection;
  checkboxes.forEach((input) => {
    const id = Number(input.value);
    if (!Number.isFinite(id)) return;
    input.checked = selectedIds.has(id);
  });
}

function renderPassiveAssetPickerOptions() {
  if (!passiveAssetPicker) return;
  const eligible = getPassiveEligibleAssets();
  passiveAssetPicker.ids = eligible.map((asset) => asset.dateAdded);
  const validIds = new Set(passiveAssetPicker.ids);
  if (passiveAssetSelection instanceof Set) {
    const filtered = new Set();
    passiveAssetSelection.forEach((id) => {
      if (validIds.has(id)) filtered.add(id);
    });
    if (filtered.size === validIds.size && validIds.size > 0) {
      passiveAssetSelection = null;
    } else {
      passiveAssetSelection = filtered;
    }
  }
  passiveAssetPicker.names = new Map();
  if (eligible.length === 0) {
    passiveAssetPicker.options.innerHTML =
      '<p class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Mark assets as passive income in Assets &amp; Goals.</p>';
    passiveAssetPicker.toggle.disabled = true;
    if (passiveAssetPicker.selectAll)
      passiveAssetPicker.selectAll.disabled = true;
    if (passiveAssetPicker.clear)
      passiveAssetPicker.clear.disabled = true;
    updatePassiveAssetSummary();
    closePassiveAssetPicker();
    return;
  }
  const selectedIds =
    passiveAssetSelection === null ? validIds : passiveAssetSelection;
  const markup = eligible
    .map((asset) => {
      const id = asset.dateAdded;
      const name = asset.name || "Unnamed asset";
      passiveAssetPicker.names.set(id, name);
      const checked = selectedIds.has(id) ? "checked" : "";
      return `<label class="flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><input type="checkbox" value="${id}" class="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" ${checked}/><span>${name}</span></label>`;
    })
    .join("");
  passiveAssetPicker.options.innerHTML = markup;
  passiveAssetPicker.toggle.disabled = false;
  if (passiveAssetPicker.selectAll)
    passiveAssetPicker.selectAll.disabled = false;
  if (passiveAssetPicker.clear)
    passiveAssetPicker.clear.disabled = false;
  updatePassiveAssetSummary();
}

function updatePassiveAssetSelectionMessage(totalEligible, selectedCount) {
  const message = $("passiveAssetSelectionMessage");
  if (!message) return;
  if (totalEligible === 0) {
    message.textContent =
      "Mark assets as providing passive income in Financial Inputs to include them here.";
    message.classList.remove("hidden");
  } else if (selectedCount === 0) {
    message.textContent =
      "Select at least one asset to see a passive income estimate.";
    message.classList.remove("hidden");
  } else {
    message.classList.add("hidden");
  }
}

function setupPassiveIncomeAssetPicker() {
  const toggle = $("passiveAssetToggle");
  const menu = $("passiveAssetMenu");
  const summary = $("passiveAssetSummary");
  const options = $("passiveAssetOptions");
  if (!toggle || !menu || !summary || !options) {
    passiveAssetPicker = null;
    return;
  }
  passiveAssetPicker = {
    toggle,
    menu,
    summary,
    options,
    selectAll: $("passiveAssetSelectAll"),
    clear: $("passiveAssetClear"),
    names: new Map(),
    ids: [],
  };
  toggle.disabled = true;
  summary.textContent = "All passive assets selected";
  on(toggle, "click", () => {
    if (toggle.disabled) return;
    const willOpen = menu.classList.contains("hidden");
    closePassiveAssetPicker();
    if (willOpen) {
      menu.classList.remove("hidden");
      toggle.setAttribute("aria-expanded", "true");
    }
  });
  on(options, "change", (event) => {
    const input = event.target;
    if (!input || input.type !== "checkbox") return;
    const id = Number(input.value);
    if (!Number.isFinite(id)) return;
    const validIds = new Set(passiveAssetPicker.ids || []);
    if (passiveAssetSelection === null) {
      passiveAssetSelection = new Set(validIds);
    }
    if (input.checked) passiveAssetSelection.add(id);
    else passiveAssetSelection.delete(id);
    if (passiveAssetSelection.size === validIds.size) {
      passiveAssetSelection = null;
    }
    updatePassiveAssetSummary();
    persist();
    updatePassiveIncome();
  });
  if (passiveAssetPicker.selectAll)
    on(passiveAssetPicker.selectAll, "click", () => {
      if (toggle.disabled) return;
      passiveAssetSelection = null;
      syncPassiveAssetCheckboxes();
      updatePassiveAssetSummary();
      persist();
      updatePassiveIncome();
    });
  if (passiveAssetPicker.clear)
    on(passiveAssetPicker.clear, "click", () => {
      if (toggle.disabled) return;
      passiveAssetSelection = new Set();
      syncPassiveAssetCheckboxes();
      updatePassiveAssetSummary();
      persist();
      updatePassiveIncome();
    });
  document.addEventListener("click", (event) => {
    if (!passiveAssetPicker) return;
    if (passiveAssetPicker.menu.classList.contains("hidden")) return;
    if (
      passiveAssetPicker.menu.contains(event.target) ||
      passiveAssetPicker.toggle.contains(event.target)
    )
      return;
    closePassiveAssetPicker();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePassiveAssetPicker();
  });
  renderPassiveAssetPickerOptions();
}

function setupProfilePickers() {
  const createPicker = (prefix, emptySummary) => {
    const toggle = getLatestById(`${prefix}ProfileToggle`);
    const menu = getLatestById(`${prefix}ProfileMenu`);
    const summary = getLatestById(`${prefix}ProfileSummary`);
    const options = getLatestById(`${prefix}ProfileOptions`);
    if (!toggle || !menu || !summary || !options) {
      profilePickers[prefix] = null;
      return null;
    }
    const picker = {
      toggle,
      menu,
      summary,
      options,
      selected: new Set(),
      optionIds: new Set(),
      names: new Map(),
      emptySummary,
      disabled: true,
    };
    profilePickers[prefix] = picker;
    on(toggle, "click", () => {
      if (picker.disabled) return;
      const willOpen = menu.classList.contains("hidden");
      closeAllProfilePickers();
      if (willOpen) {
        menu.classList.remove("hidden");
        toggle.setAttribute("aria-expanded", "true");
      } else {
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    on(options, "change", (event) => {
      const input = event.target;
      if (!input || input.type !== "checkbox") return;
      const id = input.value;
      if (input.checked) picker.selected.add(id);
      else picker.selected.delete(id);
      updateProfilePickerSummary(prefix);
    });
    toggle.disabled = true;
    summary.textContent = emptySummary;
    return picker;
  };

  createPicker("export", "No profiles available");
  createPicker("import", "Select a file to choose profiles");

  document.addEventListener("click", (event) => {
    Object.entries(profilePickers).forEach(([key, picker]) => {
      if (!picker || picker.menu.classList.contains("hidden")) return;
      if (
        picker.toggle.contains(event.target) ||
        picker.menu.contains(event.target)
      )
        return;
      closeProfilePicker(key);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllProfilePickers();
  });

  resetProfilePicker("export");
  resetProfilePicker("import");
}

const sanitizeThemeChoice = (val) =>
  val === "inverted" || val === "glass" ? val : "default";

const sanitizeMobileNavSticky = (value, fallback = true) =>
  value == null ? fallback : !!value;

const readStoredMobileNavSticky = () =>
  getLocalStorageItem(LS.mobileNavSticky) !== "0";

const GBP_CURRENCY = { locale: "en-GB", currency: "GBP", symbol: "£" };

let currentThemeChoice = sanitizeThemeChoice(
  getLocalStorageItem(LS.themeChoice) || "default",
);
let isDarkMode = getLocalStorageItem(LS.theme) === "1";
let isMobileNavSticky = sanitizeMobileNavSticky(readStoredMobileNavSticky(), true);

const fmtCurrency = (value) => {
  const amount =
    typeof value === "number" ? value : Number.parseFloat(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return safeAmount.toLocaleString(GBP_CURRENCY.locale, {
    style: "currency",
    currency: GBP_CURRENCY.currency,
  });
};

const fmtPercent = (value, { digits = 2, signed = false } = {}) => {
  const amount = Number.isFinite(value) ? value : 0;
  const formatter = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
  const abs = formatter.format(Math.abs(amount));
  if (amount === 0) return `0%`;
  if (amount > 0) return signed ? `+${abs}%` : `${abs}%`;
  return `-${abs}%`;
};

const updateCurrencySymbols = () => {
  document
    .querySelectorAll("[data-currency-symbol]")
    .forEach((el) => {
      el.textContent = GBP_CURRENCY.symbol;
    });
  document
    .querySelectorAll("template")
    .forEach((tpl) => {
      const fragment = tpl.content;
      if (!fragment) return;
      fragment
        .querySelectorAll("[data-currency-symbol]")
        .forEach((el) => {
          el.textContent = GBP_CURRENCY.symbol;
        });
    });
};

const currencyTick = (v) => fmtCurrency(v);

function applyMobileNavSticky(enabled, { persistChoice = true } = {}) {
  const normalized = !!enabled;
  isMobileNavSticky = normalized;
  const body = document.body;
  if (body) body.classList.toggle("mobile-header-static", !normalized);
  const toggle = document.getElementById("mobileNavStickyToggle");
  if (toggle && toggle.checked !== normalized) toggle.checked = normalized;
  if (activeProfile) activeProfile.mobileNavSticky = normalized;
  if (persistChoice) {
    try {
      localStorage.setItem(LS.mobileNavSticky, normalized ? "1" : "0");
    } catch (_) {}
    if (activeProfile) persist();
  }
  updateMobileHeaderOffset();
  return normalized;
}

const TAX_BANDS = {
  basic: {
    label: "Basic rate (20%)",
    incomeRate: 20,
    dividendRate: 8.75,
    capitalGainsRate: 10,
    defaultAllowances: { income: 1000, dividend: 500, capital: 3000 },
  },
  higher: {
    label: "Higher rate (40%)",
    incomeRate: 40,
    dividendRate: 33.75,
    capitalGainsRate: 20,
    defaultAllowances: { income: 500, dividend: 500, capital: 3000 },
  },
  additional: {
    label: "Additional rate (45%)",
    incomeRate: 45,
    dividendRate: 39.35,
    capitalGainsRate: 20,
    defaultAllowances: { income: 0, dividend: 500, capital: 3000 },
  },
};

const DEFAULT_TAX_SETTINGS = {
  band: "basic",
  incomeAllowance: 1000,
  dividendAllowance: 500,
  capitalAllowance: 3000,
};

const TAX_YEAR_THRESHOLDS = {
  2025: {
    label: "2025/26",
    basicLimit: 50270,
    higherLimit: 125140,
    primaryNiThreshold: 12570,
    upperNiThreshold: 50270,
  },
  2026: { label: "2026/27" },
  2027: { label: "2027/28" },
  2028: { label: "2028/29" },
  2029: { label: "2029/30" },
};
const DEFAULT_TAX_YEAR_KEY = 2025;
const BASIC_RELIEF_RATE = 0.2;
const TAX_TREATMENTS = {
  "tax-free": {
    label: "Tax-free or sheltered (ISA, pension)",
    allowanceKey: null,
    allowanceSetting: null,
    allowanceLabel: "No allowance needed",
    rateKey: null,
    totalsKey: null,
    info: "No UK tax is applied to growth or income while the asset stays in the wrapper.",
  },
  income: {
    label: "Income tax (interest, rent, bonds)",
    allowanceKey: "income",
    allowanceSetting: "incomeAllowance",
    allowanceLabel: "savings allowance",
    rateKey: "incomeRate",
    totalsKey: "income",
    info: "Use for interest, rental profit, bond coupons, and other income taxed at your marginal rate.",
  },
  dividend: {
    label: "Dividend tax",
    allowanceKey: "dividend",
    allowanceSetting: "dividendAllowance",
    allowanceLabel: "dividend allowance",
    rateKey: "dividendRate",
    totalsKey: "dividend",
    info: "Use for UK share dividends held outside tax shelters.",
  },
  "capital-gains": {
    label: "Capital gains tax",
    allowanceKey: "capital",
    allowanceSetting: "capitalAllowance",
    allowanceLabel: "capital gains allowance",
    rateKey: "capitalGainsRate",
    totalsKey: "capital",
    info: "Use for growth that is taxed when you sell the asset (e.g. funds held outside an ISA).",
  },
};

const SCENARIO_KEYS = ["low", "base", "high"];
const SCENARIO_LABELS = {
  low: "Low Growth",
  base: "Expected Growth",
  high: "High Growth",
};

function getTaxBandConfig(band) {
  return TAX_BANDS[band] || TAX_BANDS.basic;
}

function getBandSummary(bandKey) {
  const band = getTaxBandConfig(bandKey);
  return `${band.label}: ${formatPercent(band.incomeRate)} income, ${formatPercent(
    band.dividendRate,
  )} dividends, ${formatPercent(band.capitalGainsRate)} capital gains`;
}

function toNonNegativeNumber(value, fallback = 0) {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

function normalizeTaxTreatment(value) {
  const key = (value || "").toString();
  return TAX_TREATMENTS[key] ? key : "tax-free";
}

function getTaxTreatmentMeta(value) {
  const key = normalizeTaxTreatment(value);
  return TAX_TREATMENTS[key];
}

function normalizeTaxSettings(settings = null) {
  const src = settings && typeof settings === "object" ? settings : {};
  const bandKey = TAX_BANDS[src.band] ? src.band : DEFAULT_TAX_SETTINGS.band;
  const band = getTaxBandConfig(bandKey);
  return {
    band: bandKey,
    incomeAllowance: toNonNegativeNumber(
      src.incomeAllowance,
      band.defaultAllowances.income,
    ),
    dividendAllowance: toNonNegativeNumber(
      src.dividendAllowance,
      band.defaultAllowances.dividend,
    ),
    capitalAllowance: toNonNegativeNumber(
      src.capitalAllowance,
      band.defaultAllowances.capital,
    ),
  };
}

let taxSettings = normalizeTaxSettings();
let taxComputationCache = null;
const STUDENT_LOAN_PLANS = {
  none: { threshold: Infinity, rate: 0 },
  plan1: { threshold: 24990, rate: 0.09 },
  plan2: { threshold: 27295, rate: 0.09 },
  plan4: { threshold: 31295, rate: 0.09 },
  plan5: { threshold: 25000, rate: 0.09 },
  postgrad: { threshold: 21000, rate: 0.06 },
};

function invalidateTaxCache() {
  taxComputationCache = null;
}

function formatPercent(value) {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num)) return "0%";
  const fixed = Math.abs(num) < 1 ? num.toFixed(2) : num.toFixed(1);
  const display = Number(fixed);
  return `${display}%`;
}

function getTaxYearConfig(yearValue) {
  const key = Number.parseInt(yearValue, 10);
  const base = TAX_YEAR_THRESHOLDS[DEFAULT_TAX_YEAR_KEY];
  if (Number.isFinite(key) && TAX_YEAR_THRESHOLDS[key]) {
    return { ...base, ...TAX_YEAR_THRESHOLDS[key], key };
  }
  return { ...base, key: DEFAULT_TAX_YEAR_KEY };
}

function getAllowanceFromTaxCode(code) {
  const match = (code || "").toUpperCase().match(/(\d{1,5})/);
  const allowance = match ? Number.parseInt(match[1], 10) * 10 : 0;
  return Number.isFinite(allowance) && allowance > 0 ? allowance : 12570;
}

function calculatePersonalAllowance(code, grossAfterPension) {
  const allowance = getAllowanceFromTaxCode(code);
  const taperStart = 100000;
  const excess = Math.max(0, grossAfterPension - taperStart);
  const taperReduction = excess / 2;
  return Math.max(0, allowance - taperReduction);
}

function calculateUkIncomeTax(grossAfterPension, personalAllowance, thresholds = null) {
  const cfg = thresholds || TAX_YEAR_THRESHOLDS[DEFAULT_TAX_YEAR_KEY];
  const basicLimit = cfg?.basicLimit ?? 50270;
  const higherLimit = cfg?.higherLimit ?? 125140;
  const allowanceUsed = Math.min(personalAllowance, grossAfterPension);
  const allowanceAdjustedIncome = grossAfterPension - allowanceUsed;
  if (!(allowanceAdjustedIncome > 0)) return 0;
  const basicCap = Math.max(0, basicLimit - allowanceUsed);
  const basicBand = Math.min(allowanceAdjustedIncome, basicCap);
  const higherBand = Math.min(
    Math.max(0, grossAfterPension - Math.max(allowanceUsed, basicLimit)),
    Math.max(0, higherLimit - basicLimit),
  );
  const additionalBand = Math.max(0, grossAfterPension - higherLimit);
  return basicBand * 0.2 + higherBand * 0.4 + additionalBand * 0.45;
}

function calculateUkNi(grossAfterPension, thresholds = null) {
  const cfg = thresholds || TAX_YEAR_THRESHOLDS[DEFAULT_TAX_YEAR_KEY];
  const primaryThreshold = cfg?.primaryNiThreshold ?? 12570;
  const upperThreshold = cfg?.upperNiThreshold ?? 50270;
  if (!(grossAfterPension > primaryThreshold)) return 0;
  const mainBand = Math.min(grossAfterPension, upperThreshold) - primaryThreshold;
  const upperBand = Math.max(0, grossAfterPension - upperThreshold);
  return mainBand * 0.08 + upperBand * 0.02;
}

function calculateStudentLoanRepayment(income, planKey) {
  const cfg = STUDENT_LOAN_PLANS[planKey] || STUDENT_LOAN_PLANS.none;
  if (!(cfg.rate > 0) || !(income > cfg.threshold)) return 0;
  return (income - cfg.threshold) * cfg.rate;
}

function formatGrossNetRate(gross, net) {
  const grossNum = Number.parseFloat(gross);
  const netNum = Number.parseFloat(net);
  if (!Number.isFinite(grossNum)) return "0%";
  if (!Number.isFinite(netNum)) return formatPercent(grossNum);
  if (Math.abs(grossNum - netNum) < 0.01) return formatPercent(grossNum);
  return `${formatPercent(grossNum)} → ${formatPercent(netNum)} after tax`;
}

function getGrossRate(asset, scenario) {
  if (!asset) return 0;
  const fallback = Number.parseFloat(asset.return) || 0;
  if (scenario === "base") return fallback;
  if (scenario === "low") {
    const low = asset.lowGrowth;
    if (low != null) {
      const val = Number.parseFloat(low);
      if (Number.isFinite(val)) return val;
    }
    return fallback;
  }
  if (scenario === "high") {
    const high = asset.highGrowth;
    if (high != null) {
      const val = Number.parseFloat(high);
      if (Number.isFinite(val)) return val;
    }
    return fallback;
  }
  return fallback;
}

function computeAssetTaxDetails() {
  if (taxComputationCache) return taxComputationCache;
  taxSettings = normalizeTaxSettings(taxSettings);
  const band = getTaxBandConfig(taxSettings.band);
  const allowances = {
    income: toNonNegativeNumber(taxSettings.incomeAllowance, 0),
    dividend: toNonNegativeNumber(taxSettings.dividendAllowance, 0),
    capital: toNonNegativeNumber(taxSettings.capitalAllowance, 0),
  };

  const scenarioTotals = SCENARIO_KEYS.reduce((acc, key) => {
    acc[key] = { income: 0, dividend: 0, capital: 0 };
    return acc;
  }, {});

  const currentValues = new Map();
  assets.forEach((asset) => {
    if (!asset) return;
    const id = asset.dateAdded;
    const baseValue = calculateCurrentValue(asset);
    currentValues.set(id, baseValue);
    const meta = getTaxTreatmentMeta(asset.taxTreatment);
    if (!meta?.totalsKey || !(baseValue > 0)) return;
    SCENARIO_KEYS.forEach((scenario) => {
      const grossRate = getGrossRate(asset, scenario);
      if (!(grossRate > 0)) return;
      const amount = baseValue * (grossRate / 100);
      scenarioTotals[scenario][meta.totalsKey] += amount;
    });
  });

  const taxableRatios = SCENARIO_KEYS.reduce((acc, key) => {
    const totals = scenarioTotals[key];
    acc[key] = {};
    ["income", "dividend", "capital"].forEach((type) => {
      const total = totals[type] || 0;
      const allowance = allowances[type] || 0;
      if (!(total > 0)) {
        acc[key][type] = 0;
        return;
      }
      const taxable = Math.max(0, total - allowance);
      acc[key][type] = Math.min(1, taxable / total);
    });
    return acc;
  }, {});

  const detailMap = new Map();
  assets.forEach((asset) => {
    if (!asset) return;
    const id = asset.dateAdded;
    const baseValue = currentValues.get(id) || 0;
    const meta = getTaxTreatmentMeta(asset.taxTreatment);
    const detail = {};
    SCENARIO_KEYS.forEach((scenario) => {
      const grossRate = getGrossRate(asset, scenario);
      const grossAmount = baseValue * (grossRate / 100);
      let taxableAmount = 0;
      let allowanceShare = 0;
      let taxDue = 0;
      let netRate = grossRate;
      let effectiveTaxRate = 0;
      if (
        meta?.totalsKey &&
        meta.rateKey &&
        baseValue > 0 &&
        grossRate > 0
      ) {
        const ratio = taxableRatios[scenario][meta.totalsKey] || 0;
        taxableAmount = grossAmount * ratio;
        allowanceShare = grossAmount - taxableAmount;
        const taxRate = band[meta.rateKey] || 0;
        taxDue = taxableAmount * (taxRate / 100);
        const netAmount = grossAmount - taxDue;
        netRate = baseValue > 0 ? (netAmount / baseValue) * 100 : grossRate;
        if (grossAmount > 0) effectiveTaxRate = taxDue / grossAmount;
      }
      detail[scenario] = {
        grossRate,
        netRate,
        annualGross: grossAmount,
        annualTax: taxDue,
        taxableAmount,
        allowanceShare,
        taxRateApplied: meta?.rateKey ? band[meta.rateKey] || 0 : 0,
        effectiveTaxRate,
      };
    });
    detailMap.set(id, detail);
  });

  const totals = SCENARIO_KEYS.reduce((acc, scenario) => {
    acc[scenario] = {};
    ["income", "dividend", "capital"].forEach((type) => {
      const total = scenarioTotals[scenario][type] || 0;
      const allowance = allowances[type] || 0;
      const taxableRatio = taxableRatios[scenario][type] || 0;
      const taxable = total * taxableRatio;
      const taxRateKey =
        type === "income"
          ? "incomeRate"
          : type === "dividend"
            ? "dividendRate"
            : "capitalGainsRate";
      const taxRate = band[taxRateKey] || 0;
      acc[scenario][type] = {
        total,
        allowance,
        taxable,
        allowanceCovered: Math.min(total, allowance),
        taxRate,
        taxDue: taxable * (taxRate / 100),
      };
    });
    return acc;
  }, {});

  taxComputationCache = { detailMap, totals, band, allowances };
  return taxComputationCache;
}

function describeAssetTax(asset, summary) {
  const meta = getTaxTreatmentMeta(asset?.taxTreatment);
  if (!meta) return "";
  return `<span class="inline-flex items-center gap-2 whitespace-nowrap">${meta.label}</span>`;
}

function clearTaxCalculatorResult() {
  const el = $("taxCalculatorResult");
  if (el) el.innerHTML = "";
}

function updateTaxSettingsUI() {
  const bandSelect = $("taxBandSelect");
  if (bandSelect && bandSelect.value !== taxSettings.band)
    bandSelect.value = taxSettings.band;
  const formatInput = (val) => {
    const num = Number.parseFloat(val);
    if (!Number.isFinite(num)) return "";
    return Number(num.toFixed(2)).toString();
  };
  const incomeInput = $("taxIncomeAllowance");
  if (incomeInput)
    incomeInput.value = formatInput(taxSettings.incomeAllowance);
  const dividendInput = $("taxDividendAllowance");
  if (dividendInput)
    dividendInput.value = formatInput(taxSettings.dividendAllowance);
  const capitalInput = $("taxCapitalAllowance");
  if (capitalInput)
    capitalInput.value = formatInput(taxSettings.capitalAllowance);
  const summary = $("taxBandSummary");
  if (summary) summary.textContent = getBandSummary(taxSettings.band);
  const allowanceSummary = $("taxAllowanceSummary");
  if (allowanceSummary)
    allowanceSummary.textContent = `Savings: ${fmtCurrency(
      taxSettings.incomeAllowance,
    )}, Dividends: ${fmtCurrency(taxSettings.dividendAllowance)}, Capital gains: ${fmtCurrency(
      taxSettings.capitalAllowance,
    )}`;
  updateTaxCalculatorInputs();
}

function applyTaxSettingsChanges({ refreshUI = false, clearCalculator = false } = {}) {
  taxSettings = normalizeTaxSettings(taxSettings);
  if (activeProfile) {
    activeProfile.taxSettings = taxSettings;
    persist();
  }
  invalidateTaxCache();
  if (refreshUI) updateTaxSettingsUI();
  renderAssets();
  refreshFireProjection();
  if (clearCalculator) clearTaxCalculatorResult();
}

const fmtDate = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
}).format;

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const sanitizePassiveSelection = (raw) => {
  if (raw == null) return null;
  const source = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.ids)
      ? raw.ids
      : null;
  if (!Array.isArray(source)) return null;
  const seen = new Set();
  const normalized = [];
  source.forEach((entry) => {
    const id = Number(entry);
    if (Number.isFinite(id) && !seen.has(id)) {
      seen.add(id);
      normalized.push(id);
    }
  });
  return normalized;
};

function loadPassiveAssetSelection(profile) {
  if (!profile) {
    passiveAssetSelection = null;
    return;
  }
  const rawSelection =
    profile.passiveIncomeAssetSelection ?? profile.passiveIncomeSelection;
  const normalized = sanitizePassiveSelection(rawSelection);
  if (normalized === null) {
    passiveAssetSelection = null;
    profile.passiveIncomeAssetSelection = null;
    return;
  }
  profile.passiveIncomeAssetSelection = normalized;
  passiveAssetSelection = new Set(normalized);
}

function normalizeImportedProfile(profile, index = 0) {
  const baseId =
    profile?.id != null && profile.id !== ""
      ? profile.id
      : Date.now() + index;
  return {
    id: baseId,
    name: profile?.name || `Profile ${index + 1}`,
    assets: ensureArray(profile?.assets).map((asset) => {
      if (!asset || typeof asset !== "object") return asset;
      return {
        ...asset,
        depositDay: DEFAULT_DEPOSIT_DAY,
      };
    }),
    incomes: ensureArray(profile?.incomes),
    liabilities: ensureArray(profile?.liabilities),
    snapshots: ensureArray(profile?.snapshots),
    simEvents: ensureArray(profile?.simEvents),
    goalValue: profile?.goalValue || 0,
    goalTargetDate: profile?.goalTargetDate || null,
    inflationRate:
      profile?.inflationRate != null ? profile.inflationRate : 2.5,
    fireExpenses:
      profile?.fireExpenses != null ? profile.fireExpenses : 0,
    fireExpensesFrequency:
      profile?.fireExpensesFrequency === "monthly" ? "monthly" : "annual",
    fireWithdrawalRate:
      profile?.fireWithdrawalRate > 0 ? profile.fireWithdrawalRate : 4,
    fireProjectionYears:
      profile?.fireProjectionYears > 0 ? profile.fireProjectionYears : 30,
    fireForecastCosts:
      profile?.fireForecastCosts != null ? profile.fireForecastCosts : 0,
    fireForecastFrequency:
      profile?.fireForecastFrequency === "monthly" ? "monthly" : "annual",
    fireForecastInflation:
      profile?.fireForecastInflation >= 0
        ? profile.fireForecastInflation
        : 2.5,
    fireForecastRetireDate:
      profile?.fireForecastRetireDate != null &&
      isFinite(profile.fireForecastRetireDate)
        ? profile.fireForecastRetireDate
        : null,
    taxSettings: normalizeTaxSettings(profile?.taxSettings),
    themeChoice: sanitizeThemeChoice(profile?.themeChoice),
    darkMode: !!profile?.darkMode,
    passiveIncomeAssetSelection: sanitizePassiveSelection(
      profile?.passiveIncomeAssetSelection ?? profile?.passiveIncomeSelection,
    ),
    mobileNavSticky: sanitizeMobileNavSticky(
      profile?.mobileNavSticky,
      readStoredMobileNavSticky(),
    ),
    scenarioEventsEnabled:
      profile?.scenarioEventsEnabled != null
        ? !!profile.scenarioEventsEnabled
        : true,
  };
}

function prepareImportedProfiles(data) {
  if (Array.isArray(data?.profiles) && data.profiles.length > 0) {
    const normalized = data.profiles.map((profile, index) =>
      normalizeImportedProfile(profile, index),
    );
    const activeCandidate = data?.activeProfileId;
    const active =
      normalized.find((p) => p.id == activeCandidate)?.id ||
      normalized[0]?.id ||
      null;
    return { profiles: normalized, activeProfileId: active };
  }
  const fallbackProfile = normalizeImportedProfile(
    {
      id: data?.id ?? Date.now(),
      name: data?.name || data?.profileName || "Imported",
      assets: data?.assets,
      liabilities: data?.liabilities,
      snapshots: data?.snapshots,
      simEvents: data?.simEvents,
      goalValue: data?.goalValue,
      goalTargetDate: data?.goalTargetDate,
      inflationRate: data?.inflationRate,
      fireExpenses: data?.fireExpenses,
      fireExpensesFrequency: data?.fireExpensesFrequency,
      fireWithdrawalRate: data?.fireWithdrawalRate,
      fireProjectionYears: data?.fireProjectionYears,
      fireForecastCosts: data?.fireForecastCosts,
      fireForecastFrequency: data?.fireForecastFrequency,
      fireForecastInflation: data?.fireForecastInflation,
      fireForecastRetireDate: data?.fireForecastRetireDate,
    },
    0,
  );
  return { profiles: [fallbackProfile], activeProfileId: fallbackProfile.id };
}

function parseImportPayload(rawContent, password) {
  let json = rawContent;
  if (password) {
    const bytes = CryptoJS.AES.decrypt(json, password);
    json = bytes.toString(CryptoJS.enc.Utf8);
    if (!json) throw new Error("Decryption failed");
  }
  const data = JSON.parse(json);
  return prepareImportedProfiles(data);
}

function attemptImportPreview() {
  if (!importFileContent) {
    importPreviewData = null;
    resetProfilePicker("import");
    return;
  }
  const passwordInput = getLatestById("importPassword");
  const password = passwordInput ? passwordInput.value : "";
  try {
    const parsed = parseImportPayload(importFileContent, password);
    importPreviewData = parsed;
    populateProfilePickerOptions("import", parsed.profiles);
  } catch (err) {
    importPreviewData = null;
    if (password) {
      resetProfilePicker(
        "import",
        "Enter the correct password to preview profiles",
        {
          hint: "Unable to decrypt with the current password. Adjust the password to preview profiles.",
        },
      );
    } else {
      resetProfilePicker(
        "import",
        "Select a file to choose profiles",
        {
          hint: "Provide the file password if it was encrypted to preview its profiles.",
        },
      );
    }
  }
}

function saveCurrentProfile() {
  if (!activeProfile) return;
  activeProfile.assets = assets;
  activeProfile.incomes = incomes;
  activeProfile.liabilities = liabilities;
  activeProfile.snapshots = snapshots;
  activeProfile.simEvents = simEvents;
  activeProfile.scenarioEventsEnabled = scenarioEventsEnabled;
  activeProfile.goalValue = goalValue;
  activeProfile.goalTargetDate = goalTargetDate;
  activeProfile.inflationRate = inflationRate;
  activeProfile.fireExpenses = fireExpenses;
  activeProfile.fireExpensesFrequency = fireExpensesFrequency;
  activeProfile.fireWithdrawalRate = fireWithdrawalRate;
  activeProfile.fireProjectionYears = fireProjectionYears;
  activeProfile.fireForecastCosts = fireForecastCosts;
  activeProfile.fireForecastFrequency = fireForecastFrequency;
  activeProfile.fireForecastInflation = fireForecastInflation;
  activeProfile.fireForecastRetireDate = fireForecastRetireDate;
  activeProfile.taxSettings = normalizeTaxSettings(taxSettings);
  activeProfile.themeChoice = currentThemeChoice;
  activeProfile.darkMode = isDarkMode;
  activeProfile.mobileNavSticky = isMobileNavSticky;
  if (passiveAssetSelection === null) {
    activeProfile.passiveIncomeAssetSelection = null;
  } else {
    activeProfile.passiveIncomeAssetSelection = Array.from(
      passiveAssetSelection,
    );
  }
}
function persist() {
  saveCurrentProfile();
  save(LS.profiles, profiles);
  if (activeProfile)
    localStorage.setItem(LS.activeProfile, activeProfile.id);
}

function updateGoalButton() {
  const btn = $("goalBtn");
  if (btn) btn.textContent = goalValue > 0 && goalTargetDate ? "Update" : "Set";
}

const perYear = { none: 0, monthly: 12, quarterly: 4, yearly: 1 };
const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;
const monthlyFrom = (freq, amount) =>
  ({
    none: 0,
    monthly: amount,
    quarterly: amount / 3,
    yearly: amount / 12,
  })[freq] || 0;
const DEFAULT_DEPOSIT_DAY = 31;
const clampDepositDay = (value, fallback = DEFAULT_DEPOSIT_DAY) => {
  const raw = Number.parseInt(value, 10);
  if (!Number.isFinite(raw)) return fallback;
  if (raw < 1) return 1;
  if (raw > 31) return 31;
  return raw;
};
const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();
const buildDepositDate = (year, monthIndex, depositDay) => {
  const day = clampDepositDay(depositDay);
  const limit = daysInMonth(year, monthIndex);
  const clampedDay = Math.min(day, limit);
  const date = new Date(year, monthIndex, clampedDay);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};
const addMonthsForDeposit = (timestamp, monthsToAdd, depositDay) => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  const targetMonth = date.getMonth() + monthsToAdd;
  const year = date.getFullYear() + Math.floor(targetMonth / 12);
  const monthIndex = ((targetMonth % 12) + 12) % 12;
  return buildDepositDate(year, monthIndex, depositDay);
};
const firstDepositOnOrAfter = (startTs, monthsPerPeriod, depositDay) => {
  if (!(monthsPerPeriod > 0)) return null;
  const startDate = new Date(startTs);
  startDate.setHours(0, 0, 0, 0);
  let year = startDate.getFullYear();
  let monthIndex = startDate.getMonth();
  let candidate = buildDepositDate(year, monthIndex, depositDay);
  while (candidate <= startTs) {
    monthIndex += monthsPerPeriod;
    year += Math.floor(monthIndex / 12);
    monthIndex = ((monthIndex % 12) + 12) % 12;
    candidate = buildDepositDate(year, monthIndex, depositDay);
    if (!Number.isFinite(candidate)) return null;
  }
  return candidate;
};
const DEPOSIT_MONTH_STEPS = { monthly: 1, quarterly: 3, yearly: 12 };

const createDepositIterator = (asset, referenceTime = Date.now()) => {
  if (!asset) return null;
  const monthsPerPeriod = DEPOSIT_MONTH_STEPS[asset.frequency] || 0;
  if (!(monthsPerPeriod > 0)) return null;
  const amountRaw = Number.parseFloat(asset.originalDeposit);
  if (!(amountRaw > 0)) return null;
  const depositDay = DEFAULT_DEPOSIT_DAY;
  const start = getStartDate(asset);
  const scheduleStart = Math.max(referenceTime, start);
  let nextDeposit = firstDepositOnOrAfter(
    scheduleStart,
    monthsPerPeriod,
    depositDay,
  );
  if (!Number.isFinite(nextDeposit)) return null;
  const consumeBefore = (limit) => {
    if (!Number.isFinite(limit) || nextDeposit == null) return 0;
    let total = 0;
    let iterations = 0;
    const safetyLimit = 1000;
    while (nextDeposit != null && nextDeposit < limit && iterations < safetyLimit) {
      total += amountRaw;
      const candidate = addMonthsForDeposit(
        nextDeposit,
        monthsPerPeriod,
        depositDay,
      );
      if (!Number.isFinite(candidate) || candidate <= nextDeposit) {
        nextDeposit = null;
        break;
      }
      nextDeposit = candidate;
      iterations += 1;
    }
    return total;
  };
  return {
    consumeBefore,
    peekNext: () => nextDeposit,
  };
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const toTimestamp = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value) return null;
  const parsed = new Date(value);
  const time = parsed.getTime();
  return Number.isFinite(time) ? time : null;
};

const parseDateInput = (value, fallback) => {
  const defaultTime = Number.isFinite(fallback) ? fallback : startOfToday();
  if (!value) return defaultTime;

  // Treat ISO "YYYY-MM-DD" values as local dates instead of UTC to avoid the
  // browser shifting Sunday selections (and other days) to the previous day in
  // negative timezones.
  const isoMatch = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (isoMatch) {
    const [year, month, day] = value.split("-").map((part) => parseInt(part, 10));
    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day)
    ) {
      const localDate = new Date(year, month - 1, day);
      if (Number.isFinite(localDate.getTime())) {
        localDate.setHours(0, 0, 0, 0);
        return localDate.getTime();
      }
    }
  }

  const parsed = new Date(value);
  const time = parsed.getTime();
  if (!Number.isFinite(time)) return defaultTime;
  parsed.setHours(0, 0, 0, 0);
  return parsed.getTime();
};

const toDateInputValue = (timestamp) => {
  const time = toTimestamp(timestamp);
  if (time == null) return "";
  const date = new Date(time);
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getStartDate = (item) => {
  if (!item) return startOfToday();
  const start = toTimestamp(item.startDate);
  if (start != null) return start;
  const added = toTimestamp(item.dateAdded);
  if (added != null) return added;
  return startOfToday();
};

// Seed a simple demo profile (creates/uses a profile named "Demo")
function loadDemoData() {
  const seedIntoActive = () => {
    const now = Date.now();
    // Assets
    assets = [
      {
        name: "Cash",
        value: 3000,
        originalDeposit: 0,
        frequency: "none",
        dateAdded: now - 1000 * 60 * 60 * 24 * 60,
        startDate: now - 1000 * 60 * 60 * 24 * 60,
        return: 0,
        lowGrowth: 0,
        highGrowth: 0,
        monthlyDeposit: monthlyFrom("none", 0),
        includeInPassive: true,
        taxTreatment: "income",
        depositDay: DEFAULT_DEPOSIT_DAY,
      },
      {
        name: "Index Fund",
        value: 20000,
        originalDeposit: 500,
        frequency: "monthly",
        dateAdded: now - 1000 * 60 * 60 * 24 * 45,
        startDate: now - 1000 * 60 * 60 * 24 * 45,
        return: 5,
        lowGrowth: 2,
        highGrowth: 8,
        monthlyDeposit: monthlyFrom("monthly", 500),
        includeInPassive: true,
        taxTreatment: "capital-gains",
        depositDay: DEFAULT_DEPOSIT_DAY,
      },
      {
        name: "Bond Fund",
        value: 10000,
        originalDeposit: 200,
        frequency: "monthly",
        dateAdded: now - 1000 * 60 * 60 * 24 * 30,
        startDate: now - 1000 * 60 * 60 * 24 * 30,
        return: 3,
        lowGrowth: 1,
        highGrowth: 5,
        monthlyDeposit: monthlyFrom("monthly", 200),
        includeInPassive: true,
        taxTreatment: "income",
        depositDay: DEFAULT_DEPOSIT_DAY,
      },
    ];
    incomes = [
      {
        name: "Monthly Salary",
        amount: 4000,
        frequency: "monthly",
        dateAdded: now - 1000 * 60 * 60 * 24 * 50,
        startDate: now - 1000 * 60 * 60 * 24 * 50,
        monthlyAmount: monthlyFrom("monthly", 4000),
      },
    ];
    passiveAssetSelection = null;
    if (activeProfile) activeProfile.passiveIncomeAssetSelection = null;

    // Optional liability example
    liabilities = [
      {
        name: "Student Loan",
        value: 5000,
        interest: 3,
        originalPayment: 120,
        frequency: "monthly",
        dateAdded: now - 1000 * 60 * 60 * 24 * 20,
        startDate: now - 1000 * 60 * 60 * 24 * 20,
        monthlyPayment: monthlyFrom("monthly", 120),
      },
    ];

    // A couple of what-if events
    const nextYear = new Date(new Date().getFullYear() + 1, 0, 15).getTime();
    const twoYears = new Date(new Date().getFullYear() + 2, 5, 1).getTime();
    simEvents = [
      { name: "Bonus", amount: 2000, isPercent: false, date: nextYear },
      { name: "Car Purchase", amount: -10000, isPercent: false, date: twoYears },
    ];
    scenarioEventsEnabled = true;

    // Goal in ~10 years; calibrate so only High hits the goal
    const targetYr = new Date().getFullYear() + 10;
    goalTargetDate = new Date(targetYr, 11, 31).getTime();
    // Build scenarios and pick a goal between Base and High (above Base, below High)
    const scenarios = buildForecastScenarios();
    const lastIdx = scenarios.base.length - 1;
    const baseEnd = scenarios.base[lastIdx];
    const highEnd = scenarios.high[lastIdx];
    // Choose a goal 10% above Base but 5% below High (fallback to midpoint)
    let proposed = Math.min(highEnd * 0.95, Math.max(baseEnd * 1.1, (baseEnd + highEnd) / 2));
    if (!(proposed > baseEnd && proposed < highEnd)) proposed = (baseEnd + highEnd) * 0.6;
    // Round to nearest 1,000 for a clean number
    goalValue = Math.max(1000, Math.round(proposed / 1000) * 1000);

    fireExpenses = 30000;
    fireExpensesFrequency = "annual";
    fireWithdrawalRate = 4;
    fireLastInputs = {
      annualExpenses: fireExpenses,
      withdrawalRate: fireWithdrawalRate,
    };
    fireForecastCosts = fireExpenses;
    fireForecastFrequency = "annual";
    fireForecastInflation = inflationRate;
    fireForecastRetireDate = goalTargetDate;

    taxSettings = normalizeTaxSettings({ band: "basic" });
    activeProfile.taxSettings = taxSettings;
    invalidateTaxCache();

    updateFireFormInputs();
    updateFireForecastInputs();

    // Push to UI and storage
    $("goalValue").value = goalValue || "";
    $("goalYear").value = targetYr;
    renderAssets();
    renderIncomes();
    renderLiabilities();
    renderEvents();
    updateTaxSettingsUI();
    updateGoalButton();
    updateWealthChart();
    updateEmptyStates();
    refreshFireProjection();
    persist();

    showAlert("Demo data loaded into the Demo profile. Only High growth meets the goal by your target year.", () => {
      navigateTo("forecasts");
    });
  };

  const demo = (profiles || []).find(
    (p) => (p.name || "").toLowerCase() === "demo",
  );

  if (demo) {
    showConfirm('Replace data in the "Demo" profile?', () => {
      switchProfile(demo.id);
      seedIntoActive();
    });
  } else {
    // Create a fresh Demo profile and seed it
    addProfile("Demo");
    // addProfile switches to the new profile
    seedIntoActive();
  }
}

function normalizeData() {
  assets.forEach((a) => {
    if (!a || typeof a !== "object") return;
    const added = toTimestamp(a.dateAdded) ?? Date.now();
    a.dateAdded = added;
    const existingExplicit = toTimestamp(a.explicitStartDate);
    const start = toTimestamp(a.startDate);
    const inferredExplicit = existingExplicit != null
      ? existingExplicit
      : start != null && start !== added
        ? start
        : null;
    a.explicitStartDate = inferredExplicit;
    a.startDate = start ?? added;
    if (a.originalDeposit == null) a.originalDeposit = 0;
    if (!a.frequency) a.frequency = "none";
    if (a.monthlyDeposit == null)
      a.monthlyDeposit = monthlyFrom(a.frequency, a.originalDeposit);
    a.depositDay = DEFAULT_DEPOSIT_DAY;
    const ret = parseFloat(a.return) || 0;
    if (a.lowGrowth == null) a.lowGrowth = ret;
    if (a.highGrowth == null) a.highGrowth = ret;
    if (a.includeInPassive === undefined) a.includeInPassive = true;
    a.taxTreatment = normalizeTaxTreatment(a.taxTreatment);
  });
  incomes.forEach((inc) => {
    if (!inc || typeof inc !== "object") return;
    const added = toTimestamp(inc.dateAdded) ?? Date.now();
    inc.dateAdded = added;
    const existingExplicit = toTimestamp(inc.explicitStartDate);
    const start = toTimestamp(inc.startDate);
    const inferredExplicit =
      existingExplicit != null
        ? existingExplicit
        : start != null && start !== added
          ? start
          : null;
    inc.explicitStartDate = inferredExplicit;
    inc.startDate = start ?? added;
    if (!inc.frequency) inc.frequency = "monthly";
    if (inc.amount == null) inc.amount = 0;
    if (inc.monthlyAmount == null)
      inc.monthlyAmount = monthlyFrom(inc.frequency, inc.amount);
  });
  liabilities.forEach((l) => {
    if (!l || typeof l !== "object") return;
    const added = toTimestamp(l.dateAdded) ?? Date.now();
    l.dateAdded = added;
    const existingExplicit = toTimestamp(l.explicitStartDate);
    const start = toTimestamp(l.startDate);
    const inferredExplicit = existingExplicit != null
      ? existingExplicit
      : start != null && start !== added
        ? start
        : null;
    l.explicitStartDate = inferredExplicit;
    l.startDate = start ?? added;
    if (l.originalPayment == null) l.originalPayment = 0;
    if (!l.frequency) l.frequency = "none";
    if (l.monthlyPayment == null)
      l.monthlyPayment = monthlyFrom(l.frequency, l.originalPayment);
    if (l.value == null) l.value = 0;
    if (l.interest == null) l.interest = 0;
  });
  simEvents.forEach((ev) => {
    if (!ev) return;
    if (ev.assetId != null) ev.assetId = Number(ev.assetId);
    ev.isPercent = !!ev.isPercent;
  });
  simEvents.sort((a, b) => a.date - b.date);
  invalidateTaxCache();
}

function initProfiles() {
  profiles = load(LS.profiles, null);
  let id = localStorage.getItem(LS.activeProfile);
  const storedNavSticky = readStoredMobileNavSticky();
  try {
    localStorage.removeItem(storageKey("currency"));
    localStorage.removeItem("currency");
  } catch (_) {}
  if (!profiles) {
    const def = {
      id: Date.now(),
      name: "Default",
      assets: load(LS.assets, []),
      liabilities: load(LS.liabs, []),
      snapshots: load(LS.snaps, []),
      simEvents: load(LS.events, []),
      goalValue: +localStorage.getItem(LS.goal) || 0,
      goalTargetDate: +localStorage.getItem(LS.goalDate) || null,
      fireExpenses: 0,
      fireExpensesFrequency: "annual",
      fireWithdrawalRate: 4,
      fireProjectionYears: 30,
      fireForecastCosts: 0,
      fireForecastFrequency: "annual",
      fireForecastInflation: 2.5,
      fireForecastRetireDate: null,
      taxSettings: normalizeTaxSettings(),
      themeChoice: sanitizeThemeChoice(
        localStorage.getItem(LS.themeChoice) || "default",
      ),
      darkMode: localStorage.getItem(LS.theme) === "1",
      passiveIncomeAssetSelection: null,
      firstTimeContentHidden: getStoredFirstTimeHidden(),
      mobileNavSticky: storedNavSticky,
      scenarioEventsEnabled: true,
    };
    profiles = [def];
    id = def.id;
    save(LS.profiles, profiles);
  }
  if (profiles) {
    const fallbackThemeChoice = currentThemeChoice;
    const fallbackDarkMode = isDarkMode;
    let profilesUpdated = false;
    profiles.forEach((p) => {
      p.taxSettings = normalizeTaxSettings(p.taxSettings);
      if (p.fireExpenses == null) p.fireExpenses = 0;
      p.fireExpensesFrequency =
        p.fireExpensesFrequency === "monthly" ? "monthly" : "annual";
      if (!(p.fireWithdrawalRate > 0)) p.fireWithdrawalRate = 4;
      if (!(p.fireProjectionYears > 0)) p.fireProjectionYears = 30;
      if (p.fireForecastCosts == null) p.fireForecastCosts = 0;
      p.fireForecastFrequency =
        p.fireForecastFrequency === "monthly" ? "monthly" : "annual";
      if (!(p.fireForecastInflation >= 0)) p.fireForecastInflation = 2.5;
      if (
        p.fireForecastRetireDate != null &&
        !isFinite(p.fireForecastRetireDate)
      )
        p.fireForecastRetireDate = null;
      if (Object.prototype.hasOwnProperty.call(p, "currencyCode")) {
        delete p.currencyCode;
        profilesUpdated = true;
      }
      if (Object.prototype.hasOwnProperty.call(p, "currency")) {
        delete p.currency;
        profilesUpdated = true;
      }
      if (p.themeChoice != null && p.themeChoice !== "") {
        const sanitizedTheme = sanitizeThemeChoice(p.themeChoice);
        if (sanitizedTheme !== p.themeChoice) {
          p.themeChoice = sanitizedTheme;
          profilesUpdated = true;
        }
      } else if (
        fallbackThemeChoice != null &&
        p.themeChoice !== fallbackThemeChoice
      ) {
        p.themeChoice = fallbackThemeChoice;
        profilesUpdated = true;
      }
      if (p.darkMode != null) {
        const normalizedDark = !!p.darkMode;
        if (normalizedDark !== p.darkMode) {
          p.darkMode = normalizedDark;
          profilesUpdated = true;
        }
      } else if (p.darkMode !== fallbackDarkMode) {
        p.darkMode = fallbackDarkMode;
        profilesUpdated = true;
      }
      if (Object.prototype.hasOwnProperty.call(p, "firstTimeContentHidden")) {
        const normalizedHidden = !!p.firstTimeContentHidden;
        if (normalizedHidden !== p.firstTimeContentHidden) {
          p.firstTimeContentHidden = normalizedHidden;
          profilesUpdated = true;
        }
      } else {
        p.firstTimeContentHidden = getStoredFirstTimeHidden();
        profilesUpdated = true;
      }
      if (Object.prototype.hasOwnProperty.call(p, "mobileNavSticky")) {
        const normalizedSticky = sanitizeMobileNavSticky(
          p.mobileNavSticky,
          storedNavSticky,
        );
        if (normalizedSticky !== p.mobileNavSticky) {
          p.mobileNavSticky = normalizedSticky;
          profilesUpdated = true;
        }
      } else {
        p.mobileNavSticky = storedNavSticky;
        profilesUpdated = true;
      }
      if (!Object.prototype.hasOwnProperty.call(p, "scenarioEventsEnabled")) {
        p.scenarioEventsEnabled = true;
        profilesUpdated = true;
      } else {
        const normalizedScenario = !!p.scenarioEventsEnabled;
        if (normalizedScenario !== p.scenarioEventsEnabled) {
          p.scenarioEventsEnabled = normalizedScenario;
          profilesUpdated = true;
        }
      }
      const normalizedSelection = sanitizePassiveSelection(
        p.passiveIncomeAssetSelection ?? p.passiveIncomeSelection,
      );
      const previousSelection = sanitizePassiveSelection(
        p.passiveIncomeAssetSelection,
      );
      const selectionsMatch =
        (previousSelection === null && normalizedSelection === null) ||
        (Array.isArray(previousSelection) &&
          Array.isArray(normalizedSelection) &&
          previousSelection.length === normalizedSelection.length &&
          previousSelection.every((val, idx) => val === normalizedSelection[idx]));
      if (!selectionsMatch || p.passiveIncomeSelection != null) {
        profilesUpdated = true;
      }
      p.passiveIncomeAssetSelection = normalizedSelection;
      if (p.passiveIncomeSelection != null) delete p.passiveIncomeSelection;
    });
    if (profilesUpdated) save(LS.profiles, profiles);
  }
  activeProfile = profiles.find((p) => p.id == id) || profiles[0];
  assets = activeProfile.assets || [];
  liabilities = activeProfile.liabilities || [];
  snapshots = activeProfile.snapshots || [];
  simEvents = activeProfile.simEvents || [];
  scenarioEventsEnabled =
    activeProfile.scenarioEventsEnabled != null
      ? !!activeProfile.scenarioEventsEnabled
      : true;
  activeProfile.scenarioEventsEnabled = scenarioEventsEnabled;
  goalValue = activeProfile.goalValue || 0;
  goalTargetDate = activeProfile.goalTargetDate || null;
  inflationRate =
    activeProfile.inflationRate != null ? activeProfile.inflationRate : 2.5;
  fireExpenses =
    activeProfile.fireExpenses != null ? activeProfile.fireExpenses : 0;
  fireExpensesFrequency =
    activeProfile.fireExpensesFrequency === "monthly"
      ? "monthly"
      : "annual";
  fireWithdrawalRate =
    activeProfile.fireWithdrawalRate > 0
      ? activeProfile.fireWithdrawalRate
      : 4;
  fireProjectionYears =
    activeProfile.fireProjectionYears && activeProfile.fireProjectionYears > 0
      ? activeProfile.fireProjectionYears
      : 30;
  fireForecastCosts =
    activeProfile.fireForecastCosts != null
      ? activeProfile.fireForecastCosts
      : 0;
  fireForecastFrequency =
    activeProfile.fireForecastFrequency === "monthly"
      ? "monthly"
      : "annual";
  fireForecastInflation =
    activeProfile.fireForecastInflation >= 0
      ? activeProfile.fireForecastInflation
      : 2.5;
  fireForecastRetireDate =
    activeProfile.fireForecastRetireDate &&
    isFinite(activeProfile.fireForecastRetireDate)
      ? activeProfile.fireForecastRetireDate
      : null;
  fireLastInputs =
    fireExpenses > 0 && fireWithdrawalRate > 0
      ? { annualExpenses: fireExpenses, withdrawalRate: fireWithdrawalRate }
      : null;
  activeProfile.fireExpenses = fireExpenses;
  activeProfile.fireExpensesFrequency = fireExpensesFrequency;
  activeProfile.fireWithdrawalRate = fireWithdrawalRate;
  activeProfile.fireProjectionYears = fireProjectionYears;
  activeProfile.fireForecastCosts = fireForecastCosts;
  activeProfile.fireForecastFrequency = fireForecastFrequency;
  activeProfile.fireForecastInflation = fireForecastInflation;
  activeProfile.fireForecastRetireDate = fireForecastRetireDate;
  normalizeData();
  loadPassiveAssetSelection(activeProfile);
  taxSettings = normalizeTaxSettings(activeProfile.taxSettings);
  activeProfile.taxSettings = taxSettings;
  invalidateTaxCache();
  applyProfilePreferences(activeProfile);
  applyFirstTimeContentHidden(isFirstTimeContentHidden(activeProfile), {
    persistProfile: false,
  });
  localStorage.setItem(LS.activeProfile, activeProfile.id);
}
initProfiles();

const calculateCurrentValue = (asset, now = Date.now()) => {
  if (!asset) return 0;
  const start = getStartDate(asset);
  if (now < start) return 0;
  const value = Number.parseFloat(asset.value);
  return Number.isFinite(value) ? value : 0;
};

const getPassiveIncomeTargetDate = () => {
  const today = startOfToday();
  if (Number.isFinite(passiveIncomeAsOf)) {
    return Math.max(passiveIncomeAsOf, today);
  }
  return today;
};

const applyPassiveGrowth = (value, fromTime, toTime, annualRate) => {
  if (!(toTime > fromTime) || !Number.isFinite(value)) return value || 0;
  const years = (toTime - fromTime) / MS_PER_YEAR;
  if (!(years > 0)) return value || 0;
  const rateDecimal = (parseFloat(annualRate) || 0) / 100;
  if (rateDecimal === 0) return value || 0;
  const base = 1 + rateDecimal;
  if (base <= 0) return 0;
  const factor = Math.pow(base, years);
  if (!Number.isFinite(factor)) return value || 0;
  return (value || 0) * factor;
};

const applyEventToValue = (value, event) => {
  if (!event) return value || 0;
  if (event.isPercent) {
    const factor = 1 + (parseFloat(event.amount) || 0) / 100;
    return (value || 0) * factor;
  }
  return (value || 0) + (parseFloat(event.amount) || 0);
};

const calculatePassiveAssetValueAt = (
  asset,
  targetTs,
  eventsByAsset,
  nowTs = Date.now(),
) => {
  if (!asset) return 0;
  const startTimestamp = getStartDate(asset);
  if (!(targetTs >= startTimestamp)) return 0;
  const assetEventsRaw = eventsByAsset.get(asset.dateAdded) || [];
  const relevantEvents = [];
  for (let i = 0; i < assetEventsRaw.length; i++) {
    const ev = assetEventsRaw[i];
    if (!ev) continue;
    if (ev.date < startTimestamp) continue;
    if (ev.date > targetTs) break;
    relevantEvents.push(ev);
  }

  const cutoff = Math.min(targetTs, nowTs);
  let value;
  let referenceTime;
  if (cutoff >= startTimestamp) {
    value = calculateCurrentValue(asset, cutoff);
    for (let i = 0; i < relevantEvents.length; i++) {
      const ev = relevantEvents[i];
      if (ev.date > cutoff) break;
      value = applyEventToValue(value, ev);
    }
    referenceTime = cutoff;
  } else {
    value = parseFloat(asset.value) || 0;
    for (let i = 0; i < relevantEvents.length; i++) {
      const ev = relevantEvents[i];
      if (ev.date > startTimestamp) break;
      value = applyEventToValue(value, ev);
    }
    referenceTime = startTimestamp;
  }

  if (targetTs <= referenceTime) return value || 0;

  let prevTime = referenceTime;
  const taxDetail = computeAssetTaxDetails().detailMap.get(asset.dateAdded);
  const annualRate =
    (taxDetail?.base?.netRate ?? parseFloat(asset.return)) || 0;
  for (let i = 0; i < relevantEvents.length; i++) {
    const ev = relevantEvents[i];
    if (ev.date <= referenceTime) continue;
    if (ev.date > targetTs) break;
    value = applyPassiveGrowth(value, prevTime, ev.date, annualRate);
    prevTime = ev.date;
    value = applyEventToValue(value, ev);
  }
  if (targetTs > prevTime) {
    value = applyPassiveGrowth(value, prevTime, targetTs, annualRate);
  }
  return value || 0;
};

const liabilityBalanceAfterMonths = (liability, months) => {
  let balance = liability.value;
  const rate = (liability.interest || 0) / 100 / 12;
  const pay = liability.monthlyPayment || 0;
  for (let i = 0; i < months && balance > 0; i++) {
    balance = balance * (1 + rate);
    balance = Math.max(0, balance - Math.min(balance, pay));
  }
  return balance;
};

const calculateCurrentLiability = (liability, now = Date.now()) => {
  if (!liability) return 0;
  const start = getStartDate(liability);
  if (now < start) return 0;
  const years = (now - start) / (1000 * 60 * 60 * 24 * 365.25);
  const months = Math.floor(years * 12);
  return liabilityBalanceAfterMonths(liability, months);
};

function calculateNetWorth(now = Date.now()) {
  const totalAssets = assets.reduce(
    (sum, asset) => sum + calculateCurrentValue(asset, now),
    0,
  );
  const totalLiabilities = liabilities.reduce(
    (sum, liability) => sum + calculateCurrentLiability(liability, now),
    0,
  );
  return totalAssets - totalLiabilities;
}
function calculatePassiveWorth(now = Date.now()) {
  return assets.reduce((sum, asset) => {
    if (!asset || asset.includeInPassive === false) return sum;
    return sum + calculateCurrentValue(asset, now);
  }, 0);
}

function calculateFutureValue(P, monthly, annualRate, years) {
  const r = annualRate / 100 / 12;
  const n = Math.round(years * 12);
  if (r === 0) return P + monthly * n;
  return (
    P * Math.pow(1 + r, n) + monthly * ((Math.pow(1 + r, n) - 1) / r)
  );
}

// Generic FV with selectable compounding frequency (periods per year)
function calculateFutureValueFreq(
  P,
  contributionPerPeriod,
  annualRate,
  years,
  periodsPerYear,
) {
  const r = annualRate / 100 / (periodsPerYear || 12);
  const n = Math.round(years * (periodsPerYear || 12));
  if (r === 0) return P + contributionPerPeriod * n;
  return (
    P * Math.pow(1 + r, n) +
    contributionPerPeriod * ((Math.pow(1 + r, n) - 1) / r)
  );
}

// Forecast labels memo
const getForecastLabels = (() => {
  const memo = new Map();
  return (years) => {
    if (memo.has(years)) return memo.get(years);
    const totalMonths = years * 12;
    const labels = Array.from({ length: totalMonths + 1 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() + i, 1);
      d.setHours(0, 0, 0, 0);
      return d;
    });
    memo.set(years, labels);
    return labels;
  };
})();

function buildForecastScenarios(yearsOverride = null, opts = {}) {
  const passiveOnly = !!(opts && opts.passiveOnly);
  const includeBreakdown = !!(opts && opts.includeBreakdown);
  const years = yearsOverride && yearsOverride > 0 ? yearsOverride : getGoalHorizonYears();
  const labels = getForecastLabels(years);
  const totalMonths = years * 12;
  const nowTs = Date.now();

  const base = Array(labels.length).fill(0);
  const low = Array(labels.length).fill(0);
  const high = Array(labels.length).fill(0);
  const assetTotalsBase = includeBreakdown
    ? Array(labels.length).fill(0)
    : null;
  const assetTotalsLow = includeBreakdown
    ? Array(labels.length).fill(0)
    : null;
  const assetTotalsHigh = includeBreakdown
    ? Array(labels.length).fill(0)
    : null;
  const liabilityTotalsBase = includeBreakdown
    ? Array(labels.length).fill(0)
    : null;
  const liabilityTotalsLow = includeBreakdown
    ? Array(labels.length).fill(0)
    : null;
  const liabilityTotalsHigh = includeBreakdown
    ? Array(labels.length).fill(0)
    : null;
  const incomeTotalsBase = Array(labels.length).fill(0);
  const incomeTotalsLow = Array(labels.length).fill(0);
  const incomeTotalsHigh = Array(labels.length).fill(0);
  const liabilityPaymentTotals = includeBreakdown
    ? Array(labels.length).fill(0)
    : null;
  const netCashFlowBase = Array(labels.length).fill(0);
  const netCashFlowLow = Array(labels.length).fill(0);
  const netCashFlowHigh = Array(labels.length).fill(0);
  let cumulativeLiabilityPayments = null;

  const nextAssetForecasts = new Map();
  const assetDetails = includeBreakdown ? [] : null;
  let incomeDetail = null;
  const globalEvents = [];
  const eventsByAsset = new Map();
  const activeEvents = scenarioEventsEnabled ? simEvents : [];
  const consideredAssets = passiveOnly
    ? assets.filter((a) => a && a.includeInPassive !== false)
    : assets;
  const assetIds = new Set(consideredAssets.map((a) => a.dateAdded));
  const taxDetails = computeAssetTaxDetails();
  const taxDetailMap = taxDetails.detailMap;

  activeEvents.forEach((ev) => {
    if (ev.assetId && assetIds.has(ev.assetId)) {
      if (!eventsByAsset.has(ev.assetId)) eventsByAsset.set(ev.assetId, []);
      eventsByAsset.get(ev.assetId).push(ev);
    } else {
      globalEvents.push(ev);
    }
  });

  assets.forEach((asset) => {
    if (passiveOnly && asset?.includeInPassive === false) return;
    const startTimestamp = getStartDate(asset);
    const startDateObj = new Date(startTimestamp);
    const nowTs = Date.now();
    const initialValue = asset.value || 0;
    const principal = calculateCurrentValue(asset);
    const depositIterator = createDepositIterator(asset, nowTs);
    const assetEvents = (eventsByAsset.get(asset.dateAdded) || []).sort(
      (a, b) => a.date - b.date,
    );
    let eventIndex = 0;
    let active = nowTs >= startTimestamp;
    let valueBase = active ? principal : initialValue;
    let valueLow = valueBase;
    let valueHigh = valueBase;
    const taxDetail = taxDetailMap.get(asset.dateAdded);
    const grossBase = getGrossRate(asset, "base");
    const grossLow = getGrossRate(asset, "low");
    const grossHigh = getGrossRate(asset, "high");
    const netBase = taxDetail?.base?.netRate ?? grossBase;
    const netLow = taxDetail?.low?.netRate ?? grossLow;
    const netHigh = taxDetail?.high?.netRate ?? grossHigh;
    const rateBase = netBase / 100 / 12;
    const rateLow = netLow / 100 / 12;
    const rateHigh = netHigh / 100 / 12;
    const annualBase = netBase;
    const annualLow = netLow;
    const annualHigh = netHigh;
    const arrBase = [];
    const arrLow = [];
    const arrHigh = [];
    for (let i = 0; i <= totalMonths; i++) {
      const currentDate = labels[i];
      if (!active && currentDate >= startDateObj) {
        active = true;
        valueBase = initialValue;
        valueLow = initialValue;
        valueHigh = initialValue;
      }
      if (active && depositIterator) {
        const catchUp = depositIterator.consumeBefore(currentDate.getTime());
        if (catchUp) {
          valueBase += catchUp;
          valueLow += catchUp;
          valueHigh += catchUp;
        }
      }
      while (eventIndex < assetEvents.length) {
        const evt = assetEvents[eventIndex];
        const evtDate = new Date(evt.date);
        if (currentDate < evtDate) break;
        if (evt.date < startTimestamp) {
          eventIndex++;
          continue;
        }
        if (!active) {
          active = true;
          valueBase = initialValue;
          valueLow = initialValue;
          valueHigh = initialValue;
        }
        if (evt.isPercent) {
          const factor = 1 + evt.amount / 100;
          valueBase *= factor;
          valueLow *= factor;
          valueHigh *= factor;
        } else {
          valueBase += evt.amount;
          valueLow += evt.amount;
          valueHigh += evt.amount;
        }
        eventIndex++;
      }
      const baseVal = active ? valueBase : 0;
      const lowVal = active ? valueLow : 0;
      const highVal = active ? valueHigh : 0;
      arrBase[i] = baseVal;
      arrLow[i] = lowVal;
      arrHigh[i] = highVal;
      base[i] += baseVal;
      low[i] += lowVal;
      high[i] += highVal;
      if (includeBreakdown) {
        assetTotalsBase[i] += baseVal;
        assetTotalsLow[i] += lowVal;
        assetTotalsHigh[i] += highVal;
      }
      if (active && i < labels.length - 1) {
        valueBase *= 1 + rateBase;
        valueLow *= 1 + rateLow;
        valueHigh *= 1 + rateHigh;
        if (depositIterator) {
          const monthEnd = labels[i + 1].getTime();
          const addition = depositIterator.consumeBefore(monthEnd);
          if (addition) {
            valueBase += addition;
            valueLow += addition;
            valueHigh += addition;
          }
        }
      }
    }
    nextAssetForecasts.set(asset.dateAdded, {
      base: arrBase,
      low: arrLow,
      high: arrHigh,
    });
    if (includeBreakdown)
      assetDetails.push({
        id: asset.dateAdded,
        name: asset.name,
        base: arrBase,
        low: arrLow,
        high: arrHigh,
        annualRates: {
          base: annualBase,
          low: annualLow,
          high: annualHigh,
        },
        grossRates: {
          base: grossBase,
          low: grossLow,
          high: grossHigh,
        },
        tax: taxDetail,
      });
  });

  globalEvents.forEach((event) => {
    const eventDate = new Date(event.date);
    const idx = labels.findIndex((label) => label >= eventDate);
    if (idx < 0) return;
    if (event.isPercent) {
      const factor = 1 + event.amount / 100;
      for (let i = idx; i <= totalMonths; i++) {
        base[i] *= factor;
        low[i] *= factor;
        high[i] *= factor;
      }
    } else {
      for (let i = idx; i <= totalMonths; i++) {
        base[i] += event.amount;
        low[i] += event.amount;
        high[i] += event.amount;
      }
    }
  });

  const nextLiabilityForecasts = new Map();
  if (!passiveOnly) {
    const paymentRunning = { base: 0, low: 0, high: 0 };
    liabilities.forEach((liability) => {
      const startTimestamp = getStartDate(liability);
      const startDateObj = new Date(startTimestamp);
      const nowTs = Date.now();
      let active = nowTs >= startTimestamp;
      let outstanding = active
        ? calculateCurrentLiability(liability)
        : liability.value || 0;
      const rate = (liability.interest || 0) / 100 / 12;
      const payment = liability.monthlyPayment || 0;
      const arr = [];
      for (let i = 0; i <= totalMonths; i++) {
        const currentDate = labels[i];
        if (!active && currentDate >= startDateObj) {
          active = true;
          outstanding = liability.value || 0;
        }
        const currentOutstanding = active ? outstanding : 0;
        arr[i] = -currentOutstanding;
        base[i] += arr[i];
        low[i] += arr[i];
        high[i] += arr[i];
        if (includeBreakdown) {
          liabilityTotalsBase[i] += arr[i];
          liabilityTotalsLow[i] += arr[i];
          liabilityTotalsHigh[i] += arr[i];
        }
        let paymentApplied = 0;
        if (active && outstanding > 0) {
          outstanding = outstanding * (1 + rate);
          paymentApplied = Math.min(outstanding, payment);
          outstanding = Math.max(0, outstanding - paymentApplied);
        }
        if (includeBreakdown && paymentApplied > 0 && liabilityPaymentTotals) {
          liabilityPaymentTotals[i] += paymentApplied;
        }
        if (paymentApplied > 0) {
          paymentRunning.base += paymentApplied;
          paymentRunning.low += paymentApplied;
          paymentRunning.high += paymentApplied;
        }
      }
      nextLiabilityForecasts.set(liability.dateAdded, arr);
    });
    if (liabilityPaymentTotals) {
      cumulativeLiabilityPayments = Array(liabilityPaymentTotals.length).fill(0);
      for (let i = 0; i < liabilityPaymentTotals.length; i++) {
        const prev = i > 0 ? cumulativeLiabilityPayments[i - 1] : 0;
        cumulativeLiabilityPayments[i] = prev + (liabilityPaymentTotals[i] || 0);
      }
    }
  }

  if (!passiveOnly) {
    incomes.forEach((income) => {
      if (!income) return;
      const startTimestamp = getStartDate(income);
      const startDateObj = new Date(startTimestamp);
      const iterator = createDepositIterator(
        {
          frequency: income.frequency,
          originalDeposit: income.amount,
          dateAdded: income.dateAdded,
          startDate: startTimestamp,
          depositDay: DEFAULT_DEPOSIT_DAY,
        },
        nowTs,
      );
      let running = 0;
      for (let i = 0; i <= totalMonths; i++) {
        const currentDate = labels[i];
        if (iterator) {
          const addition = iterator.consumeBefore(currentDate.getTime());
          if (addition) running += addition;
        }
        const active = currentDate >= startDateObj;
        const contribution = active ? running : 0;
        incomeTotalsBase[i] += contribution;
        incomeTotalsLow[i] += contribution;
        incomeTotalsHigh[i] += contribution;
      }
    });

    for (let i = 0; i < labels.length; i++) {
      const incBase = incomeTotalsBase[i] || 0;
      const incLow = incomeTotalsLow[i] || 0;
      const incHigh = incomeTotalsHigh[i] || 0;
      base[i] += incBase;
      low[i] += incLow;
      high[i] += incHigh;
      const payments =
        cumulativeLiabilityPayments && i < cumulativeLiabilityPayments.length
          ? cumulativeLiabilityPayments[i]
          : 0;
      netCashFlowBase[i] = incBase - payments;
      netCashFlowLow[i] = incLow - payments;
      netCashFlowHigh[i] = incHigh - payments;
    }

    if (includeBreakdown && incomes.length) {
      incomeDetail = {
        id: "__incomes__",
        name: "Income contributions",
        base: [...incomeTotalsBase],
        low: [...incomeTotalsLow],
        high: [...incomeTotalsHigh],
        isIncome: true,
        annualRates: { base: 0, low: 0, high: 0 },
        grossRates: { base: 0, low: 0, high: 0 },
      };
      assetDetails.push(incomeDetail);
    }
  }

  if (includeBreakdown) {
    const diffTolerance = 0.005;
    if (liabilityPaymentTotals && cumulativeLiabilityPayments) {
      liabilityPaymentTotals.splice(
        0,
        liabilityPaymentTotals.length,
        ...cumulativeLiabilityPayments,
      );
    }
    if (incomeDetail) {
      const surplusBase = Array(labels.length).fill(0);
      const surplusLow = Array(labels.length).fill(0);
      const surplusHigh = Array(labels.length).fill(0);
      const incomePortionBase = Array(labels.length).fill(0);
      const incomePortionLow = Array(labels.length).fill(0);
      const incomePortionHigh = Array(labels.length).fill(0);
      for (let i = 0; i < labels.length; i++) {
        const payments = liabilityPaymentTotals ? liabilityPaymentTotals[i] || 0 : 0;
        const incBase = incomeTotalsBase[i] || 0;
        const incLow = incomeTotalsLow[i] || 0;
        const incHigh = incomeTotalsHigh[i] || 0;
        const surplusValBase = Math.max(0, incBase - payments);
        const surplusValLow = Math.max(0, incLow - payments);
        const surplusValHigh = Math.max(0, incHigh - payments);
        surplusBase[i] = surplusValBase;
        surplusLow[i] = surplusValLow;
        surplusHigh[i] = surplusValHigh;
        incomePortionBase[i] = incBase - surplusValBase;
        incomePortionLow[i] = incLow - surplusValLow;
        incomePortionHigh[i] = incHigh - surplusValHigh;
      }
      incomeDetail.base = incomePortionBase;
      incomeDetail.low = incomePortionLow;
      incomeDetail.high = incomePortionHigh;
      const hasSurplus = surplusBase.some((v) => Math.abs(v) > diffTolerance);
      if (hasSurplus) {
        assetDetails.push({
          id: "__cashflow_surplus__",
          name: "Income left after liabilities",
          base: surplusBase,
          low: surplusLow,
          high: surplusHigh,
          isIncomeSurplus: true,
        });
      }
    }
    const diffBase = Array(labels.length).fill(0);
    const diffLow = Array(labels.length).fill(0);
    const diffHigh = Array(labels.length).fill(0);
    let hasDiff = false;
    for (let i = 0; i < labels.length; i++) {
      const baseAssets = assetTotalsBase ? assetTotalsBase[i] || 0 : 0;
      const lowAssets = assetTotalsLow ? assetTotalsLow[i] || 0 : 0;
      const highAssets = assetTotalsHigh ? assetTotalsHigh[i] || 0 : 0;
      const baseLiabs = liabilityTotalsBase ? liabilityTotalsBase[i] || 0 : 0;
      const lowLiabs = liabilityTotalsLow ? liabilityTotalsLow[i] || 0 : 0;
      const highLiabs = liabilityTotalsHigh ? liabilityTotalsHigh[i] || 0 : 0;
      const baseIncome = incomeTotalsBase[i] || 0;
      const lowIncome = incomeTotalsLow[i] || 0;
      const highIncome = incomeTotalsHigh[i] || 0;
      const baseDiff = (base[i] || 0) - baseAssets - baseLiabs - baseIncome;
      const lowDiff = (low[i] || 0) - lowAssets - lowLiabs - lowIncome;
      const highDiff = (high[i] || 0) - highAssets - highLiabs - highIncome;
      diffBase[i] = baseDiff;
      diffLow[i] = lowDiff;
      diffHigh[i] = highDiff;
      if (
        Math.abs(baseDiff) > diffTolerance ||
        Math.abs(lowDiff) > diffTolerance ||
        Math.abs(highDiff) > diffTolerance
      ) {
        hasDiff = true;
      }
    }
    if (hasDiff) {
      assetDetails.push({
        id: "__global_events__",
        name: "One-off events (net)",
        base: diffBase,
        low: diffLow,
        high: diffHigh,
        isGlobalEvent: true,
      });
    }
  }

  if (!passiveOnly) {
    assetForecasts = nextAssetForecasts;
    liabilityForecasts = nextLiabilityForecasts;
    netCashFlowForecasts = {
      base: netCashFlowBase,
      low: netCashFlowLow,
      high: netCashFlowHigh,
    };
  }

  const scenarios = {
    labels,
    base,
    low,
    high,
    minSeriesValue: Math.min(...base, ...low, ...high),
    currentBaseline: passiveOnly ? calculatePassiveWorth() : calculateNetWorth(),
  };
  if (includeBreakdown) scenarios.assetDetails = assetDetails;
  if (!passiveOnly) lastForecastScenarios = scenarios;
  return scenarios;
}

function getSnapshotForecastSeries() {
  const scenarios = lastForecastScenarios || buildForecastScenarios();
  if (!scenarios) return [];
  return scenarios.labels.map((label, index) => ({
    date: label.toISOString(),
    value: scenarios.base[index],
  }));
}

function getGoalTargetYear() {
  return goalTargetDate ? new Date(goalTargetDate).getFullYear() : null;
}
function getGoalHorizonYears() {
  if (!goalTargetDate) return 30;
  const now = new Date();
  const target = new Date(goalTargetDate);
  const diff = (target - now) / (1000 * 60 * 60 * 24 * 365.25);
  return diff > 1 ? Math.ceil(diff) : 1;
}

// Modal helpers (single shell)
const modalEl = $("modal"),
  modalBody = $("modal-body");
const closeModal = () => modalEl.classList.add("modal-hidden");
const openModalNode = (node) => {
  modalBody.replaceChildren(node);
  modalEl.classList.remove("modal-hidden");
};

function showAlert(message, onClose = null) {
  const tpl = document.importNode($("tpl-alert").content, true);
  const messageContainer = tpl.querySelector("[data-text]");
  const isNode =
    message !== null && typeof message === "object" && message.nodeType;
  if (isNode) {
    messageContainer.innerHTML = "";
    messageContainer.appendChild(message);
    messageContainer.classList.add("text-left", "space-y-4");
  } else {
    messageContainer.textContent =
      typeof message === "string" || typeof message === "number"
        ? String(message)
        : "";
    messageContainer.classList.remove("text-left", "space-y-4");
  }
  tpl.querySelector("[data-ok]").onclick = () => {
    closeModal();
    if (onClose) onClose();
  };
  openModalNode(tpl);
}

function showConfirm(message, onConfirm) {
  const tpl = document.importNode($("tpl-confirm").content, true);
  tpl.querySelector("[data-text]").textContent = message;
  tpl.querySelector("[data-confirm]").onclick = () => {
    onConfirm();
    closeModal();
  };
  tpl.querySelector("[data-cancel]").onclick = closeModal;
  openModalNode(tpl);
}

function showPrompt(message, defaultValue, onConfirm) {
  const tpl = document.importNode($("tpl-prompt").content, true);
  tpl.querySelector("[data-text]").textContent = message;
  const input = tpl.querySelector("[data-input]");
  input.value = defaultValue || "";
  tpl.querySelector("[data-ok]").onclick = () => {
    onConfirm(input.value.trim());
    closeModal();
  };
  tpl.querySelector("[data-cancel]").onclick = closeModal;
  openModalNode(tpl);
  input.focus();
}

function showSnapshotDetails(snapshot) {
  const tpl = document.importNode(
    $("tpl-snapshot-details").content,
    true,
  );
  tpl.querySelector("[data-date]").textContent =
    `Snapshot taken on: ${new Date(snapshot.date).toLocaleString()}`;
  const list = tpl.querySelector("[data-list]");
  list.innerHTML = `<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
  <thead class="bg-gray-200 dark:bg-gray-700">
    <tr><th class="table-header">Asset Name</th><th class="table-header">Value</th></tr>
  </thead>
  <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
    ${[...snapshot.assets]
      .sort((a, b) => (a?.name || "").localeCompare(b?.name || ""))
      .map(
        (a) => `<tr class="text-sm text-gray-700 dark:text-gray-300">
      <td class="px-6 py-4 whitespace-nowrap">${a.name}</td>
      <td class="px-6 py-4 whitespace-nowrap">${fmtCurrency(a.value)}</td>
    </tr>`,
      )
      .join("")}
  </tbody>
</table>`;
  tpl.querySelector("[data-close]").onclick = closeModal;
  openModalNode(tpl);
}

function showEditAsset(index) {
  const asset = assets[index];
  if (!asset) return;
  const tpl = document.importNode($("tpl-edit-asset").content, true);
  tpl.querySelector("#editAssetIndex").value = index;
  tpl.querySelector("#editAssetName").value = asset.name;
  tpl.querySelector("#editAssetValue").value = asset.value;
  tpl.querySelector("#editDepositAmount").value = asset.originalDeposit;
  tpl.querySelector("#editDepositFrequency").value = asset.frequency;
  const editDepositFrequency = tpl.querySelector("#editDepositFrequency");
  const editAssetStart = tpl.querySelector("#editAssetStartDate");
  if (editAssetStart)
    editAssetStart.value = toDateInputValue(asset.explicitStartDate);
  tpl.querySelector("#editAssetReturn").value = asset.return;
  tpl.querySelector("#editLowGrowth").value = asset.lowGrowth;
  tpl.querySelector("#editHighGrowth").value = asset.highGrowth;
  const editTaxSelect = tpl.querySelector("#editAssetTaxTreatment");
  if (editTaxSelect)
    editTaxSelect.value = normalizeTaxTreatment(asset.taxTreatment);
  const inc = asset.includeInPassive !== false;
  const incEl = tpl.querySelector("#editIncludePassive");
  if (incEl) incEl.checked = inc;

  tpl.querySelector("[data-close]").onclick = closeModal;
  tpl.querySelector("#editAssetFormModal").onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    const i = +f.querySelector("#editAssetIndex").value;
    const a = assets[i];
    if (!a) return;
    a.name = f.querySelector("#editAssetName").value;
    a.value = parseFloat(f.querySelector("#editAssetValue").value);
    a.originalDeposit =
      parseFloat(f.querySelector("#editDepositAmount").value) || 0;
    a.frequency = f.querySelector("#editDepositFrequency").value;
    const explicitInput = f.querySelector("#editAssetStartDate")?.value;
    a.explicitStartDate = toTimestamp(explicitInput);
    a.startDate = a.explicitStartDate ?? getStartDate(a);
    const ret =
      parseFloat(f.querySelector("#editAssetReturn").value) || 0;
    a.return = ret;
    a.lowGrowth =
      parseFloat(f.querySelector("#editLowGrowth").value) || ret;
    a.highGrowth =
      parseFloat(f.querySelector("#editHighGrowth").value) || ret;
    a.monthlyDeposit = monthlyFrom(a.frequency, a.originalDeposit);
    const incCbx = f.querySelector("#editIncludePassive");
    a.includeInPassive = incCbx ? !!incCbx.checked : true;
    const taxSelect = f.querySelector("#editAssetTaxTreatment");
    if (taxSelect) a.taxTreatment = normalizeTaxTreatment(taxSelect.value);
    invalidateTaxCache();
    closeModal();
    renderAssets();
    renderEvents();
  };
  openModalNode(tpl);
}

function showEditIncome(index) {
  const income = incomes[index];
  if (!income) return;
  const tpl = document.importNode($("tpl-edit-income").content, true);
  tpl.querySelector("#editIncomeIndex").value = index;
  tpl.querySelector("#editIncomeName").value = income.name;
  tpl.querySelector("#editIncomeAmount").value = income.amount;
  const freqSel = tpl.querySelector("#editIncomeFrequency");
  if (freqSel) freqSel.value = income.frequency || "monthly";
  const editIncomeStart = tpl.querySelector("#editIncomeStartDate");
  if (editIncomeStart)
    editIncomeStart.value = toDateInputValue(income.explicitStartDate);
  tpl.querySelector("[data-close]").onclick = closeModal;
  tpl.querySelector("#editIncomeFormModal").onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    const i = +f.querySelector("#editIncomeIndex").value;
    const inc = incomes[i];
    if (!inc) return;
    inc.name = f.querySelector("#editIncomeName").value;
    inc.amount = parseFloat(f.querySelector("#editIncomeAmount").value) || 0;
    inc.frequency = f.querySelector("#editIncomeFrequency").value;
    const explicitInput = f.querySelector("#editIncomeStartDate")?.value;
    inc.explicitStartDate = toTimestamp(explicitInput);
    inc.startDate = inc.explicitStartDate ?? getStartDate(inc);
    inc.monthlyAmount = monthlyFrom(inc.frequency, inc.amount);
    closeModal();
    renderIncomes();
    updateWealthChart();
    updateEmptyStates();
  };
  openModalNode(tpl);
}

function showEditLiability(index) {
  const liab = liabilities[index];
  if (!liab) return;
  const tpl = document.importNode($("tpl-edit-liability").content, true);
  tpl.querySelector("#editLiabilityIndex").value = index;
  tpl.querySelector("#editLiabilityName").value = liab.name;
  tpl.querySelector("#editLiabilityValue").value = liab.value;
  tpl.querySelector("#editLiabilityInterest").value = liab.interest || 0;
  tpl.querySelector("#editLiabilityPaymentAmount").value =
    liab.originalPayment;
  tpl.querySelector("#editLiabilityPaymentFrequency").value =
    liab.frequency;
  const editLiabilityStart = tpl.querySelector("#editLiabilityStartDate");
  if (editLiabilityStart)
    editLiabilityStart.value = toDateInputValue(liab.explicitStartDate);
  tpl.querySelector("[data-close]").onclick = closeModal;
  tpl.querySelector("#editLiabilityFormModal").onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    const i = +f.querySelector("#editLiabilityIndex").value;
    const l = liabilities[i];
    if (!l) return;
    l.name = f.querySelector("#editLiabilityName").value;
    l.value =
      parseFloat(f.querySelector("#editLiabilityValue").value) || 0;
    l.interest =
      parseFloat(f.querySelector("#editLiabilityInterest").value) || 0;
    l.originalPayment =
      parseFloat(f.querySelector("#editLiabilityPaymentAmount").value) ||
      0;
    l.frequency = f.querySelector("#editLiabilityPaymentFrequency").value;
    l.monthlyPayment = monthlyFrom(l.frequency, l.originalPayment);
    const explicitInput = f.querySelector("#editLiabilityStartDate")?.value;
    l.explicitStartDate = toTimestamp(explicitInput);
    l.startDate = l.explicitStartDate ?? getStartDate(l);
    closeModal();
    renderLiabilities();
  };
  openModalNode(tpl);
}

function showEditEvent(index) {
  const ev = simEvents[index];
  if (!ev) return;
  const tpl = document.importNode($("tpl-edit-event").content, true);
  tpl.querySelector("#editEventIndex").value = index;
  tpl.querySelector("#editEventName").value = ev.name;
  tpl.querySelector("#editEventDirection").value = ev.amount < 0 ? "loss" : "gain";
  tpl.querySelector("#editEventAmount").value = Math.abs(ev.amount);
  tpl.querySelector("#editEventType").value = ev.isPercent
    ? "percent"
    : "absolute";
  tpl.querySelector("#editEventDate").value = new Date(ev.date)
    .toISOString()
    .split("T")[0];
  const sel = tpl.querySelector("#editEventAsset");
  renderEventAssetOptions(sel);
  sel.value = ev.assetId || "";
  tpl.querySelector("[data-close]").onclick = closeModal;
  tpl.querySelector("#editEventForm").onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    const i = +f.querySelector("#editEventIndex").value;
    const evt = simEvents[i];
    if (!evt) return;
    evt.name = f.querySelector("#editEventName").value;
    const dir = f.querySelector("#editEventDirection").value === "loss"
      ? "loss"
      : "gain";
    const editAmountRaw = parseFloat(
      f.querySelector("#editEventAmount").value,
    );
    const editAmount = Number.isFinite(editAmountRaw)
      ? Math.abs(editAmountRaw)
      : NaN;
    evt.amount = dir === "loss" ? -editAmount : editAmount;
    evt.isPercent = f.querySelector("#editEventType").value === "percent";
    evt.date = new Date(
      f.querySelector("#editEventDate").value,
    ).getTime();
    const assetVal = f.querySelector("#editEventAsset").value;
    if (assetVal) {
      evt.assetId = Number(assetVal);
    } else {
      delete evt.assetId;
    }
    if (!evt.name || !Number.isFinite(evt.amount) || !evt.date) {
      return;
    }
    simEvents.sort((a, b) => a.date - b.date);
    closeModal();
    renderEvents();
    updateEmptyStates();
  };
  openModalNode(tpl);
}

// Table header generator + sorting (condensed columns)
const ASSET_COLS = [
  "Asset Name",
  "Start Date",
  "Value",
  "Deposit",
  "Growth Rates",
  "Tax Treatment",
];
const ASSET_KEYS = ["name", "start", "value", "deposit", "return", "tax"];
let assetSort = { key: "name", dir: "asc" };

function buildAssetHeader() {
  const headHtml = ASSET_COLS.map((h, idx) => {
    const key = ASSET_KEYS[idx];
    const isActive = assetSort.key === key;
    const arrow = isActive ? (assetSort.dir === "asc" ? "▲" : "▼") : "";
    const inner = `<div class="flex items-center gap-1 whitespace-nowrap"><span>${h}</span><span class="sort-arrow">${arrow}</span></div>`;
    return `<th scope="col" class="table-header cursor-pointer select-none align-middle" data-sort="${key}">${inner}</th>`;
  }).join("");
  $("assetTableHeader").innerHTML =
    `<tr>${headHtml}<th class="relative px-6 py-3"><span class="sr-only">Actions</span></th></tr>`;
}

function sortAssetsForView(list) {
  const dir = assetSort.dir === "desc" ? -1 : 1;
  const cmp = (a, b) => {
    switch (assetSort.key) {
      case "name":
        return (
          (a.name || "").localeCompare(b.name || "", undefined, {
            sensitivity: "base",
          }) * dir
        );
      case "start": {
        const aStart = getStartDate(a);
        const bStart = getStartDate(b);
        return (aStart - bStart) * dir;
      }
      case "value":
        return ((a.value || 0) - (b.value || 0)) * dir;
      case "deposit":
        return (
          ((a.originalDeposit || 0) - (b.originalDeposit || 0)) * dir
        );
      case "return": {
        const al = a.lowGrowth ?? a.return ?? 0;
        const bl = b.lowGrowth ?? b.return ?? 0;
        if (al !== bl) return (al - bl) * dir; // primary: low growth

        const ae = a.return ?? 0;
        const be = b.return ?? 0;
        if (ae !== be) return (ae - be) * dir; // secondary: expected

        const ah = a.highGrowth ?? a.return ?? 0;
        const bh = b.highGrowth ?? b.return ?? 0;
        return (ah - bh) * dir; // tertiary: high growth
      }
      case "tax": {
        const at = normalizeTaxTreatment(a.taxTreatment);
        const bt = normalizeTaxTreatment(b.taxTreatment);
        if (at !== bt)
          return at.localeCompare(bt, undefined, { sensitivity: "base" }) * dir;
        const ar = getGrossRate(a, "base");
        const br = getGrossRate(b, "base");
        return (ar - br) * dir;
      }
      case "current":
        return (
          (calculateCurrentValue(a) - calculateCurrentValue(b)) * dir
        ); // fallback
      default:
        return 0;
    }
  };
  return list.sort(cmp);
}

const STRESS_COLS = ["Asset", "Date", "Change"];
const STRESS_KEYS = ["name", "date", "amount"];
let stressSort = { key: "date", dir: "asc" };
let stressSampleEvents = [];

function buildStressHeader() {
  if (!$("stressEventsTableHeader")) return;
  const headHtml = STRESS_COLS.map((h, idx) => {
    const key = STRESS_KEYS[idx];
    const isActive = stressSort.key === key;
    const arrow = isActive ? (stressSort.dir === "asc" ? "▲" : "▼") : "";
    const inner = `<div class="flex items-center gap-1 whitespace-nowrap"><span>${h}</span><span class="sort-arrow">${arrow}</span></div>`;
    return `<th class="table-header cursor-pointer select-none" data-sort="${key}">${inner}</th>`;
  }).join("");
  $("stressEventsTableHeader").innerHTML = `<tr>${headHtml}</tr>`;
}

function sortStressEventsForView(list) {
  const dir = stressSort.dir === "desc" ? -1 : 1;
  const cmp = (a, b) => {
    switch (stressSort.key) {
      case "name":
        return (
          (a.name || "").localeCompare(b.name || "", undefined, {
            sensitivity: "base",
          }) * dir
        );
      case "date":
        return ((a.date || 0) - (b.date || 0)) * dir;
      case "amount":
        return ((a.amount || 0) - (b.amount || 0)) * dir;
      default:
        return 0;
    }
  };
  return list.sort(cmp);
}

function renderStressEvents() {
  const body = $("stressEventsTableBody");
  if (!body) return;
  const sorted = sortStressEventsForView([...stressSampleEvents]);
  const rows =
    sorted
      .map(
        (ev) => `
      <tr>
        <td class="px-6 py-4 whitespace-nowrap">${ev.name}</td>
        <td class="px-6 py-4 whitespace-nowrap">${fmtDate(new Date(ev.date))}</td>
        <td class="px-6 py-4 whitespace-nowrap">${ev.amount.toFixed(1)}%</td>
      </tr>`,
      )
      .join("") ||
    `<tr><td colspan="3" class="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">No random events</td></tr>`;
  body.innerHTML = rows;
}

// Charts: helpers
const CHART_COLOURS = {
  blue: "rgba(59,130,246,1)",
  blueFill: "rgba(59,130,246,.2)",
  red: "rgba(239,68,68,.5)",
  green: "rgba(16,185,129,.5)",
};

// Opaque point colours for strong visibility (match line hues)
const POINT_COLOURS = {
  blue: "rgba(59,130,246,1)",
  red: "rgba(239,68,68,1)",
  green: "rgba(16,185,129,1)",
};

// Plugin to add extra spacing beneath the legend (push chart down)
const LegendPad = {
  id: "legendPad",
  beforeInit(chart, _args, opts) {
    const lg = chart?.legend;
    if (!lg || !lg.fit) return;
    const extra =
      opts && typeof opts.extra === "number" ? opts.extra : 24;
    const originalFit = lg.fit;
    lg.fit = function fit() {
      originalFit.bind(lg)();
      this.height += extra;
    };
  },
};

const baseLineOpts = {
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { bottom: 24 } },
  scales: {
    y: { ticks: { callback: (v) => fmtCurrency(v) } },
    x: {
      type: "time",
      time: { unit: "year", tooltipFormat: "MMM yyyy" },
    },
  },
  elements: { point: { radius: 1, hoverRadius: 5, hitRadius: 6 } },
  plugins: {
    legend: {
      padding: 40,
      labels: { padding: 20 },
      onHover: (e) => {
        try {
          if (e?.native?.target) e.native.target.style.cursor = "pointer";
        } catch (_) {}
      },
      onLeave: (e) => {
        try {
          if (e?.native?.target) e.native.target.style.cursor = "default";
        } catch (_) {}
      },
    },
    legendPad: { extra: 28 },
    zoom: {
      pan: { enabled: true, mode: "x" },
      zoom: {
        wheel: { enabled: true },
        pinch: { enabled: true },
        mode: "x",
      },
    },
    tooltip: {
      callbacks: {
        label: (c) => `${c.dataset.label}: ${fmtCurrency(c.raw.y)}`,
      },
    },
  },
};

const getActiveTooltipElements = (chart) => {
  if (!chart?.tooltip) return [];
  if (typeof chart.tooltip.getActiveElements === "function") {
    return chart.tooltip.getActiveElements();
  }
  return chart.tooltip._active || [];
};

const clearChartTooltip = (chart) => {
  if (!chart?.tooltip) return;
  try {
    if (typeof chart.tooltip.setActiveElements === "function") {
      chart.tooltip.setActiveElements([], { x: 0, y: 0 });
    } else {
      chart.tooltip._active = [];
    }
    chart.update();
  } catch (_) {}
};

const attachMobileTooltipDismiss = (chart, canvas) => {
  if (!chart || !canvas) return;

  if (canvas._wtTooltipDismiss) {
    canvas.removeEventListener("pointerdown", canvas._wtTooltipDismiss);
  }
  if (canvas._wtTooltipLeave) {
    canvas.removeEventListener("pointerleave", canvas._wtTooltipLeave);
  }

  const handler = (event) => {
    const active = getActiveTooltipElements(chart);
    if (!active.length) return;
    const elements = chart.getElementsAtEventForMode(
      event,
      "nearest",
      { intersect: true },
      true,
    );
    const samePoint =
      active.length === 1 &&
      elements.length === 1 &&
      active[0].datasetIndex === elements[0].datasetIndex &&
      active[0].index === elements[0].index;
    if (samePoint || elements.length === 0) {
      clearChartTooltip(chart);
    }
  };

  const leaveHandler = () => {
    if (!getActiveTooltipElements(chart).length) return;
    clearChartTooltip(chart);
  };

  canvas.addEventListener("pointerdown", handler, { passive: true });
  canvas.addEventListener("pointerleave", leaveHandler);
  canvas._wtTooltipDismiss = handler;
  canvas._wtTooltipLeave = leaveHandler;
};

const updateChartContainers = () => {
  const containers = document.querySelectorAll(".chart-container");
  if (!containers.length) return;
  const targetHeight = Math.min(420, Math.max(260, window.innerHeight * 0.55));
  const padding = window.innerWidth < 640 ? "8px 0" : "12px 0";
  containers.forEach((container) => {
    container.style.height = `${targetHeight}px`;
    container.style.padding = padding;
    const canvas = container.querySelector("canvas");
    if (canvas) {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    }
  });
};

const ensureChart = (ref, ctx, cfg) => {
  if (ref?.ctx?.canvas === ctx.canvas) {
    ref.config.data = cfg.data;
    ref.config.options = cfg.options;
    ref.update();
    return ref;
  }
  ref?.destroy();
  return new Chart(ctx, cfg);
};
const pieTooltip = (context) => {
  const total = context.chart.data.datasets[0].data.reduce(
    (a, b) => a + b,
    0,
  );
  const pct = ((context.raw / total) * 100).toFixed(2);
  return `${context.label}: ${fmtCurrency(context.raw)} (${pct}%)`;
};

function adaptChartToZoom(chart) {
  // Derive range from current x-scale; prefer options min/max which the
  // zoom plugin updates, then fall back to computed scale bounds.
  const sx = chart.scales.x;
  let min = chart.options?.scales?.x?.min ?? sx.min;
  let max = chart.options?.scales?.x?.max ?? sx.max;
  const range = max - min;
  const twoYears = 2 * 365.25 * 24 * 60 * 60 * 1000,
    fiveYears = 5 * 365.25 * 24 * 60 * 60 * 1000,
    tenYears = 10 * 365.25 * 24 * 60 * 60 * 1000;
  chart.options.scales.x.time.unit =
    range <= twoYears ? "month" : range <= fiveYears ? "quarter" : "year";
  // Clearer sizing: decide by widest range first
  let radius, hover, hit;
  if (range > tenYears) {
    // very zoomed out (>10y)
    radius = 1;
    hover = 3;
    hit = 5;
  } else if (range > fiveYears) {
    // 5–10y
    radius = 2;
    hover = 3;
    hit = 5;
  } else if (range > twoYears) {
    // 2–5y
    radius = 3;
    hover = 5;
    hit = 7;
  } else {
    // <2y (close zoom)
    radius = 4;
    hover = 8;
    hit = 16;
  }

  chart.data.datasets.forEach((d, di) => {
    const isGoal = d.label && d.label.includes("Goal");
    const isBaseline = d.label && d.label.includes("Baseline");
    if (isGoal || isBaseline) return; // keep those as lines only
    d.pointRadius = radius;
    d.pointHoverRadius = hover;
    d.pointHitRadius = hit;
    // Also push sizes down to rendered elements to avoid stale cached options
    const meta = chart.getDatasetMeta(di);
    if (meta && Array.isArray(meta.data)) {
      meta.data.forEach((pt) => {
        if (!pt || !pt.options) return;
        pt.options.radius = radius;
        pt.options.hoverRadius = hover;
        pt.options.hitRadius = hit;
      });
    }
  });
  // Schedule a microtask update so we run outside the current plugin tick
  // and ensure the new point sizes render immediately without animation.
  (typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (fn) => setTimeout(fn, 0))(() => {
    try {
      chart.update("none");
    } catch (e) {}
  });
}

function updateChartTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  const grid = isDark ? "#374151" : "#e5e7eb";
  const tick = isDark ? "#ffffff" : "#374151";
  const isMobile = window.innerWidth < 768;
  // Set global default text colour for tooltips/labels
  if (typeof Chart !== "undefined") {
    Chart.defaults.color = tick;
  }
  [wealthChart, snapshotChart, assetBreakdownChart, futurePortfolioChart].forEach((c) => {
    if (!c) return;
    const { scales, plugins } = c.options;
    if (scales?.x) {
      scales.x.grid.color = grid;
      scales.x.ticks.color = tick;
    }
    if (scales?.y) {
      scales.y.grid.color = grid;
      scales.y.ticks.color = tick;
    }
    if (plugins?.legend) {
      plugins.legend.padding = isMobile
        ? 8
        : (plugins.legend.padding ?? 40);
      if (plugins.legend.labels) {
        plugins.legend.labels.color = tick;
        plugins.legend.labels.padding = isMobile
          ? 6
          : (plugins.legend.labels.padding ?? 30);
      }
    }
    if (c.options?.layout?.padding) {
      c.options.layout.padding.top = isMobile
        ? 16
        : (c.options.layout.padding.top ?? 56);
    }
    // Ensure point outlines match series colour in both themes
    if (c.data?.datasets) {
      c.data.datasets.forEach((d) => {
        if (!d?.label) return;
        if (d.label.includes("Goal") || d.label.includes("Baseline"))
          return;
        if (d.borderColor) d.pointBorderColor = d.borderColor;
        d.pointBorderWidth = 2;
      });
    }
    c.update();
  });
}

function applyThemeChoice(val, { persistChoice = true } = {}) {
  currentThemeChoice = sanitizeThemeChoice(val);
  const root = document.documentElement;
  ["theme-inverted", "theme-glass"].forEach((cls) =>
    root.classList.remove(cls),
  );
  if (currentThemeChoice === "inverted") root.classList.add("theme-inverted");
  if (currentThemeChoice === "glass") root.classList.add("theme-glass");
  const select = document.getElementById("themeSelect");
  if (select && select.value !== currentThemeChoice)
    select.value = currentThemeChoice;
  if (activeProfile) activeProfile.themeChoice = currentThemeChoice;
  if (persistChoice) {
    try {
      localStorage.setItem(LS.themeChoice, currentThemeChoice);
    } catch (_) {}
    if (activeProfile) persist();
  }
  // Refresh charts for any spacing/colour changes
  try {
    updateChartTheme();
  } catch (_) {}
}

function applyDarkMode(
  enabled,
  { persistChoice = true, withTransition = false } = {},
) {
  isDarkMode = !!enabled;
  const root = document.documentElement;
  if (withTransition) root.classList.add("theme-transition");
  root.classList.toggle("dark", isDarkMode);
  if (withTransition) {
    setTimeout(() => root.classList.remove("theme-transition"), 500);
  } else {
    root.classList.remove("theme-transition");
  }
  if (typeof Chart !== "undefined") {
    Chart.defaults.color = isDarkMode ? "#ffffff" : "#374151";
  }
  try {
    updateChartTheme();
  } catch (_) {}
  const toggle = document.getElementById("themeToggle");
  if (toggle && toggle.checked !== isDarkMode) toggle.checked = isDarkMode;
  if (activeProfile) activeProfile.darkMode = isDarkMode;
  if (persistChoice) {
    try {
      localStorage.setItem(LS.theme, isDarkMode ? "1" : "0");
    } catch (_) {}
    if (activeProfile) persist();
  }
}

function applyProfilePreferences(profile) {
  updateCurrencySymbols();

  const storedThemeChoice = localStorage.getItem(LS.themeChoice) || "default";
  const themePref =
    profile?.themeChoice != null && profile.themeChoice !== ""
      ? profile.themeChoice
      : storedThemeChoice;
  applyThemeChoice(themePref, { persistChoice: false });
  if (profile) profile.themeChoice = currentThemeChoice;

  const storedDarkRaw = localStorage.getItem(LS.theme);
  const darkPref =
    profile?.darkMode == null
      ? storedDarkRaw === "1"
      : !!profile.darkMode;
  applyDarkMode(darkPref, { persistChoice: false, withTransition: false });
  if (profile) profile.darkMode = isDarkMode;

  const storedNavPref = readStoredMobileNavSticky();
  const navPref = profile
    ? sanitizeMobileNavSticky(profile.mobileNavSticky, storedNavPref)
    : storedNavPref;
  applyMobileNavSticky(navPref, { persistChoice: false });
  if (profile) profile.mobileNavSticky = isMobileNavSticky;
}

// Passive income summary (based on expected returns)
function updatePassiveIncome() {
  const card = $("passiveIncomeCard");
  if (!card) return;
  const hasAssets = assets.length > 0;
  card.hidden = !hasAssets;
  if (!hasAssets) {
    const message = $("passiveAssetSelectionMessage");
    if (message) message.classList.add("hidden");
    updateFireForecastCard();
    return;
  }

  const targetTs = getPassiveIncomeTargetDate();
  passiveIncomeAsOf = targetTs;
  const dateInput = $("passiveIncomeDate");
  if (dateInput) {
    const inputVal = toDateInputValue(targetTs);
    if (dateInput.value !== inputVal) dateInput.value = inputVal;
  }

  const eligibleAssets = getPassiveEligibleAssets();
  const eligibleIds = new Set(eligibleAssets.map((asset) => asset.dateAdded));
  let selectedIds;
  if (passiveAssetSelection === null) {
    selectedIds = eligibleIds;
  } else {
    selectedIds = new Set();
    passiveAssetSelection.forEach((id) => {
      if (eligibleIds.has(id)) selectedIds.add(id);
    });
  }
  const consideredAssets =
    passiveAssetSelection === null
      ? eligibleAssets
      : eligibleAssets.filter((asset) => selectedIds.has(asset.dateAdded));
  const selectedCount = selectedIds.size;
  updatePassiveAssetSummary();
  updatePassiveAssetSelectionMessage(eligibleAssets.length, selectedCount);

  const set = (id, val) => {
    const el = $(id);
    if (el) el.textContent = fmtCurrency(val);
  };

  if (selectedCount === 0) {
    set("passiveDaily", 0);
    set("passiveWeekly", 0);
    set("passiveMonthly", 0);
    updateFireForecastCard();
    return;
  }

  const eventsByAsset = new Map();
  const activeEvents = scenarioEventsEnabled ? simEvents : [];
  activeEvents.forEach((ev) => {
    if (!ev || ev.assetId == null) return;
    if (!selectedIds.has(ev.assetId)) return;
    if (!eventsByAsset.has(ev.assetId)) eventsByAsset.set(ev.assetId, []);
    eventsByAsset.get(ev.assetId).push(ev);
  });
  eventsByAsset.forEach((list) => list.sort((a, b) => a.date - b.date));

  const nowTs = Date.now();
  let annualIncome = 0;
  const taxDetails = computeAssetTaxDetails();
  consideredAssets.forEach((asset) => {
    const valueAtDate = calculatePassiveAssetValueAt(
      asset,
      targetTs,
      eventsByAsset,
      nowTs,
    );
    const netRate =
      ((taxDetails.detailMap.get(asset.dateAdded)?.base?.netRate ??
        parseFloat(asset?.return)) ||
        0) /
      100;
    annualIncome += valueAtDate * netRate;
  });

  const daily = annualIncome / 365.25;
  const weekly = annualIncome / 52;
  const monthly = annualIncome / 12;

  set("passiveDaily", daily || 0);
  set("passiveWeekly", weekly || 0);
  set("passiveMonthly", monthly || 0);
  updateFireForecastCard();
}

function updateFireFormInputs() {
  const amountInput = $("fireLivingExpenses");
  const freqSelect = $("fireExpensesFrequency");
  const rateInput = $("fireWithdrawalRate");
  const frequency =
    fireExpensesFrequency === "monthly" ? "monthly" : "annual";
  if (freqSelect) freqSelect.value = frequency;
  if (rateInput) {
    const rateVal = fireWithdrawalRate > 0 ? fireWithdrawalRate : 4;
    rateInput.value = Number((rateVal).toFixed(2)).toString();
    rateInput.disabled = false;
  }
  if (amountInput) {
    if (fireExpenses > 0) {
      const display =
        frequency === "monthly" ? fireExpenses / 12 : fireExpenses;
      amountInput.value = Number(display.toFixed(2)).toString();
    } else {
      amountInput.value = "";
    }
  }
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function updateFireForecastInputs() {
  const amountInput = $("fireForecastLivingCosts");
  const freqSelect = $("fireForecastFrequency");
  const inflationInput = $("fireForecastInflation");
  const retireInput = $("fireForecastRetireDate");
  const frequency =
    fireForecastFrequency === "monthly" ? "monthly" : "annual";
  if (freqSelect) freqSelect.value = frequency;
  if (amountInput) {
    if (fireForecastCosts > 0) {
      const display =
        frequency === "monthly"
          ? fireForecastCosts / 12
          : fireForecastCosts;
      amountInput.value = Number(display.toFixed(2)).toString();
    } else {
      amountInput.value = "";
    }
  }
  if (inflationInput) {
    const inflSource =
      fireForecastInflation != null ? fireForecastInflation : 0;
    const infl = Number(inflSource.toFixed(2));
    inflationInput.value = infl.toString();
  }
  if (retireInput) {
    if (fireForecastRetireDate && isFinite(fireForecastRetireDate)) {
      const d = new Date(fireForecastRetireDate);
      if (!Number.isNaN(d.getTime())) {
        retireInput.value = formatDateForInput(d);
      } else {
        retireInput.value = "";
      }
    } else {
      retireInput.value = "";
    }
  }
}

function updateFireForecastCard() {
  const card = $("fireForecastCard");
  if (!card) return;
  updateFireForecastInputs();
  const summaryEl = $("fireForecastSummary");
  const resultsEl = $("fireForecastResults");
  if (resultsEl) resultsEl.innerHTML = "";
  if (summaryEl) summaryEl.textContent = "";

  const passiveAssets = assets.filter(
    (a) => a && a.includeInPassive !== false,
  );
  if (passiveAssets.length === 0) {
    if (summaryEl)
      summaryEl.innerHTML =
        '<p class="text-sm text-gray-600 dark:text-gray-300">Mark at least one asset as providing passive income to project FIRE readiness.</p>';
    return;
  }
  if (!(fireForecastCosts > 0)) {
    if (summaryEl)
      summaryEl.innerHTML =
        '<p class="text-sm text-gray-600 dark:text-gray-300">Enter your living costs above and update the forecast to see when passive income could cover them.</p>';
    return;
  }

  const scenarios = buildForecastScenarios(null, {
    passiveOnly: true,
    includeBreakdown: true,
  });
  const labels = (scenarios && scenarios.labels) || [];
  const assetDetails = (scenarios && scenarios.assetDetails) || [];
  if (!labels.length || !assetDetails.length) {
    if (summaryEl)
      summaryEl.innerHTML =
        '<p class="text-sm text-gray-600 dark:text-gray-300">Add growth inputs for your passive income assets to model FIRE readiness.</p>';
    return;
  }

  const annualCost = fireForecastCosts;
  const inflationPct = Number(fireForecastInflation) || 0;
  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
  const now = new Date();
  const retireDate =
    fireForecastRetireDate && isFinite(fireForecastRetireDate)
      ? new Date(fireForecastRetireDate)
      : null;
  if (retireDate) retireDate.setHours(0, 0, 0, 0);
  let startIndex = 0;
  if (retireDate) {
    startIndex = labels.findIndex((d) => d >= retireDate);
  }
  if (startIndex < 0) startIndex = labels.length;
  if (startIndex >= labels.length) {
    if (summaryEl)
      summaryEl.innerHTML =
        '<p class="text-sm text-gray-600 dark:text-gray-300">Your retirement start date is beyond the current forecast horizon. Extend your goal target year to project further.</p>';
    return;
  }

  const formatMonthYear = (date) =>
    date
      ? date.toLocaleString("default", { month: "short", year: "numeric" })
      : "";
  const costDescriptor =
    fireForecastFrequency === "monthly"
      ? `${fmtCurrency(annualCost / 12)} per month (${fmtCurrency(annualCost)} per year)`
      : `${fmtCurrency(annualCost)} per year`;
  const inflLabel = inflationPct.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const inflationText =
    inflationPct > 0
      ? `Inflation is applied at ${inflLabel}% per year (compounded monthly).`
      : `Inflation is set to 0%, so inflation-adjusted and no-inflation dates may match.`;
  const retireText = retireDate
    ? `Calculations begin from ${formatMonthYear(retireDate)}.`
    : `Calculations begin immediately.`;
  if (summaryEl)
    summaryEl.innerHTML = `<p>We project ${passiveAssets.length} passive income asset${
      passiveAssets.length === 1 ? "" : "s"
    } using your growth assumptions and compare their annual passive income to ${costDescriptor}. ${inflationText} ${retireText} Each scenario shows when income first covers your costs, plus the same calculation without inflation.</p>`;

  const inflationFactorText = (factor) => {
    if (!(factor > 0)) return "unchanged from today";
    const delta = (factor - 1) * 100;
    if (Math.abs(delta) < 0.1) return "unchanged from today";
    const sign = delta >= 0 ? "+" : "";
    return `${sign}${delta.toFixed(1)}% vs today`;
  };

  const computeCoverage = (scenarioKey, rateKey) => {
    const result = { withInflation: null, withoutInflation: null };
    for (let i = startIndex; i < labels.length; i++) {
      const date = labels[i];
      const yearsAhead = Math.max(0, (date - now) / msPerYear);
      const inflationFactor = Math.pow(1 + inflationPct / 100, yearsAhead);
      let annualPassive = 0;
      assetDetails.forEach((detail) => {
        const values = detail[scenarioKey] || [];
        const rate = detail.annualRates?.[rateKey] ?? 0;
        const value = values[i] ?? 0;
        annualPassive += value * (rate / 100);
      });
      if (!result.withoutInflation && annualPassive >= annualCost) {
        result.withoutInflation = {
          date,
          passive: annualPassive,
          living: annualCost,
          inflationFactor: 1,
        };
      }
      const adjustedCost = annualCost * inflationFactor;
      if (!result.withInflation && annualPassive >= adjustedCost) {
        result.withInflation = {
          date,
          passive: annualPassive,
          living: adjustedCost,
          inflationFactor,
        };
      }
      if (result.withInflation && result.withoutInflation) break;
    }
    return result;
  };

  const tooltips = {
    low: "Uses each asset's low growth rate.",
    base: "Uses each asset's expected growth rate.",
    high: "Uses each asset's high growth rate.",
  };
  const scenarioConfigs = [
    { key: "low", rate: "low", label: "Low Growth" },
    { key: "base", rate: "base", label: "Expected Growth" },
    { key: "high", rate: "high", label: "High Growth" },
  ];
  const cards = scenarioConfigs.map((cfg) => {
    const coverage = computeCoverage(cfg.key, cfg.rate);
    const withInfl = coverage.withInflation;
    const noInfl = coverage.withoutInflation;
    const withHit = withInfl
      ? `<span class="text-green-500">${formatMonthYear(withInfl.date)}</span>`
      : '<span class="text-red-600">Not reached</span>';
    const withoutHit = noInfl
      ? `<span class="text-green-500">${formatMonthYear(noInfl.date)}</span>`
      : '<span class="text-red-600">Not reached</span>';
    const withDetail = withInfl
      ? `Inflation-adjusted living costs: ${fmtCurrency(
          withInfl.living,
        )} (${inflationFactorText(withInfl.inflationFactor)}). Passive income: ${fmtCurrency(
          withInfl.passive,
        )} per year (~${fmtCurrency(withInfl.passive / 12)} per month).`
      : "Passive income stays below your inflation-adjusted living costs within this forecast horizon.";
    const withoutDetail = noInfl
      ? `Living costs today: ${fmtCurrency(noInfl.living)}. Passive income: ${fmtCurrency(
          noInfl.passive,
        )} per year (~${fmtCurrency(noInfl.passive / 12)} per month).`
      : "Passive income also stays below today's living costs within this horizon.";
    let deltaLine = "";
    if (withInfl && noInfl && withInfl.date && noInfl.date) {
      const deltaMonths = Math.round(
        (withInfl.date - noInfl.date) / (1000 * 60 * 60 * 24 * 30.4375),
      );
      if (deltaMonths > 0) {
        deltaLine = `<p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Inflation delays coverage by about ${deltaMonths} month${
          deltaMonths === 1 ? "" : "s"
        }.</p>`;
      } else if (deltaMonths < 0) {
        const adv = Math.abs(deltaMonths);
        deltaLine = `<p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Inflation brings coverage forward by about ${adv} month${
          adv === 1 ? "" : "s"
        }.</p>`;
      }
    }
    return `
      <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-left stat-box relative z-0 hover:z-50">
        <h5 class="font-bold text-gray-900 dark:text-gray-100 flex items-center justify-between">
          ${cfg.label}
          <span class="relative group inline-block align-middle cursor-help ml-2">
            <span class="text-gray-400">?</span>
            <span class="hidden group-hover:block absolute z-50 mt-2 w-64 p-3 rounded-lg shadow bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs">${
              tooltips[cfg.key]
            }</span>
          </span>
        </h5>
        <p class="text-sm mt-2">Inflation-adjusted: ${withHit}</p>
        <p class="text-xs text-gray-600 dark:text-gray-300 mt-1">${withDetail}</p>
        <p class="text-sm mt-3">No inflation: ${withoutHit}</p>
        <p class="text-xs text-gray-600 dark:text-gray-300 mt-1">${withoutDetail}</p>
        ${deltaLine}
      </div>
    `;
  });
  if (resultsEl) resultsEl.innerHTML = cards.join("\n");
}

// no-op: auto-SWR removed; user enters expected real return directly

function refreshFireProjection() {
  const resultEl = $("fireResult");
  if (!resultEl) return;
  if (!fireLastInputs) {
    resultEl.innerHTML =
      '<p class="text-sm text-gray-600 dark:text-gray-300">Enter your living costs to see your FIRE target.</p>';
    return;
  }
  const { annualExpenses, withdrawalRate } = fireLastInputs;
  if (!(annualExpenses > 0) || !(withdrawalRate > 0)) {
    resultEl.innerHTML =
      '<p class="text-sm text-gray-600 dark:text-gray-300">Enter your living costs to see your FIRE target.</p>';
    return;
  }
  // Simple FIRE number using a safe withdrawal rate (SWR)
  const r = Math.max(0.001, (withdrawalRate || 0) / 100);
  const fireNumber = annualExpenses / r;
  const netWorth = calculateNetWorth();
  const progressPct =
    fireNumber > 0 ? (netWorth / fireNumber) * 100 : 0;
  const clampedProgress = Math.min(
    100,
    Math.max(0, progressPct),
  );
  const rateLabel = withdrawalRate.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  let rateFootnote = `Safe withdrawal rate: ${rateLabel}%`;
  const frequencyLabel =
    fireExpensesFrequency === "monthly" ? "monthly" : "annual";
  const progressLabel =
    netWorth >= fireNumber
      ? "You're already at or above your FIRE number."
      : `Progress: ${clampedProgress.toFixed(1)}% of your FIRE number.`;
  // Build a simple green progress bar
  const progressBar = `
    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
      <div class="bg-green-500 h-3" style="width: ${clampedProgress}%;"></div>
    </div>
  `;
  resultEl.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="rounded-lg bg-gray-100 dark:bg-gray-700 p-3">
        <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Annual Living Costs</p>
        <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">${fmtCurrency(
          annualExpenses,
        )}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Entered as ${frequencyLabel} spending.</p>
      </div>
      <div class="rounded-lg bg-gray-100 dark:bg-gray-700 p-3">
        <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">FIRE Number</p>
        <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">${fmtCurrency(
          fireNumber,
        )}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${rateFootnote}</p>
      </div>
      <div class="rounded-lg bg-gray-100 dark:bg-gray-700 p-3">
        <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Progress</p>
        <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">${clampedProgress.toFixed(1)}%</p>
        <div class="mt-2">${progressBar}</div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">${progressLabel}</p>
      </div>
    </div>
  `;
}

function renderProfileOptions() {
  const sel = $("profileSelect");
  if (sel) {
    sel.innerHTML = profiles
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join("");
    if (activeProfile) sel.value = activeProfile.id;
  }
  if (profilePickers.export) {
    populateProfilePickerOptions("export", profiles);
  }
}

function switchProfile(id, { showFeedback = false } = {}) {
  saveCurrentProfile();
  activeProfile = profiles.find((p) => p.id == id);
  if (!activeProfile) return;
  assets = activeProfile.assets || [];
  incomes = activeProfile.incomes || [];
  liabilities = activeProfile.liabilities || [];
  snapshots = activeProfile.snapshots || [];
  simEvents = activeProfile.simEvents || [];
  goalValue = activeProfile.goalValue || 0;
  goalTargetDate = activeProfile.goalTargetDate || null;
  inflationRate =
    activeProfile.inflationRate != null ? activeProfile.inflationRate : 2.5;
  fireExpenses =
    activeProfile.fireExpenses != null ? activeProfile.fireExpenses : 0;
  fireExpensesFrequency =
    activeProfile.fireExpensesFrequency === "monthly"
      ? "monthly"
      : "annual";
  fireWithdrawalRate =
    activeProfile.fireWithdrawalRate > 0
      ? activeProfile.fireWithdrawalRate
      : 4;
  fireProjectionYears =
    activeProfile.fireProjectionYears && activeProfile.fireProjectionYears > 0
      ? activeProfile.fireProjectionYears
      : 30;
  fireForecastCosts =
    activeProfile.fireForecastCosts != null
      ? activeProfile.fireForecastCosts
      : 0;
  fireForecastFrequency =
    activeProfile.fireForecastFrequency === "monthly"
      ? "monthly"
      : "annual";
  fireForecastInflation =
    activeProfile.fireForecastInflation >= 0
      ? activeProfile.fireForecastInflation
      : 2.5;
  fireForecastRetireDate =
    activeProfile.fireForecastRetireDate &&
    isFinite(activeProfile.fireForecastRetireDate)
      ? activeProfile.fireForecastRetireDate
      : null;
  // removed: fireUsePortfolioSWR
  fireLastInputs =
    fireExpenses > 0 && fireWithdrawalRate > 0
      ? { annualExpenses: fireExpenses, withdrawalRate: fireWithdrawalRate }
      : null;
  applyProfilePreferences(activeProfile);
  applyFirstTimeContentHidden(isFirstTimeContentHidden(activeProfile), {
    persistProfile: false,
  });
  $("goalValue").value = goalValue || "";
  $("goalYear").value = goalTargetDate
    ? new Date(goalTargetDate).getFullYear()
    : "";
  const inflEl = $("inflationRate");
  if (inflEl) inflEl.value = inflationRate;
  updateFireFormInputs();
  updateFireForecastInputs();
  updateGoalButton();
  normalizeData();
  loadPassiveAssetSelection(activeProfile);
  taxSettings = normalizeTaxSettings(activeProfile.taxSettings);
  activeProfile.taxSettings = taxSettings;
  invalidateTaxCache();
  updateTaxSettingsUI();
  renderAssets();
  renderIncomes();
  renderLiabilities();
  renderEvents();
  renderSnapshots();
  updateWealthChart();
  updateInflationImpactCard();
  updateSnapshotChart();
  renderAssetBreakdownChart();
  updatePassiveIncome();
  updateFireForecastCard();
  updateEmptyStates();
  refreshFireProjection();
  persist();
  renderProfileOptions();
  if (showFeedback && activeProfile) {
    const name = (activeProfile.name || "").trim() || "Unnamed profile";
    showAlert(`Switched to profile ${name}`);
  }
}

function addProfile(name) {
  const id = Date.now();
  profiles.push({
    id,
    name: name || `Profile ${profiles.length + 1}`,
    assets: [],
    incomes: [],
    liabilities: [],
    snapshots: [],
    simEvents: [],
    goalValue: 0,
    goalTargetDate: null,
    fireExpenses: 0,
    fireExpensesFrequency: "annual",
    fireWithdrawalRate: 4,
    fireProjectionYears: 30,
    // removed: fireUsePortfolioSWR
    fireForecastCosts: 0,
    fireForecastFrequency: "annual",
    fireForecastInflation: 2.5,
    fireForecastRetireDate: null,
    taxSettings: normalizeTaxSettings(),
    themeChoice: currentThemeChoice,
    darkMode: isDarkMode,
    passiveIncomeAssetSelection: null,
    firstTimeContentHidden: isFirstTimeContentHidden(),
    mobileNavSticky: isMobileNavSticky,
    scenarioEventsEnabled: true,
  });
  if (
    profiles.length === 2 &&
    profiles[0].name === "Default" &&
    !profiles[0].assets.length &&
    !profiles[0].liabilities.length &&
    !profiles[0].snapshots.length &&
    !profiles[0].simEvents.length &&
    !profiles[0].goalValue &&
    !profiles[0].goalTargetDate
  ) {
    profiles.splice(0, 1);
  }
  switchProfile(id);
}

function renameActiveProfile(name) {
  if (!activeProfile) return;
  activeProfile.name = name || activeProfile.name;
  persist();
  renderProfileOptions();
}

function deleteActiveProfile() {
  if (!activeProfile) return;
  const id = activeProfile.id;
  profiles = profiles.filter((p) => p.id !== id);
  activeProfile = null;
  if (profiles.length) {
    switchProfile(profiles[0].id);
  } else {
    assets = [];
    incomes = [];
    liabilities = [];
    snapshots = [];
    simEvents = [];
    scenarioEventsEnabled = true;
    goalValue = 0;
    goalTargetDate = null;
    fireExpenses = 0;
    fireExpensesFrequency = "annual";
    fireWithdrawalRate = 4;
    fireLastInputs = null;
    fireForecastCosts = 0;
    fireForecastFrequency = "annual";
    fireForecastInflation = 2.5;
    fireForecastRetireDate = null;
    passiveAssetSelection = null;
    $("goalYear").value = "";
    taxSettings = normalizeTaxSettings();
    updateTaxSettingsUI();
    invalidateTaxCache();
    $("goalValue").value = "";
    updateFireFormInputs();
    updateFireForecastInputs();
    updateGoalButton();
    renderAssets();
    renderIncomes();
    renderLiabilities();
    renderEvents();
    renderSnapshots();
    updateWealthChart();
    updateSnapshotChart();
    renderAssetBreakdownChart();
    updatePassiveIncome();
    updateFireForecastCard();
    refreshFireProjection();
    updateEmptyStates();
    applyFirstTimeContentHidden(false, { persistProfile: false });
    persist();
    renderProfileOptions();
  }
}

// Empty states and gating UX for new users
function canRunStressTest() {
  return goalValue > 0 && goalTargetDate != null && assets.length > 0;
}

function updateEmptyStates() {
  const hasAssets = assets.length > 0;
  const hasIncome = incomes.length > 0;
  const hasLiabs = liabilities.length > 0;
  const hasGoalData = goalValue > 0 || goalTargetDate;
  const hasGoal = goalValue > 0 && goalTargetDate;
  const canForecast = hasAssets || hasLiabs || hasIncome;
  const goalInsightsAvailable = canForecast && hasGoal;
  const canStressTest = canRunStressTest();
  const hasAnyData =
    hasAssets ||
    hasIncome ||
    hasLiabs ||
    snapshots.length > 0 ||
    simEvents.length > 0 ||
    hasGoalData;
  const isFresh = !hasAnyData;

  // Save Snapshot gating
  const snapBtn = $("snapshotBtn");
  const snapHint = $("snapshotEmptyHint");
  if (snapBtn) snapBtn.disabled = !(hasAssets || hasLiabs);
  if (snapHint)
    snapHint.classList.toggle("hidden", hasAssets || hasLiabs);

  // Export gating
  const expBtn = $("exportBtn");
  const expHint = $("exportEmptyHint");
  if (expBtn) expBtn.disabled = !hasAnyData;
  if (expHint) expHint.classList.toggle("hidden", hasAnyData);

  // Events hint
  const evHint = $("eventsHint");
  if (evHint) evHint.classList.toggle("hidden", hasAssets || hasLiabs);

  // Hide full cards for brand-new users
  const ForecastCard = $("ForecastCard");
  const forecastGoalsCard = $("forecastGoalsCard");
  const forecastRecommendationsCard = $("forecastRecommendationsCard");
  if (ForecastCard) ForecastCard.hidden = !canForecast;
  if (forecastGoalsCard) forecastGoalsCard.hidden = !goalInsightsAvailable;
  if (forecastRecommendationsCard)
    forecastRecommendationsCard.hidden = !canForecast;
  const saveSnapCard = $("saveSnapshotCard");
  if (saveSnapCard) saveSnapCard.hidden = isFresh;
  const snapHistCard = $("snapshotHistoryCard");
  if (snapHistCard) snapHistCard.hidden = snapshots.length === 0;
  const progressCard = $("progressCheckCard");
  if (progressCard)
    progressCard.hidden = snapshots.length === 0 || !canForecast;
  const exportCard = $("exportCard");
  if (exportCard) exportCard.hidden = isFresh;
  const futurePortfolioCard = $("futurePortfolioCard");
  if (futurePortfolioCard) futurePortfolioCard.hidden = !hasAssets;
  const stressTestCard = $("StressTestCard");
  if (stressTestCard) stressTestCard.hidden = !canStressTest;
  if (!canStressTest) {
    const stressResult = $("stressTestResult");
    if (stressResult) {
      stressResult.className = "mt-4 text-sm";
      stressResult.innerHTML = "";
    }
  }
  const snapshotSection = $("snapshots");
  if (snapshotSection)
    snapshotSection.classList.toggle("hidden", isFresh);

  // Forecast navigation visibility
  const forecastBtn = document.querySelector('nav button[data-target="forecasts"]');
  if (forecastBtn) {
    const wasHidden = forecastBtn.classList.contains("hidden");
    forecastBtn.classList.toggle("hidden", !canForecast);
    if (canForecast && wasHidden) {
      forecastBtn.classList.add("fade-in");
      setTimeout(() => forecastBtn.classList.remove("fade-in"), 500);
    }
  }
  if (!canForecast && $("forecasts").classList.contains("active")) {
    navigateTo("data-entry");
  }

  // Portfolio navigation visibility
  const portfolioBtn = document.querySelector('nav button[data-target="portfolio-analysis"]');
  if (portfolioBtn) {
    const wasHidden = portfolioBtn.classList.contains("hidden");
    portfolioBtn.classList.toggle("hidden", !hasAssets);
    if (hasAssets && wasHidden) {
      portfolioBtn.classList.add("fade-in");
      setTimeout(() => portfolioBtn.classList.remove("fade-in"), 500);
    }
  }
  if (!hasAssets && $("portfolio-analysis").classList.contains("active")) {
    navigateTo("data-entry");
  }

  const snapshotsBtn = document.querySelector('nav button[data-target="snapshots"]');
  const hasSnapshotAccess = !isFresh;
  if (snapshotsBtn) {
    const wasHidden = snapshotsBtn.classList.contains("hidden");
    snapshotsBtn.classList.toggle("hidden", !hasSnapshotAccess);
    if (hasSnapshotAccess && wasHidden) {
      snapshotsBtn.classList.add("fade-in");
      setTimeout(() => snapshotsBtn.classList.remove("fade-in"), 500);
    }
  }
  if (!hasSnapshotAccess && $("snapshots").classList.contains("active")) {
    navigateTo("data-entry");
  }
}

// Rendering
function renderAssets() {
  const tableBody = $("assetTableBody");
  const tableContainer = tableBody.closest(".overflow-x-auto");
  tableContainer.hidden = assets.length === 0;

  const sorted =
    typeof sortAssetsForView === "function"
      ? sortAssetsForView([...assets])
      : [...assets].sort((a, b) => a.name.localeCompare(b.name));

  const taxSummary = computeAssetTaxDetails();
  const taxDetails = taxSummary.detailMap;

  tableBody.innerHTML = sorted
    .map((asset) => {
      const originalIndex = assets.findIndex((a) => a === asset);
      const currentValue = calculateCurrentValue(asset);
      const hasDeposit =
        asset.originalDeposit > 0 && asset.frequency !== "none";
      const depositText = (() => {
        if (!hasDeposit) return "-";
        if (asset.frequency) {
          return `${fmtCurrency(asset.originalDeposit)} (${asset.frequency})`;
        }
        return fmtCurrency(asset.originalDeposit);
      })();
      const explicitStart = toTimestamp(asset.explicitStartDate);
      let startCell = "-";
      if (explicitStart != null) {
        const startLabel = fmtDate(new Date(explicitStart));
        const isUpcoming = explicitStart > Date.now();
        startCell = isUpcoming
          ? `${startLabel}<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Upcoming</span>`
          : startLabel;
      }
      const passiveBadge =
        asset.includeInPassive !== false
          ? '<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" title="Included in Current Passive Income Estimates">Passive Income</span>'
          : "";
      const detail = taxDetails.get(asset.dateAdded);
      const lowGross = getGrossRate(asset, "low");
      const baseGross = getGrossRate(asset, "base");
      const highGross = getGrossRate(asset, "high");
      const lowNet = detail?.low?.netRate ?? lowGross;
      const baseNet = detail?.base?.netRate ?? baseGross;
      const highNet = detail?.high?.netRate ?? highGross;
      const growthLines =
        '<span class="inline-flex items-center gap-4 whitespace-nowrap">' +
        `<span><span class="text-xs text-gray-500 dark:text-gray-400">Low:</span> ${formatGrossNetRate(lowGross, lowNet)}</span>` +
        `<span><span class="text-xs text-gray-500 dark:text-gray-400">Exp:</span> ${formatGrossNetRate(baseGross, baseNet)}</span>` +
        `<span><span class="text-xs text-gray-500 dark:text-gray-400">High:</span> ${formatGrossNetRate(highGross, highNet)}</span>` +
        "</span>";
      const taxInfo = describeAssetTax(asset, taxSummary);
      return `<tr class="text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
    <td class="px-6 py-3 whitespace-nowrap align-middle">${asset.name}${passiveBadge}</td>
    <td class="px-6 py-3 whitespace-nowrap align-middle">${startCell}</td>
    <td class="px-6 py-3 whitespace-nowrap align-middle font-semibold">${fmtCurrency(currentValue)}</td>
    <td class="px-6 py-3 whitespace-nowrap align-middle">${depositText}</td>
    <td class="px-6 py-3 whitespace-nowrap align-middle">${growthLines}</td>
    <td class="px-6 py-3 whitespace-nowrap align-middle">${taxInfo}</td>
    <td class="px-6 py-3 whitespace-nowrap text-right text-sm font-medium flex items-center gap-2">
      <button data-action="edit-asset" data-index="${originalIndex}" class="btn-icon" title="Edit Asset">
        <svg class="h-5 w-5" fill="currentColor"><use href="#i-edit"/></svg>
      </button>
      <button data-action="delete-asset" data-index="${originalIndex}" class="btn-icon text-red-600 hover:text-red-900 dark:text-red-500 dark:hover:text-red-400" title="Delete Asset">
        <svg class="h-5 w-5" fill="currentColor"><use href="#i-bin"/></svg>
      </button>
    </td>
  </tr>`;
    })
    .join("");

  updateTotals();
  renderEventAssetOptions();
  renderTaxCalculatorOptions();
  renderStressAssetOptions();
  renderPassiveAssetPickerOptions();
  persist();
  updateWealthChart();
  renderAssetBreakdownChart();
  updatePassiveIncome();
  updateSnapshotComparisonCard();
}

function renderIncomes() {
  const tableBody = $("incomeTableBody");
  if (!tableBody) return;
  const tableContainer = tableBody.closest(".overflow-x-auto");
  if (tableContainer) tableContainer.hidden = incomes.length === 0;

  const sorted = [...incomes].sort((a, b) =>
    (a?.name || "").localeCompare(b?.name || "", undefined, {
      sensitivity: "base",
    }),
  );

  tableBody.innerHTML = sorted
    .map((inc) => {
      const idx = incomes.findIndex((i) => i === inc);
      const explicitStart = toTimestamp(inc.explicitStartDate);
      let startCell = "-";
      if (explicitStart != null) {
        const startLabel = fmtDate(new Date(explicitStart));
        const isUpcoming = explicitStart > Date.now();
        startCell = isUpcoming
          ? `${startLabel}<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Upcoming</span>`
          : startLabel;
      }
      const hasAmount = inc.amount > 0 && inc.frequency !== "none";
      const amountLabel = hasAmount
        ? `${fmtCurrency(inc.amount)} (${inc.frequency})`
        : fmtCurrency(inc.amount || 0);
      return `<tr class="text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
    <td class="px-6 py-3 whitespace-nowrap align-middle">${inc.name}</td>
    <td class="px-6 py-3 whitespace-nowrap align-middle">${startCell}</td>
    <td class="px-6 py-3 whitespace-nowrap align-middle font-semibold">${amountLabel}</td>
    <td class="px-6 py-3 whitespace-nowrap text-right text-sm font-medium flex items-center gap-2">
      <button data-action="edit-income" data-index="${idx}" class="btn-icon" title="Edit Income">
        <svg class="h-5 w-5" fill="currentColor"><use href="#i-edit"/></svg>
      </button>
      <button data-action="delete-income" data-index="${idx}" class="btn-icon text-red-600 hover:text-red-900 dark:text-red-500 dark:hover:text-red-400" title="Delete Income">
        <svg class="h-5 w-5" fill="currentColor"><use href="#i-bin"/></svg>
      </button>
    </td>
  </tr>`;
    })
    .join("");
  persist();
  updateWealthChart();
  updateEmptyStates();
}

function renderEventAssetOptions(sel = $("eventAsset")) {
  if (!sel) return;
  const current = sel.value;
  const opts = [...assets].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", undefined, {
      sensitivity: "base",
    }),
  );
  sel.innerHTML =
    '<option value="">None</option>' +
    opts
      .map((a) => `<option value="${a.dateAdded}">${a.name}</option>`)
      .join("");
  if (current) sel.value = current;
}

function renderTaxCalculatorOptions() {
  const select = $("taxAssetSelect");
  if (!select) return;
  const current = select.value;
  const opts = [...assets].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", undefined, {
      sensitivity: "base",
    }),
  );
  const options = ["<option value=\"\">Manual entry</option>"];
  opts.forEach((asset) => {
    options.push(`<option value="${asset.dateAdded}">${asset.name}</option>`);
  });
  select.innerHTML = options.join("");
  if (current) select.value = current;
  if (select.selectedIndex === -1) select.value = "";
  updateTaxCalculatorInputs();
}

function updateTaxCalculatorInputs() {
  const select = $("taxAssetSelect");
  const valueInput = $("taxAssetValue");
  const rateInput = $("taxAssetReturn");
  const treatmentSelect = $("taxAssetTreatment");
  const notice = $("taxCalculatorSourceNotice");
  if (!select || !valueInput || !rateInput || !treatmentSelect) return;
  const assetId = select.value;
  if (assetId) {
    const asset = assets.find((a) => String(a.dateAdded) === assetId);
    if (!asset) {
      select.value = "";
      updateTaxCalculatorInputs();
      return;
    }
    const currentValue = calculateCurrentValue(asset);
    valueInput.value = Number(currentValue.toFixed(2)).toString();
    const grossRate = getGrossRate(asset, "base");
    rateInput.value = Number(grossRate.toFixed(2)).toString();
    treatmentSelect.value = normalizeTaxTreatment(asset.taxTreatment);
    valueInput.readOnly = true;
    rateInput.readOnly = true;
    treatmentSelect.disabled = true;
    if (notice)
      notice.textContent =
        "Using the selected asset's current value and expected return. Allowances are shared across all taxable assets.";
    return;
  }
  valueInput.readOnly = false;
  rateInput.readOnly = false;
  treatmentSelect.disabled = false;
  if (notice)
    notice.textContent =
      "Manual scenario. The allowances above are applied entirely to this asset.";
}

function updateStressAssetsButtonLabel() {
  const btn = $("stressAssetsToggle");
  if (!btn) return;
  const total = assets.length;
  const selected = stressAssetIds.size;
  btn.textContent = selected === total ? "All Assets" : `${selected}/${total} Selected`;
}

function renderStressAssetOptions() {
  const menu = $("stressAssetsMenu");
  if (!menu) return;
  const currentIds = new Set(assets.map((a) => a.dateAdded));
  stressAssetIds.forEach((id) => {
    if (!currentIds.has(id)) stressAssetIds.delete(id);
  });
  assets.forEach((a) => stressAssetIds.add(a.dateAdded));
  const opts = [...assets].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", undefined, {
      sensitivity: "base",
    }),
  );
  menu.innerHTML = opts
    .map(
      (a) =>
        `<label class="flex items-center px-3 py-2"><input type="checkbox" data-id="${a.dateAdded}" class="mr-2" ${stressAssetIds.has(a.dateAdded) ? "checked" : ""}/><span>${a.name}</span></label>`
    )
    .join("");
  updateStressAssetsButtonLabel();
}

function renderLiabilities() {
  const tableBody = $("liabilityTableBody");
  if (!tableBody) return;
  const tableContainer = tableBody.closest(".overflow-x-auto");
  tableContainer.hidden = liabilities.length === 0;

  tableBody.innerHTML = liabilities
    .map((l, i) => {
      const hasPay = l.originalPayment > 0 && l.frequency !== "none";
      const payText = hasPay
        ? `${fmtCurrency(l.originalPayment)} (${l.frequency})`
        : "-";
      const currentValue = calculateCurrentLiability(l);
      const explicitStart = toTimestamp(l.explicitStartDate);
      let startCell = "-";
      if (explicitStart != null) {
        const startLabel = fmtDate(new Date(explicitStart));
        const isUpcoming = explicitStart > Date.now();
        startCell = isUpcoming
          ? `${startLabel}<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Upcoming</span>`
          : startLabel;
      }
      return `<tr class="text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
    <td class="px-6 py-4 whitespace-nowrap">${l.name}</td>
    <td class="px-6 py-4 whitespace-nowrap">${startCell}</td>
    <td class="px-6 py-4 whitespace-nowrap font-semibold">${fmtCurrency(currentValue)}</td>
    <td class="px-6 py-4 whitespace-nowrap">${payText}</td>
    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex items-center gap-2">
      <button data-action="edit-liability" data-index="${i}" class="btn-icon" title="Edit Liability">
        <svg class="h-5 w-5" fill="currentColor"><use href="#i-edit"/></svg>
      </button>
      <button data-action="delete-liability" data-index="${i}" class="btn-icon text-red-600 hover:text-red-900 dark:text-red-500 dark:hover:text-red-400" title="Delete Liability">
        <svg class="h-5 w-5" fill="currentColor"><use href="#i-bin"/></svg>
      </button>
    </td>
  </tr>`;
    })
    .join("");
  updateTotals();
  persist();
  updateWealthChart();
}

function updateTotals() {
  const totalAssets = assets.reduce(
    (sum, a) => sum + calculateCurrentValue(a),
    0,
  );
  const totalLiabs = liabilities.reduce(
    (sum, l) => sum + calculateCurrentLiability(l),
    0,
  );
  const current = fmtCurrency(totalAssets - totalLiabs);
  const elWealthOld = $("totalWealth");
  const elWealthForecast = $("totalWealthForecast");
  if (elWealthOld) elWealthOld.textContent = current;
  if (elWealthForecast) elWealthForecast.textContent = current;
}

function updateScenarioEventsUI() {
  const toggle = $("scenarioEventsToggle");
  if (toggle) toggle.checked = !!scenarioEventsEnabled;
  const status = $("scenarioEventsStatus");
  if (status) {
    const baseClass = "text-xs font-medium mt-1 ";
    if (scenarioEventsEnabled) {
      status.className =
        baseClass + "text-green-600 dark:text-green-400";
      status.textContent =
        "Scenario Modelling events are enabled.";
    } else {
      status.className =
        baseClass + "text-amber-600 dark:text-amber-400";
      status.textContent =
        "Scenario Modelling events are paused.";
    }
  }
}

function applyScenarioEventsEnabled(
  enabled,
  { persistChoice = true, refresh = true } = {},
) {
  const normalized = !!enabled;
  scenarioEventsEnabled = normalized;
  if (activeProfile) activeProfile.scenarioEventsEnabled = normalized;
  updateScenarioEventsUI();
  if (persistChoice) persist();
  if (refresh) {
    lastForecastScenarios = null;
    updateWealthChart();
    if (!(assets.length || liabilities.length)) {
      updateFuturePortfolioCard();
    }
    updatePassiveIncome();
  }
}

function renderEvents() {
  const body = $("eventTableBody");
  const container = body.closest(".overflow-x-auto");
  container.hidden = simEvents.length === 0;
  body.innerHTML = simEvents
    .map((ev, i) => {
      const assetName =
        assets.find((a) => a.dateAdded === ev.assetId)?.name || "-";
      const amt = ev.isPercent ? `${ev.amount}%` : fmtCurrency(ev.amount);
      return `
    <tr class="text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
      <td class="px-6 py-4 whitespace-nowrap">${ev.name}</td>
      <td class="px-6 py-4 whitespace-nowrap">${fmtDate(new Date(ev.date))}</td>
      <td class="px-6 py-4 whitespace-nowrap">${ev.assetId ? assetName : "-"}</td>
      <td class="px-6 py-4 whitespace-nowrap font-semibold">${amt}</td>
      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex items-center gap-2">
        <button data-action="edit-event" data-index="${i}" class="btn-icon" title="Edit Event">
          <svg class="h-5 w-5" fill="currentColor"><use href="#i-edit"/></svg>
        </button>
        <button data-action="delete-event" data-index="${i}" class="btn-icon text-red-600 hover:text-red-900 dark:text-red-500 dark:hover:text-red-400" title="Delete Event">
          <svg class="h-5 w-5" fill="currentColor"><use href="#i-bin"/></svg>
        </button>
      </td>
    </tr>`;
    })
    .join("");
  updateScenarioEventsUI();
  persist();
  updateWealthChart();
  updatePassiveIncome();
}

function renderSnapshots() {
  $("snapshotsHeader").style.display =
    snapshots.length > 0 ? "block" : "none";
  $("snapshotUl").innerHTML = snapshots
    .map(
      (s, i) => `
  <li class="py-3 border-b border-gray-200 last:border-b-0 dark:border-gray-700">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <span class="font-medium text-gray-900 dark:text-gray-100">${s.name}</span>
        <span class="text-gray-500 dark:text-gray-400 text-sm ml-2">(${fmtDate(new Date(s.date))})</span>
      </div>
      <div class="flex items-center justify-between gap-3 sm:justify-end">
        <span class="font-semibold text-gray-900 dark:text-gray-100">${fmtCurrency(s.value)}</span>
        <button data-action="view-snapshot" data-index="${i}" class="hidden text-blue-500 hover:text-blue-700 sm:inline-block">View Details</button>
        <button data-action="rename-snapshot" data-index="${i}" class="hidden sm:inline-flex btn-icon text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Rename Snapshot">
          <svg class="h-5 w-5" fill="currentColor"><use href="#i-edit"/></svg>
        </button>
        <button data-action="delete-snapshot" data-index="${i}" class="hidden sm:inline-flex btn-icon text-red-600 hover:text-red-900 dark:text-red-500 dark:hover:text-red-400" title="Delete Snapshot">
          <svg class="h-5 w-5" fill="currentColor"><use href="#i-bin"/></svg>
        </button>
        <div class="relative sm:hidden">
          <button
            type="button"
            class="btn btn-gray px-3 py-1.5 text-sm font-medium flex items-center gap-2"
            data-action="toggle-snapshot-actions"
            data-index="${i}"
            data-snapshot-toggle="${i}"
            aria-expanded="false"
          >
            Actions
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z" />
            </svg>
          </button>
          <div
            class="hidden absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-20 dark:border-gray-600 dark:bg-gray-700"
            data-snapshot-menu="${i}"
          >
            <button type="button" data-action="view-snapshot" data-index="${i}" class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600">View Details</button>
            <button type="button" data-action="rename-snapshot" data-index="${i}" class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600">Rename</button>
            <button type="button" data-action="delete-snapshot" data-index="${i}" class="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-gray-600">Delete</button>
          </div>
        </div>
      </div>
    </div>
  </li>`,
    )
    .join("");
  closeSnapshotActionMenus();
  updateSnapshotChart();
  renderProgressCheck();
  updateSnapshotComparisonCard();
}

function closeSnapshotActionMenus() {
  document
    .querySelectorAll("[data-snapshot-menu]")
    .forEach((menu) => menu.classList.add("hidden"));
  document
    .querySelectorAll("[data-snapshot-toggle]")
    .forEach((btn) => btn.setAttribute("aria-expanded", "false"));
}

function renderProgressCheck() {
  const card = $("progressCheckCard");
  const empty = $("progressCheckEmpty");
  const controls = $("progressCheckControls");
  const select = $("progressCheckSelect");
  const result = $("progressCheckResult");
  if (!card || !select || !result) return;

  if (snapshots.length === 0) {
    if (empty) empty.classList.remove("hidden");
    if (controls) controls.classList.add("hidden");
    select.innerHTML = "";
    progressCheckSelection = null;
    result.innerHTML =
      '<p class="text-sm text-gray-500 dark:text-gray-400">Take a snapshot to unlock forecast progress comparisons.</p>';
    return;
  }

  if (empty) empty.classList.add("hidden");
  if (controls) controls.classList.remove("hidden");

  const previousSelection = progressCheckSelection;
  const options = snapshots
    .map(
      (s) =>
        `<option value="${s.date}">${s.name} (${fmtDate(new Date(s.date))})</option>`,
    )
    .join("");
  select.innerHTML = options;

  const hasPrev = previousSelection
    ? snapshots.some((s) => s.date === previousSelection)
    : false;
  const selectedValue = hasPrev
    ? previousSelection
    : snapshots[snapshots.length - 1].date;
  select.value = selectedValue;
  progressCheckSelection = selectedValue;

  select.onchange = (ev) => {
    progressCheckSelection = ev.target.value;
    updateProgressCheckResult();
  };

  updateProgressCheckResult();
}

function updateProgressCheckResult() {
  const select = $("progressCheckSelect");
  const result = $("progressCheckResult");
  if (!select || !result) return;

  if (snapshots.length === 0) {
    result.innerHTML =
      '<p class="text-sm text-gray-500 dark:text-gray-400">Take a snapshot to unlock forecast progress comparisons.</p>';
    return;
  }

  const selectedDate = select.value;
  const snapshot = snapshots.find((s) => s.date === selectedDate);
  if (!snapshot) {
    result.innerHTML =
      '<p class="text-sm text-gray-500 dark:text-gray-400">Select a snapshot to see how you compare with its saved expected projection.</p>';
    return;
  }

  const forecastSeries = snapshot.forecast || snapshot.expectedForecast;
  if (!Array.isArray(forecastSeries) || forecastSeries.length === 0) {
    result.innerHTML =
      '<p class="text-sm text-gray-500 dark:text-gray-400">This snapshot does not include saved projection data. Capture a new snapshot to compare expected progress.</p>';
    return;
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const snapshotDay = new Date(snapshot.date);
  const hasSnapshotDay = Number.isFinite(snapshotDay?.getTime?.());
  if (hasSnapshotDay) snapshotDay.setHours(0, 0, 0, 0);
  // Ensure data is sorted and valid
  const series = forecastSeries
    .map((e) => ({ date: new Date(e.date), value: Number(e.value) }))
    .filter((e) => !Number.isNaN(e.date.getTime()) && Number.isFinite(e.value))
    .sort((a, b) => a.date - b.date);

  if (series.length === 0) {
    result.innerHTML =
      '<p class="text-sm text-gray-500 dark:text-gray-400">Saved projection data for this snapshot could not be read.</p>';
    return;
  }

  let forecastValue;
  let comparisonDate = now;
  const sameDayAsSnapshot = hasSnapshotDay && now <= snapshotDay;

  if (sameDayAsSnapshot) {
    const snapshotTotal = Number(snapshot.value);
    forecastValue = Number.isFinite(snapshotTotal)
      ? snapshotTotal
      : calculateNetWorth();
    comparisonDate = snapshotDay;
  } else {
    // Find bounding points around "now"
    let prev = null;
    let next = null;
    for (const pt of series) {
      if (pt.date <= now) prev = pt;
      if (pt.date >= now) {
        next = pt;
        break;
      }
    }

    if (prev && next && prev.date.getTime() !== next.date.getTime()) {
      // Linear interpolation between prev and next
      const span = next.date - prev.date;
      const alpha = Math.min(1, Math.max(0, (now - prev.date) / span));
      forecastValue = prev.value + alpha * (next.value - prev.value);
    } else if (prev) {
      // After last known point; use last value
      forecastValue = prev.value;
    } else if (next) {
      // Before first known point; use first value
      forecastValue = next.value;
    } else {
      result.innerHTML =
        '<p class="text-sm text-gray-500 dark:text-gray-400">Saved projection data for this snapshot could not be read.</p>';
      return;
    }
  }

  const currentNetWorth = calculateNetWorth();
  const diff = currentNetWorth - forecastValue;
  const tolerance = 1;
  const diffAbs = fmtCurrency(Math.abs(diff));
  const diffSigned =
    diff > tolerance ? `+${diffAbs}` : diff < -tolerance ? `-${diffAbs}` : diffAbs;
  const statusClass =
    diff > tolerance
      ? "text-green-600 dark:text-green-400"
      : diff < -tolerance
        ? "text-red-600 dark:text-red-400"
        : "text-blue-600 dark:text-blue-400";
  const statusText =
    diff > tolerance
      ? `You're ahead of this expected projection by ${diffAbs}.`
      : diff < -tolerance
        ? `You're behind this expected projection by ${diffAbs}.`
        : `You're tracking this expected projection closely (within ${diffAbs}).`;

  result.innerHTML = `
    <div class="space-y-3">
      <p class="text-sm text-gray-600 dark:text-gray-300">
        Saved projection from <strong>${snapshot.name}</strong> expected <span class="whitespace-nowrap">${fmtCurrency(
          forecastValue,
        )}</span> by ${fmtDate(comparisonDate)}.
      </p>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div class="rounded-lg bg-gray-100 p-3 dark:bg-gray-700">
          <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Current Net Worth</p>
          <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">${fmtCurrency(
            currentNetWorth,
          )}</p>
        </div>
        <div class="rounded-lg bg-gray-100 p-3 dark:bg-gray-700">
          <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Projected by Now</p>
          <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">${fmtCurrency(
            forecastValue,
          )}</p>
        </div>
        <div class="rounded-lg bg-gray-100 p-3 dark:bg-gray-700">
          <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Difference</p>
          <p class="text-lg font-semibold ${statusClass}">${diffSigned}</p>
          <p class="text-xs mt-1 ${statusClass}">${statusText}</p>
        </div>
      </div>
    </div>
  `;
}

function summarizeSnapshotAssets(assetList) {
  const aggregate = new Map();
  if (Array.isArray(assetList)) {
    assetList.forEach((item) => {
      const name = (item?.name || "").trim();
      if (!name) return;
      const rawValue = Number(item?.value);
      const value = Number.isFinite(rawValue) ? rawValue : 0;
      aggregate.set(name, (aggregate.get(name) || 0) + value);
    });
  }
  const entries = Array.from(aggregate.entries()).map(([name, value]) => ({
    name,
    value,
  }));
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  return { total, entries, map: aggregate };
}

function getSnapshotsAfter(dateValue) {
  if (!dateValue) return [];
  const baseTime = Date.parse(dateValue);
  if (!Number.isFinite(baseTime)) return [];
  return snapshots
    .filter((s) => Date.parse(s.date) > baseTime)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

function updateSnapshotComparisonCard() {
  const card = $("snapshotComparisonCard");
  if (!card) return;
  const empty = $("snapshotComparisonEmpty");
  const controls = $("snapshotComparisonControls");
  const baseSelect = $("snapshotComparisonBase");
  const targetGroup = $("snapshotComparisonTargetGroup");
  const targetSelect = $("snapshotComparisonTarget");
  const modeSelect = $("snapshotComparisonMode");

  if (!snapshots.length) {
    if (empty) empty.classList.remove("hidden");
    if (controls) controls.classList.add("hidden");
    if (targetGroup) targetGroup.classList.add("hidden");
    snapshotComparisonState = {
      baseDate: null,
      mode: "current",
      targetDate: null,
    };
    if (modeSelect) {
      modeSelect.value = "current";
      modeSelect.disabled = true;
      const snapshotOption = modeSelect.querySelector('option[value="snapshot"]');
      if (snapshotOption) snapshotOption.disabled = true;
      modeSelect.onchange = null;
    }
    if (baseSelect) baseSelect.onchange = null;
    if (targetSelect) targetSelect.onchange = null;
    const result = $("snapshotComparisonResult");
    if (result) result.innerHTML = "";
    return;
  }

  if (empty) empty.classList.add("hidden");
  if (controls) controls.classList.remove("hidden");

  if (baseSelect) {
    baseSelect.innerHTML = snapshots
      .map(
        (s) =>
          `<option value="${s.date}">${s.name} (${fmtDate(new Date(s.date))})</option>`,
      )
      .join("");
  }

  if (
    !snapshotComparisonState.baseDate ||
    !snapshots.some((s) => s.date === snapshotComparisonState.baseDate)
  ) {
    snapshotComparisonState.baseDate = snapshots[snapshots.length - 1].date;
  }

  const baseSnapshot = snapshots.find(
    (s) => s.date === snapshotComparisonState.baseDate,
  );
  if (baseSelect) baseSelect.value = snapshotComparisonState.baseDate;

  const laterSnapshots = getSnapshotsAfter(baseSnapshot?.date);

  if (snapshotComparisonState.mode === "snapshot" && !laterSnapshots.length) {
    snapshotComparisonState.mode = "current";
    snapshotComparisonState.targetDate = null;
  }

  if (modeSelect) {
    modeSelect.disabled = false;
    const snapshotOption = modeSelect.querySelector('option[value="snapshot"]');
    if (snapshotOption) snapshotOption.disabled = !laterSnapshots.length;
    if (
      snapshotComparisonState.mode === "snapshot" &&
      snapshotOption &&
      snapshotOption.disabled
    ) {
      snapshotComparisonState.mode = "current";
    }
    modeSelect.value = snapshotComparisonState.mode;
    modeSelect.onchange = (ev) => {
      const nextMode = ev.target.value === "snapshot" ? "snapshot" : "current";
      snapshotComparisonState.mode = nextMode;
      if (nextMode === "snapshot" && !laterSnapshots.length) {
        snapshotComparisonState.mode = "current";
      }
      if (snapshotComparisonState.mode !== "snapshot") {
        snapshotComparisonState.targetDate = null;
      }
      updateSnapshotComparisonCard();
      renderSnapshotComparisonResult();
    };
  }

  if (
    snapshotComparisonState.mode === "snapshot" &&
    !laterSnapshots.some((s) => s.date === snapshotComparisonState.targetDate)
  ) {
    snapshotComparisonState.targetDate = laterSnapshots[0]?.date || null;
  }

  if (targetSelect) {
    targetSelect.innerHTML = laterSnapshots
      .map(
        (s) =>
          `<option value="${s.date}">${s.name} (${fmtDate(new Date(s.date))})</option>`,
      )
      .join("");
    if (snapshotComparisonState.targetDate) {
      targetSelect.value = snapshotComparisonState.targetDate;
    } else if (laterSnapshots.length) {
      targetSelect.value = laterSnapshots[0].date;
      snapshotComparisonState.targetDate = laterSnapshots[0].date;
    } else {
      targetSelect.value = "";
    }
    targetSelect.onchange = (ev) => {
      snapshotComparisonState.targetDate = ev.target.value || null;
      renderSnapshotComparisonResult();
    };
  }

  if (targetGroup) {
    targetGroup.classList.toggle(
      "hidden",
      snapshotComparisonState.mode !== "snapshot" || !laterSnapshots.length,
    );
  }

  if (baseSelect) {
    baseSelect.onchange = (ev) => {
      snapshotComparisonState.baseDate = ev.target.value;
      updateSnapshotComparisonCard();
      renderSnapshotComparisonResult();
    };
  }

  renderSnapshotComparisonResult();
}

function renderSnapshotComparisonResult() {
  const result = $("snapshotComparisonResult");
  if (!result) return;

  if (!snapshots.length) {
    result.innerHTML = "";
    return;
  }

  const baseSnapshot =
    snapshots.find((s) => s.date === snapshotComparisonState.baseDate) ||
    snapshots[snapshots.length - 1];

  if (!baseSnapshot) {
    result.innerHTML =
      '<p class="text-sm text-gray-500 dark:text-gray-400">Select a snapshot to begin comparing.</p>';
    return;
  }

  const baseSummary = summarizeSnapshotAssets(baseSnapshot.assets);
  let comparisonSummary;
  let comparisonLabel;
  let comparisonDateLabel;
  let comparisonSource = snapshotComparisonState.mode;

  if (snapshotComparisonState.mode === "snapshot") {
    const targetSnapshot = snapshots.find(
      (s) => s.date === snapshotComparisonState.targetDate,
    );
    if (targetSnapshot) {
      comparisonSummary = summarizeSnapshotAssets(targetSnapshot.assets);
      comparisonLabel = targetSnapshot.name;
      comparisonDateLabel = fmtDate(new Date(targetSnapshot.date));
    } else {
      comparisonSource = "current";
    }
  }

  if (!comparisonSummary) {
    comparisonSummary = summarizeSnapshotAssets(
      assets.map((a) => ({
        name: a.name,
        value: calculateCurrentValue(a),
      })),
    );
    comparisonLabel = "Current portfolio";
    comparisonDateLabel = fmtDate(new Date());
    comparisonSource = "current";
  }

  const baseDateLabel = fmtDate(new Date(baseSnapshot.date));
  const totalChange = comparisonSummary.total - baseSummary.total;
  const changeAbs = fmtCurrency(Math.abs(totalChange));
  const changeClass =
    totalChange > 1
      ? "text-green-600 dark:text-green-400"
      : totalChange < -1
        ? "text-red-600 dark:text-red-400"
        : "text-blue-600 dark:text-blue-400";
  const changeLabel =
    totalChange > 1
      ? `+${changeAbs}`
      : totalChange < -1
        ? `-${changeAbs}`
        : changeAbs;
  const pctChange =
    baseSummary.total > 0
      ? (totalChange / baseSummary.total) * 100
      : null;
  const pctLabel =
    pctChange == null ? "—" : fmtPercent(pctChange, { signed: true });

  const allNames = new Set([
    ...baseSummary.entries.map((entry) => entry.name),
    ...comparisonSummary.entries.map((entry) => entry.name),
  ]);

  const rows = Array.from(allNames)
    .map((name) => {
      const baseValue = baseSummary.map.get(name) || 0;
      const compareValue = comparisonSummary.map.get(name) || 0;
      if (Math.abs(baseValue) < 0.01 && Math.abs(compareValue) < 0.01)
        return null;
      const baseShare =
        baseSummary.total > 0 ? (baseValue / baseSummary.total) * 100 : 0;
      const compareShare =
        comparisonSummary.total > 0
          ? (compareValue / comparisonSummary.total) * 100
          : 0;
      const shareDiff = compareShare - baseShare;
      const shareDiffClass =
        shareDiff > 0.1
          ? "text-green-600 dark:text-green-400"
          : shareDiff < -0.1
            ? "text-red-600 dark:text-red-400"
            : "text-gray-600 dark:text-gray-300";
      const valueDiff = compareValue - baseValue;
      const valueAbs = fmtCurrency(Math.abs(valueDiff));
      const valueDiffClass =
        valueDiff > 1
          ? "text-green-600 dark:text-green-400"
          : valueDiff < -1
            ? "text-red-600 dark:text-red-400"
            : "text-gray-600 dark:text-gray-300";
      const shareChangeLabel =
        Math.abs(shareDiff) < 0.01
          ? fmtPercent(0, { signed: true })
          : fmtPercent(shareDiff, { signed: true });
      const valueChangeLabel =
        Math.abs(valueDiff) < 1
          ? fmtCurrency(0)
          : valueDiff > 0
            ? `+${valueAbs}`
            : `-${valueAbs}`;
      return {
        name,
        baseValue,
        compareValue,
        baseValueLabel: fmtCurrency(baseValue),
        compareValueLabel: fmtCurrency(compareValue),
        baseShare,
        compareShare,
        shareDiff,
        shareDiffClass,
        shareChangeLabel,
        valueDiffClass,
        valueChangeLabel,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const shareDelta = Math.abs(b.shareDiff) - Math.abs(a.shareDiff);
      if (Math.abs(shareDelta) > 0.0001) return shareDelta;
      const valueDelta = Math.abs(b.compareValue - b.baseValue) - Math.abs(a.compareValue - a.baseValue);
      if (Math.abs(valueDelta) > 0.0001) return valueDelta;
      return a.name.localeCompare(b.name);
    });

  const tableSection = rows.length
    ? `<div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-left">
          <thead class="bg-gray-200 dark:bg-gray-700">
            <tr>
              <th class="table-header">Asset</th>
              <th class="table-header">Base Portfolio %</th>
              <th class="table-header">Compared Portfolio %</th>
              <th class="table-header">Base Value</th>
              <th class="table-header">Compared Value</th>
              <th class="table-header">Portfolio % Change</th>
              <th class="table-header">Value Change</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 text-sm text-gray-700 dark:text-gray-300">
            ${rows
              .map(
                (row) => `
              <tr>
                <td class="px-6 py-3 whitespace-nowrap">${row.name}</td>
                <td class="px-6 py-3 whitespace-nowrap">${fmtPercent(row.baseShare)}</td>
                <td class="px-6 py-3 whitespace-nowrap">${fmtPercent(row.compareShare)}</td>
                <td class="px-6 py-3 whitespace-nowrap">${row.baseValueLabel}</td>
                <td class="px-6 py-3 whitespace-nowrap">${row.compareValueLabel}</td>
                <td class="px-6 py-3 whitespace-nowrap font-semibold ${row.shareDiffClass}">${row.shareChangeLabel}</td>
                <td class="px-6 py-3 whitespace-nowrap font-semibold ${row.valueDiffClass}">${row.valueChangeLabel}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>`
    : '<p class="text-sm text-gray-500 dark:text-gray-400">Asset allocation details for this comparison are not available.</p>';

  const comparisonNote =
    comparisonSource === "current"
      ? "Comparing against your latest asset values."
      : "Comparing two saved snapshots.";

  result.innerHTML = `
    <div class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="rounded-lg bg-gray-100 p-3 dark:bg-gray-700">
          <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Snapshot</p>
          <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">${fmtCurrency(
            baseSummary.total,
          )}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${baseSnapshot.name} - ${baseDateLabel}</p>
        </div>
        <div class="rounded-lg bg-gray-100 p-3 dark:bg-gray-700">
          <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Compared</p>
          <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">${fmtCurrency(
            comparisonSummary.total,
          )}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${comparisonLabel} - ${comparisonDateLabel}</p>
        </div>
        <div class="rounded-lg bg-gray-100 p-3 dark:bg-gray-700">
          <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Change</p>
          <p class="text-lg font-semibold ${changeClass}">${changeLabel}</p>
          <p class="text-xs ${changeClass} mt-1">${pctLabel} change</p>
        </div>
      </div>
      ${tableSection}
      <p class="text-xs text-gray-500 dark:text-gray-400">${comparisonNote}</p>
    </div>
  `;
}

function updateWealthChart() {
  const hasData = assets.length > 0 || liabilities.length > 0 || incomes.length > 0;
  $("wealthChart").hidden = !hasData;
  $("wealthChartMessage").hidden = hasData;
  if (!hasData) {
    wealthChart?.destroy();
    wealthChart = null;
    lastForecastScenarios = null;
    assetForecasts = new Map();
    liabilityForecasts = new Map();
    updateForecastRecommendationsCard();
    refreshFireProjection();
    return;
  }

  const {
    labels,
    base,
    low,
    high,
    minSeriesValue,
    currentBaseline,
  } = buildForecastScenarios();

  const datasets = [
    {
      label: "Low Growth",
      data: low.map((y, i) => ({ x: labels[i], y })),
      borderColor: CHART_COLOURS.red,
      borderDash: [5, 5],
      fill: false,
      pointRadius: 1,
      pointHoverRadius: 6,
      pointHitRadius: 8,
      pointStyle: "circle",
      pointBackgroundColor: CHART_COLOURS.red,
      pointBorderColor: CHART_COLOURS.red,
      pointBorderWidth: 1.5,
    },
    {
      label: "Expected Growth",
      data: base.map((y, i) => ({ x: labels[i], y })),
      borderColor: CHART_COLOURS.blue,
      borderDash: [5, 5],
      backgroundColor: CHART_COLOURS.blueFill,
      tension: 0.4,
      fill: false,
      pointRadius: 1,
      pointHoverRadius: 6,
      pointHitRadius: 8,
      pointStyle: "circle",
      pointBackgroundColor: CHART_COLOURS.blue,
      pointBorderColor: CHART_COLOURS.blue,
      pointBorderWidth: 1.5,
    },
    {
      label: "High Growth",
      data: high.map((y, i) => ({ x: labels[i], y })),
      borderColor: CHART_COLOURS.green,
      borderDash: [5, 5],
      fill: false,
      pointRadius: 1,
      pointHoverRadius: 6,
      pointHitRadius: 8,
      pointStyle: "circle",
      pointBackgroundColor: CHART_COLOURS.green,
      pointBorderColor: CHART_COLOURS.green,
      pointBorderWidth: 1.5,
    },
  ];

  if (currentBaseline > 0) {
    datasets.push({
      label: "Current (Baseline)",
      data: labels.map((d) => ({ x: d, y: currentBaseline })),
      borderColor: "#6b7280",
      pointRadius: 0,
      borderDash: [2, 2],
      fill: false,
    });
  }

  if (goalValue > 0) {
    datasets.push({
      label: "Wealth Goal",
      data: labels.map((d) => ({ x: d, y: goalValue })),
      borderColor: "#ef4444",
      pointRadius: 0,
      fill: false,
    });
  }

  // Anchor the y-axis to current total wealth for a stable baseline
  const minStart = Math.min(currentBaseline, minSeriesValue);
  let yOpts = {
    max: goalValue > 0 ? goalValue * 1.1 : undefined,
    ticks: { callback: currencyTick },
  };

  if (minStart > 0) {
    const suggested = minStart * 0.9;
    const magnitude = Math.pow(10, Math.floor(Math.log10(suggested)));
    let unit = magnitude / 2;
    if (unit < 1) unit = 1;
    yOpts.min = Math.floor(suggested / unit) * unit;
  } else if (minStart < 0) {
    const abs = Math.abs(minStart);
    const magnitude = Math.pow(10, Math.floor(Math.log10(abs)));
    let unit = magnitude / 2;
    if (unit < 1) unit = 1;
    yOpts.min = -Math.ceil(abs / unit) * unit;
  } else {
    yOpts.beginAtZero = true;
  }

  // Determine initial x-axis window. If goal is set and the Low Forecast
  // reaches it earlier than the full horizon, default the view to that
  // point so the data is better distributed horizontally.
  let xMin = labels[0];
  let xMax = labels[labels.length - 1];

  if (goalValue > 0) {
    const hitIdx = low.findIndex((v) => v >= goalValue);
    if (hitIdx >= 0) {
      // Add a small buffer (6 months) beyond the hit point so the
      // marker isn't flush against the right edge and is easier to select.
      const bufferMonths = 6;
      const paddedIdx = Math.min(
        hitIdx + bufferMonths,
        labels.length - 1,
      );
      xMax = labels[paddedIdx];
    }
  }

  const config = {
    type: "line",
    data: { datasets },
    options: {
      ...baseLineOpts,
      scales: {
        ...baseLineOpts.scales,
        x: { ...baseLineOpts.scales.x, min: xMin, max: xMax },
        y: { ...baseLineOpts.scales.y, ...yOpts },
      },
      plugins: {
        ...baseLineOpts.plugins,
        zoom: {
          ...baseLineOpts.plugins.zoom,
          // Prevent zooming/panning outside data bounds and beyond full range
          limits: {
            x: {
              min: labels[0].getTime(),
              max: labels[labels.length - 1].getTime(),
              maxRange:
                labels[labels.length - 1].getTime() - labels[0].getTime(),
            },
          },
          pan: {
            ...baseLineOpts.plugins.zoom.pan,
            onPan: ({ chart }) => adaptChartToZoom(chart),
            onPanComplete: ({ chart }) => adaptChartToZoom(chart),
          },
          zoom: {
            ...baseLineOpts.plugins.zoom.zoom,
            onZoom: ({ chart }) => adaptChartToZoom(chart),
            onZoomComplete: ({ chart }) => adaptChartToZoom(chart),
          },
        },

        tooltip: {
          callbacks: {
            label: (c) => `${c.dataset.label}: ${fmtCurrency(c.raw.y)}`,
            footer: (items) => {
              const [item] = items;
              const { dataIndex, dataset } = item;
              if (
                dataset.label.includes("Goal") ||
                dataset.label.includes("Baseline")
              )
                return "";
              const scenario = dataset.label.includes("Low")
                ? "low"
                : dataset.label.includes("High")
                  ? "high"
                  : "base";
              const assetLines = [...assets]
                .sort((a, b) =>
                  (a.name || "").localeCompare(b.name || "", undefined, {
                    sensitivity: "base",
                  }),
                )
                .map((a) => {
                  const forecast =
                    assetForecasts.get(a.dateAdded)?.[scenario]?.[
                      dataIndex
                    ] ?? 0;
                  return `  ${a.name}: ${fmtCurrency(forecast)}`;
                });
              const liabLines = [...liabilities]
                .sort((a, b) =>
                  (a.name || "").localeCompare(b.name || "", undefined, {
                    sensitivity: "base",
                  }),
                )
                .map((l) => {
                  const forecast =
                    liabilityForecasts.get(l.dateAdded)?.[dataIndex] ?? 0;
                  return `  ${l.name}: ${fmtCurrency(forecast)}`;
                });
              const netCashFlow =
                netCashFlowForecasts?.[scenario]?.[dataIndex] ?? null;
              const netLine =
                netCashFlow !== null && Number.isFinite(netCashFlow)
                  ? [`  Net cash flow (income – liabilities): ${fmtCurrency(netCashFlow)}`]
                  : [];
              const lines = [...assetLines, ...liabLines, ...netLine];
              return lines.length
                ? ["\nForecast breakdown:", ...lines]
                : [];
            },
          },
        },
      },
    },
  };

  wealthChart = ensureChart(
    wealthChart,
    $("wealthChart").getContext("2d"),
    config,
  );
  adaptChartToZoom(wealthChart);
  updateChartTheme();
  attachMobileTooltipDismiss(wealthChart, $("wealthChart"));

  const wrap = $("forecastGoalsDates");
  wrap.innerHTML = "";
  if (goalValue > 0 && (assets.length > 0 || liabilities.length > 0)) {
    const getHit = (arr) => {
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].y >= goalValue) return arr[i].x;
      }
      return null;
    };
    // Datasets are ordered: 0=Low, 1=Expected, 2=High
    const lowHit = getHit(config.data.datasets[0].data);
    const expHit = getHit(config.data.datasets[1].data);
    const highHit = getHit(config.data.datasets[2].data);

    const fmt = (d) => {
      if (d)
        return d.toLocaleString("default", { month: "short", year: "numeric" });
      const y = getGoalTargetYear();
      return y ? `Not met by ${y}` : "Not met in 30 years";
    };
    const cls = (d) => (d ? "text-green-500 " : "text-red-600");
    wrap.innerHTML = `
    <div class="md:col-span-3 text-left text-sm text-gray-600 dark:text-gray-300">
      <strong>Goal achieved by</strong> (estimates based on your inputs):
    </div>
    <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-center stat-box">
      <h5 class="font-bold text-gray-900 dark:text-gray-100 flex items-center justify-center gap-1">Low Growth
        <span class="relative group inline-block align-middle cursor-help">
          <span class="text-gray-400">?</span>
          <span class="hidden group-hover:block absolute z-50 mt-2 w-64 p-3 rounded-lg shadow bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs">Estimated date your goal will be achieved using low growth.</span>
        </span>
      </h5>
      <p class="${cls(lowHit)}">${fmt(lowHit)}</p>
    </div>
    <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-center stat-box">
      <h5 class="font-bold text-gray-900 dark:text-gray-100 flex items-center justify-center gap-1">Expected Growth
        <span class="relative group inline-block align-middle cursor-help">
          <span class="text-gray-400">?</span>
          <span class="hidden group-hover:block absolute z-50 mt-2 w-64 p-3 rounded-lg shadow bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs">Estimated date your goal will be achieved using expected growth.</span>
        </span>
      </h5>
      <p class="${cls(expHit)}">${fmt(expHit)}</p>
    </div>
    <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-center stat-box">
      <h5 class="font-bold text-gray-900 dark:text-gray-100 flex items-center justify-center gap-1">High Growth
        <span class="relative group inline-block align-middle cursor-help">
          <span class="text-gray-400">?</span>
          <span class="hidden group-hover:block absolute z-50 mt-2 w-64 p-3 rounded-lg shadow bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs">Estimated date your goal will be achieved using high growth.</span>
        </span>
      </h5>
      <p class="${cls(highHit)}">${fmt(highHit)}</p>
    </div>`;
  }

  updateForecastRecommendationsCard(labels, low, base, high);
  updateFuturePortfolioCard();
  updateInflationImpactCard();
  updateProgressCheckResult();
  refreshFireProjection();
  updateFireForecastCard();
}

function getGoalHitsFromChart() {
  if (!wealthChart || !goalValue) return null;
  const ds = wealthChart.data?.datasets || [];
  const getHit = (arr) => {
    if (!arr) return null;
    for (let i = 1; i < arr.length; i++) if (arr[i].y >= goalValue) return arr[i].x;
    return null;
  };
  return {
    low: getHit(ds[0]?.data),
    base: getHit(ds[1]?.data),
    high: getHit(ds[2]?.data),
  };
}

function updateForecastRecommendationsCard(
  labels = null,
  lowSeries = null,
  baseSeries = null,
  highSeries = null,
) {
  const container = $("forecastRecommendationsBody");
  if (!container) return;
  const arraysValid =
    Array.isArray(labels) &&
    Array.isArray(lowSeries) &&
    Array.isArray(baseSeries) &&
    Array.isArray(highSeries) &&
    labels.length > 0 &&
    labels.length === lowSeries.length &&
    labels.length === baseSeries.length &&
    labels.length === highSeries.length;

  if (!arraysValid) {
    container.innerHTML =
      '<p class="text-sm text-gray-600 dark:text-gray-300">Update your assets and rerun the forecast to see suggested milestones.</p>';
    return;
  }

  const now = new Date();
  const currentNetWorth = calculateNetWorth();
  const firstLabel = labels[0];
  const lastLabel = labels[labels.length - 1];
  const minTime = firstLabel instanceof Date ? firstLabel.getTime() : null;
  const maxTime = lastLabel instanceof Date ? lastLabel.getTime() : null;
  const horizons = [
    { years: 1, label: "In 1 year" },
    { years: 3, label: "In 3 years" },
    { years: 5, label: "In 5 years" },
  ];

  const getValueAtDate = (series, targetDate) => {
    if (!Array.isArray(series) || !(targetDate instanceof Date)) return null;
    const targetTime = targetDate.getTime();
    if (
      (maxTime != null && targetTime > maxTime) ||
      (minTime != null && targetTime < minTime)
    ) {
      return null;
    }
    let bestIndex = -1;
    let smallestDiff = Infinity;
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      if (!(label instanceof Date)) continue;
      const diff = Math.abs(label.getTime() - targetTime);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) return null;
    const value = series[bestIndex];
    if (Number.isFinite(value)) return value;
    if (value && typeof value.y === "number") return value.y;
    return null;
  };

  const segments = horizons
    .map((horizon) => {
      const targetDate = new Date(now);
      targetDate.setFullYear(targetDate.getFullYear() + horizon.years);
      const lowValue = getValueAtDate(lowSeries, targetDate);
      const baseValue = getValueAtDate(baseSeries, targetDate);
      const highValue = getValueAtDate(highSeries, targetDate);
      const availableValues = [lowValue, baseValue, highValue].filter((v) =>
        Number.isFinite(v),
      );
      if (availableValues.length === 0) return null;

      const average =
        availableValues.reduce((sum, value) => sum + value, 0) /
        availableValues.length;

      const roundedDefault = Math.round(average / 10000) * 10000;
      let milestoneTarget = roundedDefault;
      let milestoneSource = "rounded";

      if (Number.isFinite(highValue) && average >= 200000) {
        const optimisticCandidate = Math.ceil(average / 100000) * 100000;
        const hasHeadroom =
          optimisticCandidate > milestoneTarget &&
          optimisticCandidate > 0 &&
          highValue >= optimisticCandidate;
        const notTooFar =
          optimisticCandidate - average <=
          Math.max(average * 0.12, 200000);
        const meaningfulJump =
          optimisticCandidate - milestoneTarget >= 50000;
        if (hasHeadroom && notTooFar && meaningfulJump) {
          milestoneTarget = optimisticCandidate;
          milestoneSource = "stretch";
        }
      }

      const optimistic = milestoneTarget > average;

      const scenarioBreakdown = [];
      if (Number.isFinite(lowValue))
        scenarioBreakdown.push({ label: "Low", value: lowValue });
      if (Number.isFinite(baseValue))
        scenarioBreakdown.push({ label: "Expected", value: baseValue });
      if (Number.isFinite(highValue))
        scenarioBreakdown.push({ label: "High", value: highValue });
      const scenarioSummary = scenarioBreakdown.length
        ? `
            <div class="space-y-0.5">
              <p class="text-xs font-medium text-gray-600 dark:text-gray-300">Scenario range:</p>
              ${scenarioBreakdown
                .map(
                  ({ label, value }) => `
                    <p class="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                      <span>${label}</span>
                      <span class="font-medium">${fmtCurrency(value)}</span>
                    </p>
                  `,
                )
                .join("")}
            </div>
          `.trim()
        : '<p class="text-xs text-gray-500 dark:text-gray-400">Scenario forecasts unavailable for this horizon.</p>';

      const averageSummary = `Average across scenarios: ${fmtCurrency(
        average,
      )}.`;

      const outlookLabel = optimistic
        ? "Optimistic stretch goal"
        : "Conservative baseline target";
      const outlookToneClass = optimistic
        ? "text-blue-700 dark:text-blue-200"
        : "text-slate-700 dark:text-slate-200";
      const outlookSummary = `Milestone outlook: <span class="font-semibold ${outlookToneClass}">${outlookLabel}</span>.`;

      let roundingSummary;
      if (milestoneSource === "stretch") {
        const highContext = Number.isFinite(highValue)
          ? ` Your high growth scenario reaches about ${fmtCurrency(
              highValue,
            )}, so this stretch remains plausible.`
          : "";
        roundingSummary = `Rounded up to the next £100,000 from ${fmtCurrency(
          average,
        )} to stay within reach of that stretch.${highContext}`;
      } else if (optimistic) {
        roundingSummary = `Rounded to the nearest £10,000 from ${fmtCurrency(
          average,
        )}, nudging the target slightly above the overall forecast average.`;
      } else {
        roundingSummary = `Rounded to the nearest £10,000 from ${fmtCurrency(
          average,
        )} to keep the target grounded.`;
      }

      const gap = milestoneTarget - currentNetWorth;
      const gapAmount = fmtCurrency(Math.abs(gap));
      const currentNetWorthFormatted = fmtCurrency(currentNetWorth);
      const statusClass =
        gap > 0
          ? "text-slate-700 dark:text-slate-200"
          : gap < 0
            ? "text-emerald-600 dark:text-emerald-300"
            : "text-blue-600 dark:text-blue-300";
      const statusText =
        gap > 0
          ? `${gapAmount} of additional growth beyond today's ${currentNetWorthFormatted} net worth keeps you aligned to this projection.`
          : gap < 0
            ? `You're about ${gapAmount} ahead of this projection with today's ${currentNetWorthFormatted} net worth.`
            : `You're right on pace at ${currentNetWorthFormatted} compared with this projection.`;

      const targetDateLabel = targetDate.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });

      const badgeClass = optimistic
        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
        : "bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200";
      const badgeLabel = optimistic ? "Optimistic stretch" : "Conservative";
      const optimisticBadge = `<span class="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${badgeClass}">${badgeLabel}</span>`;

      return `
        <div class="p-4 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 stat-box text-left space-y-2">
          <div class="flex items-center justify-between">
            <h4 class="text-md font-medium text-gray-700 dark:text-gray-300">${horizon.label}</h4>
            ${optimisticBadge}
          </div>
          <p class="text-xs text-gray-600 dark:text-gray-300">${targetDateLabel}</p>
          <p class="text-2xl font-bold">${fmtCurrency(milestoneTarget)}</p>
          <p class="text-xs text-gray-600 dark:text-gray-300">${averageSummary}</p>
          ${scenarioSummary}
          <p class="text-xs text-gray-500 dark:text-gray-400">${outlookSummary}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">${roundingSummary}</p>
          <p class="text-sm font-medium ${statusClass}">${statusText}</p>
        </div>
      `;
    })
    .filter(Boolean);

  if (segments.length === 0) {
    container.innerHTML =
      '<p class="text-sm text-gray-600 dark:text-gray-300">Extend your forecast horizon to cover the next few years and unlock suggested milestones.</p>';
    return;
  }

  container.innerHTML = segments.join("");
}

function updateInflationImpactCard() {
  const lowEl = $("inflLow"), expEl = $("inflExpected"), highEl = $("inflHigh");
  const lowYearEl = $("inflLowYear"), expYearEl = $("inflExpectedYear"), highYearEl = $("inflHighYear");
  const lowEqEl = $("inflLowEq"), expEqEl = $("inflExpectedEq"), highEqEl = $("inflHighEq");
  const rateInput = $("inflationRate");
  const container = $("inflationImpactCard");
  if (!lowEl || !expEl || !highEl || !container) return;
  const hasPrereq = goalValue > 0 && (assets.length > 0 || liabilities.length > 0);
  const rate = Math.max(0, parseFloat(rateInput?.value ?? inflationRate) || 0) / 100;
  const hits = getGoalHitsFromChart();
  const now = new Date();
  const yearsTo = (date) => {
    if (!date) return null;
    return Math.max(0, (date - now) / (1000 * 60 * 60 * 24 * 365.25));
  };
  const pv = (date) => {
    const years = yearsTo(date);
    if (years == null) return null;
    return goalValue / Math.pow(1 + rate, years);
  };
  const fv = (date) => {
    const years = yearsTo(date);
    if (years == null) return null;
    return goalValue * Math.pow(1 + rate, years);
  };
  const missText = () => {
    const y = getGoalTargetYear();
    return y ? `Not met by ${y}` : "Not met in 30 years";
  };
  const setVal = (el, yearEl, date, val) => {
    if (!el) return;
    if (!date) {
      el.textContent = missText();
      el.className = "mt-1 text-red-600";
      if (yearEl) yearEl.textContent = "";
    } else {
      el.textContent = fmtCurrency(val || 0);
      el.className = "mt-1 text-green-500";
      if (yearEl) {
        yearEl.textContent = `Year: ${new Date(date).getFullYear()}`;
        yearEl.className = "text-xs text-gray-500 dark:text-gray-400";
      }
    }
  };
  if (!hasPrereq) {
    if (lowEl) { lowEl.textContent = "N/A"; lowEl.className = "mt-1"; }
    if (expEl) { expEl.textContent = "N/A"; expEl.className = "mt-1"; }
    if (highEl) { highEl.textContent = "N/A"; highEl.className = "mt-1"; }
    if (lowYearEl) lowYearEl.textContent = "";
    if (expYearEl) expYearEl.textContent = "";
    if (highYearEl) highYearEl.textContent = "";
    if (lowEqEl) lowEqEl.textContent = "";
    if (expEqEl) expEqEl.textContent = "";
    if (highEqEl) highEqEl.textContent = "";
    return;
  }
  const lowV = pv(hits?.low);
  const baseV = pv(hits?.base);
  const highV = pv(hits?.high);
  const lowF = fv(hits?.low);
  const baseF = fv(hits?.base);
  const highF = fv(hits?.high);
  setVal(lowEl, lowYearEl, hits?.low, lowV);
  setVal(expEl, expYearEl, hits?.base, baseV);
  setVal(highEl, highYearEl, hits?.high, highV);
  if (lowEqEl) lowEqEl.textContent = hits?.low ? `Equivalent that year: ${fmtCurrency(lowF || 0)}` : "";
  if (expEqEl) expEqEl.textContent = hits?.base ? `Equivalent that year: ${fmtCurrency(baseF || 0)}` : "";
  if (highEqEl) highEqEl.textContent = hits?.high ? `Equivalent that year: ${fmtCurrency(highF || 0)}` : "";
}

function renderAssetBreakdownChart() {
  const has = assets.length > 0;
  $("assetBreakdownChart").hidden = !has;
  $("noAssetMessage").hidden = has;
  const tableContainer = $("assetBreakdownTableContainer");
  const tableBody = $("assetBreakdownTableBody");
  if (!has) {
    assetBreakdownChart?.destroy();
    assetBreakdownChart = null;
    if (tableContainer) tableContainer.classList.add("hidden");
    if (tableBody) tableBody.innerHTML = "";
    return;
  }

  const colorFor = (i) => `hsl(${(i * 57) % 360},70%,60%)`;
  const rows = assets
    .map((asset) => ({
      name: asset.name,
      value: calculateCurrentValue(asset),
    }))
    .sort((a, b) => b.value - a.value);
  const data = {
    labels: rows.map((r) => r.name),
    datasets: [
      {
        data: rows.map((r) => r.value),
        backgroundColor: rows.map((_, i) => colorFor(i)),
      },
    ],
  };
  const cfg = {
    type: "pie",
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
        tooltip: { callbacks: { label: pieTooltip } },
      },
    },
  };
  assetBreakdownChart = ensureChart(
    assetBreakdownChart,
    $("assetBreakdownChart").getContext("2d"),
    cfg,
  );
  if (tableContainer && tableBody) {
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    tableBody.innerHTML = rows
      .map((row) => {
        const share = total > 0 ? ((row.value / total) * 100).toFixed(2) : "0.00";
        return `<tr class="text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
      <td class="px-6 py-3 whitespace-nowrap">${row.name}</td>
      <td class="px-6 py-3 whitespace-nowrap font-semibold">${fmtCurrency(row.value)}</td>
      <td class="px-6 py-3 whitespace-nowrap">${share}%</td>
    </tr>`;
      })
      .join("");
    tableContainer.classList.toggle("hidden", rows.length === 0);
  }
  updateChartTheme();
}

function updateFuturePortfolioCard() {
  const card = $("futurePortfolioCard");
  if (!card) return;
  const messageEl = $("futurePortfolioMessage");
  const resultEl = $("futurePortfolioResult");
  const totalEl = $("futurePortfolioTotal");
  const noteEl = $("futurePortfolioScenarioNote");
  const tableBody = $("futurePortfolioTableBody");
  const tableContainer = $("futurePortfolioTableContainer");
  const scenarioSelect = $("futurePortfolioScenario");
  const dateInput = $("futurePortfolioDate");
  const eventsActive = !!scenarioEventsEnabled;

  const resetOutputs = (message) => {
    if (futurePortfolioChart) {
      futurePortfolioChart.destroy();
      futurePortfolioChart = null;
    }
    if (tableBody) tableBody.innerHTML = "";
    if (tableContainer) tableContainer.classList.add("hidden");
    if (resultEl) resultEl.classList.add("hidden");
    if (messageEl) {
      if (message) messageEl.textContent = message;
      messageEl.classList.remove("hidden");
    }
  };

  if (!assets.length) {
    resetOutputs(
      "Add an asset to unlock future portfolio projections using your growth scenarios.",
    );
    return;
  }

  const scenarioKey = scenarioSelect?.value || "";
  const dateStr = dateInput?.value;
  if (!scenarioKey || !dateStr) {
    resetOutputs(
      "Select a growth scenario and future date to see the projected breakdown.",
    );
    return;
  }

  const targetDate = new Date(dateStr);
  if (Number.isNaN(targetDate.getTime())) {
    resetOutputs("Enter a valid future date to view projected values.");
    return;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  if (targetDate <= today) {
    resetOutputs("Choose a future date to view projected values.");
    return;
  }

  let scenarios = lastForecastScenarios;
  if (!scenarios || !Array.isArray(scenarios.labels)) {
    scenarios = buildForecastScenarios(null, { includeBreakdown: true });
  } else if (!scenarios.assetDetails) {
    scenarios = buildForecastScenarios(null, { includeBreakdown: true });
  }

  const labels = scenarios?.labels || [];
  const assetDetails = scenarios?.assetDetails || [];
  if (!labels.length || !assetDetails.length) {
    resetOutputs(
      "Add growth assumptions to your assets to unlock projected values.",
    );
    return;
  }

  let index = labels.findIndex((date) => date >= targetDate);
  if (index >= 0) {
    const labelDate = labels[index];
    const labelTime = labelDate?.getTime?.() ?? Number.NaN;
    const targetTime = targetDate.getTime();
    if (
      labelDate &&
      Number.isFinite(labelTime) &&
      labelTime > targetTime &&
      index > 0 &&
      (labelDate.getMonth() !== targetDate.getMonth() ||
        labelDate.getFullYear() !== targetDate.getFullYear())
    ) {
      index -= 1;
    }
  }
  if (index < 0) {
    resetOutputs(
      "Extend your forecast horizon (for example by updating your goal target year) to cover this date.",
    );
    return;
  }

  const rawRows = assetDetails.map((detail) => {
    const values = detail[scenarioKey] || detail.base || [];
    return {
      id: detail.id,
      name: detail.name || "Asset",
      value: values[index] ?? 0,
    };
  });

  const periodStart = index > 0 ? labels[index - 1] : labels[index];
  const periodStartTime = periodStart?.getTime?.();
  const targetTime = targetDate.getTime();
  const valueThreshold = 0.005;
  if (
    eventsActive &&
    Number.isFinite(periodStartTime) &&
    Number.isFinite(targetTime)
  ) {
    const adjustmentsByAsset = new Map();
    const globalEvents = [];
    const activeEvents = scenarioEventsEnabled ? simEvents : [];
    activeEvents.forEach((event) => {
      if (!event || !Number.isFinite(event.date)) return;
      if (event.date < periodStartTime || event.date > targetTime) return;
      if (event.assetId) {
        const list = adjustmentsByAsset.get(event.assetId) || [];
        list.push(event);
        adjustmentsByAsset.set(event.assetId, list);
      } else {
        globalEvents.push(event);
      }
    });
    adjustmentsByAsset.forEach((events) => events.sort((a, b) => a.date - b.date));
    globalEvents.sort((a, b) => a.date - b.date);
    rawRows.forEach((row) => {
      if (!row?.id) return;
      const events = adjustmentsByAsset.get(row.id);
      if (!events || events.length === 0) return;
      let value = row.value;
      events.forEach((evt) => {
        value = evt.isPercent ? value * (1 + evt.amount / 100) : value + evt.amount;
      });
      row.value = value;
    });
    let globalRowValue = 0;
    globalEvents.forEach((evt) => {
      if (evt.isPercent) {
        const factor = 1 + evt.amount / 100;
        rawRows.forEach((row) => {
          row.value *= factor;
        });
        globalRowValue *= factor;
      } else {
        globalRowValue += evt.amount;
      }
    });
    if (Math.abs(globalRowValue) > valueThreshold) {
      rawRows.push({
        id: null,
        name: "Portfolio adjustments",
        value: globalRowValue,
        isGlobal: true,
      });
    }
  }

  const rows = rawRows.filter((row) => Math.abs(row.value) > valueThreshold);
  const sortedRows = rows.sort((a, b) => b.value - a.value);
  if (!sortedRows.length) {
    resetOutputs("No projected asset data is available for this date.");
    return;
  }
  const total = sortedRows.reduce((sum, row) => sum + row.value, 0);
  const chartRows = sortedRows.filter((row) => row.value > 0);
  const palette = (i) => `hsl(${(i * 57) % 360},70%,60%)`;

  if (tableBody) {
    tableBody.innerHTML = sortedRows
      .map((row) => {
        const share =
          total > 0 && row.value >= 0
            ? ((row.value / total) * 100).toFixed(2)
            : "—";
        return `<tr class="text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
      <td class="px-6 py-3 whitespace-nowrap">${row.name}</td>
      <td class="px-6 py-3 whitespace-nowrap font-semibold">${fmtCurrency(row.value)}</td>
      <td class="px-6 py-3 whitespace-nowrap">${share}${share === "—" ? "" : "%"}</td>
    </tr>`;
      })
      .join("");
  }

  if (tableContainer) tableContainer.classList.toggle("hidden", !sortedRows.length);

  if (chartRows.length === 0 && sortedRows.length) {
    const firstPositive = sortedRows.find((row) => row.value > 0);
    if (firstPositive) chartRows.push(firstPositive);
  }
  if (chartRows.length) {
    const data = {
      labels: chartRows.map((row) => row.name),
      datasets: [
        {
          data: chartRows.map((row) => row.value),
          backgroundColor: chartRows.map((_, i) => palette(i)),
        },
      ],
    };
    const cfg = {
      type: "pie",
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" },
          tooltip: { callbacks: { label: pieTooltip } },
        },
      },
    };
    const canvas = $("futurePortfolioChart");
    if (canvas) {
      futurePortfolioChart = ensureChart(
        futurePortfolioChart,
        canvas.getContext("2d"),
        cfg,
      );
      updateChartTheme();
    }
  }

  const formattedDate = targetDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const scenarioLabel = SCENARIO_LABELS[scenarioKey] || SCENARIO_LABELS.base;
  if (messageEl) messageEl.classList.add("hidden");
  if (resultEl) resultEl.classList.remove("hidden");
  if (totalEl) totalEl.textContent = fmtCurrency(total);
  if (noteEl) {
    const baseText = `All values are projected for ${formattedDate} using your ${scenarioLabel} growth scenario.`;
    noteEl.textContent = eventsActive
      ? baseText
      : `${baseText} Scenario Modelling events are currently paused, so one-off adjustments are not included.`;
  }
}

function updateSnapshotChart() {
  const has = snapshots.length > 0;
  $("snapshotChart").hidden = !has;
  $("noSnapshotMessage").hidden = has;
  if (!has) {
    snapshotChart?.destroy();
    snapshotChart = null;
    return;
  }

  const labels = snapshots.map((s) => fmtDate(new Date(s.date)));
  const totals = {};
  snapshots.forEach((s) =>
    s.assets.forEach((a) => {
      totals[a.name] = (totals[a.name] || 0) + a.value;
    }),
  );
  const names = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);

  const colorFor = (i) => `hsl(${(i * 57) % 360},70%,60%)`;
  const datasets = names.map((name, i) => ({
    label: name,
    data: snapshots.map(
      (s) => s.assets.find((a) => a.name === name)?.value || 0,
    ),
    backgroundColor: colorFor(i),
  }));

  const data = { labels, datasets };
  const cfg = {
    type: "bar",
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          stacked: true,
          ticks: { callback: currencyTick },
        },
        x: { stacked: true },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (c) => `${c.dataset.label}: ${fmtCurrency(c.raw)}`,
          },
        },
      },
    },
  };
  snapshotChart = ensureChart(
    snapshotChart,
    $("snapshotChart").getContext("2d"),
    cfg,
  );
  updateChartTheme();
}

function randomNormal(mean = 0, std = 1) {
  const u1 = Math.random();
  const u2 = Math.random();
  const randStdNormal =
    Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * randStdNormal;
}

function generateRandomEvents(labels, assetIdSet = null) {
  if (!assets.length) return [];
  const years = Array.from(new Set(labels.map((d) => d.getFullYear())));
  const events = [];
  const assetList = assetIdSet
    ? assets.filter((a) => assetIdSet.has(a.dateAdded))
    : assets;
  const earliestEventDate = startOfToday() + 24 * 60 * 60 * 1000;

  years.forEach((y) => {
    assetList.forEach((a) => {
      if (Math.random() < 0.3) {
        const m = Math.floor(Math.random() * 12);
        const amt = Math.max(-15, Math.min(15, randomNormal(0, 5)));
        let date = new Date(y, m, 1).getTime();
        if (date < earliestEventDate) {
          date = earliestEventDate;
        }
        events.push({
          name: a.name,
          assetId: a.dateAdded,
          amount: amt,
          isPercent: true,
          date,
        });
      }
    });
  });
  return events;
}

function forecastGoalDate(
  extraEvents = [],
  scenario = "base",
  assetIdSet = null,
) {
  const years = getGoalHorizonYears();
  const labels = getForecastLabels(years);
  const totalMonths = years * 12;
  let base = Array(labels.length).fill(0);
  const nowTs = Date.now();

  const globalEvents = [];
  const eventsByAsset = new Map();
  const assetList = assetIdSet
    ? assets.filter((a) => assetIdSet.has(a.dateAdded))
    : assets;
  const assetIds = new Set(assetList.map((a) => a.dateAdded));
  const taxDetails = computeAssetTaxDetails();
  const taxDetailMap = taxDetails.detailMap;
  const baseEvents = scenarioEventsEnabled ? simEvents : [];
  [...baseEvents, ...extraEvents].forEach((ev) => {
    if (ev.assetId) {
      if (assetIds.has(ev.assetId)) {
        if (!eventsByAsset.has(ev.assetId))
          eventsByAsset.set(ev.assetId, []);
        eventsByAsset.get(ev.assetId).push(ev);
      }
    } else {
      globalEvents.push(ev);
    }
  });

  assetList.forEach((a) => {
    const principal = calculateCurrentValue(a);
    const assetEvents = (eventsByAsset.get(a.dateAdded) || []).sort(
      (x, y) => x.date - y.date,
    );
    let evIdx = 0;
    let v = principal;
    const depositIterator = createDepositIterator(a, nowTs);
    const taxDetail = taxDetailMap.get(a.dateAdded);
    const netRate =
      scenario === "low"
        ? taxDetail?.low?.netRate ?? getGrossRate(a, "low")
        : scenario === "high"
          ? taxDetail?.high?.netRate ?? getGrossRate(a, "high")
          : taxDetail?.base?.netRate ?? getGrossRate(a, "base");
    const r = (netRate || 0) / 100 / 12;
    for (let i = 0; i <= totalMonths; i++) {
      const currentDate = labels[i];
      if (depositIterator) {
        const catchUp = depositIterator.consumeBefore(currentDate.getTime());
        if (catchUp) v += catchUp;
      }
      while (
        evIdx < assetEvents.length &&
        currentDate >= new Date(assetEvents[evIdx].date)
      ) {
        const evt = assetEvents[evIdx];
        v = evt.isPercent ? v * (1 + evt.amount / 100) : v + evt.amount;
        evIdx++;
      }
      base[i] += v;
      if (i < labels.length - 1) {
        v *= 1 + r;
        if (depositIterator) {
          const monthEnd = labels[i + 1].getTime();
          const addition = depositIterator.consumeBefore(monthEnd);
          if (addition) v += addition;
        }
      }
    }
  });

  globalEvents.forEach((ev) => {
    const d = new Date(ev.date);
    const idx = labels.findIndex((label) => label >= d);
    if (idx >= 0) {
      if (ev.isPercent) {
        const factor = 1 + ev.amount / 100;
        for (let i = idx; i <= totalMonths; i++) base[i] *= factor;
      } else {
        for (let i = idx; i <= totalMonths; i++) base[i] += ev.amount;
      }
    }
  });

  const hitIdx = base.findIndex((v) => v >= goalValue);
  return { hitDate: hitIdx >= 0 ? labels[hitIdx] : null };
}

function runStressTest(iterations, scenario, assetIds) {
  const years = getGoalHorizonYears();
  const labels = getForecastLabels(years);
  const idSet = new Set(assetIds);
  const baseline = forecastGoalDate([], scenario, idSet).hitDate;
  const results = [];
  let sample = null;
  for (let i = 0; i < iterations; i++) {
    const randomEvents = generateRandomEvents(labels, idSet);
    const { hitDate } = forecastGoalDate(randomEvents, scenario, idSet);
    results.push(hitDate);
    if (!sample) sample = { events: randomEvents, hitDate };
  }
  const reached = results.filter((d) => !!d).sort((a, b) => a - b);
  const pct = results.length
    ? (reached.length / results.length) * 100
    : 0;
  const median = reached.length
    ? reached[Math.floor(reached.length / 2)]
    : null;
  return {
    baseline,
    pct,
    earliest: reached[0] || null,
    median,
    latest: reached[reached.length - 1] || null,
    sample,
  };
}

function navigateTo(viewId, options = {}) {
  const { expandCards = false } = options;
  if (viewId === "forecasts" && assets.length === 0 && liabilities.length === 0) {
    showAlert(
      "Add at least one asset or liability to unlock Forecasts. Set a wealth goal to enable goal-specific insights."
    );
    viewId = "data-entry";
  }
  if (viewId === "portfolio-analysis" && assets.length === 0) {
    showAlert("Add at least one asset to view Portfolio Insights.");
    viewId = "data-entry";
  }
  if (
    viewId === "snapshots" &&
    !(assets.length || liabilities.length || snapshots.length)
  ) {
    showAlert("Add some financial data before using Snapshots.");
    viewId = "data-entry";
  }
  document
    .querySelectorAll("nav button")
    .forEach((b) => b.classList.remove("active-nav-button"));
  const navButton = document.querySelector(
    `nav button[data-target="${viewId}"]`,
  );
  if (navButton) navButton.classList.add("active-nav-button");
  document
    .querySelectorAll(".content-section")
    .forEach((s) => s.classList.remove("active"));
  const section = $(viewId);
  if (!section) return;
  section.classList.add("active");
  try {
    localStorage.setItem(LS.view, viewId);
  } catch (_) {}
  if (expandCards) {
    expandSectionCards(section);
  }
  if (viewId === "portfolio-analysis") {
    renderAssetBreakdownChart();
  }
  if (viewId === "snapshots") {
    updateSnapshotChart();
  }

  // One-off onboarding when arriving to Financial Inputs after "Start Now"
  if (viewId === "data-entry") {
    try {
      const pending = localStorage.getItem(LS.onboardPending) === "1";
      const seen = localStorage.getItem(LS.onboardSeen) === "1";
      const firstTimeHidden = isFirstTimeContentHidden();
      // Show onboarding if user explicitly asked (pending) OR hasn't seen it before
      if (!firstTimeHidden && (pending || !seen)) {
        const tpl = document.importNode(
          $("tpl-onboard-data").content,
          true,
        );
        openModalNode(tpl);
        localStorage.setItem(LS.onboardPending, "0");
        localStorage.setItem(LS.onboardSeen, "1");
      } else {
        if (pending) localStorage.setItem(LS.onboardPending, "0");
        if (!seen) localStorage.setItem(LS.onboardSeen, "1");
      }
    } catch (_) {}
    // Keep empty states fresh when navigating back to Financial Inputs
    updateEmptyStates();
  } else if (viewId === "forecasts") {
    updateEmptyStates();
    try {
      const seen = localStorage.getItem(LS.forecastTip) === "1";
      if (!seen && !isFirstTimeContentHidden()) {
        const tpl = document.importNode(
          $("tpl-onboard-forecast").content,
          true,
        );
        openModalNode(tpl);
        localStorage.setItem(LS.forecastTip, "1");
      } else if (!seen) {
        localStorage.setItem(LS.forecastTip, "1");
      }
    } catch (_) {}
  }

  // Hide Start Now on welcome if user already has assets
  if (viewId === "welcome") {
    const hasAssets = assets && assets.length > 0;
    const btn = $("startNowBtn");
    if (btn) btn.classList.toggle("hidden", !!hasAssets);
  }

  if (viewId === "settings") {
    const sel = document.getElementById("themeSelect");
    if (sel) sel.value = currentThemeChoice;
  }

  // Ensure Inflation Impact card only shows on Portfolio Insights
  const inflCard = $("inflationImpactCard");
  if (inflCard)
    inflCard.style.display = viewId === "portfolio-analysis" ? "" : "none";
}

// Collapse/expand cards by clicking their headers
function setupCardCollapsing() {
  const sanitize = (s) =>
    (s || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  document
    .querySelectorAll(
      "#data-entry .card, #forecasts .card, #portfolio-analysis .card, #snapshots .card, #calculators .card, #settings .card",
    )
    .forEach((card, idx) => {
      card.classList.add("is-collapsible");
      const header = card.querySelector("h3, h4");
      if (!header) return;
      if (card.dataset.collapseInit === "1") return;
      card.dataset.collapseInit = "1";

      // Wrap body content to enable height animation
      let body = card.querySelector(".card-body");
      if (!body) {
        body = document.createElement("div");
        body.className = "card-body";
        const frag = document.createDocumentFragment();
        let node = header.nextSibling;
        while (node) {
          const next = node.nextSibling;
          frag.appendChild(node);
          node = next;
        }
        body.appendChild(frag);
        card.appendChild(body);
      }

      // Ensure a stable id to persist collapse state
      const title = header.textContent || `card-${idx + 1}`;
      const baseId = card.id
        ? `id:${card.id}`
        : `title:${sanitize(title)}`;
      const key = storageKey(`cardCollapsed:${baseId}`);
      card.dataset.collapseKey = key;

      // Inject chevron if not present
      if (!header.querySelector(".chev")) {
        const chev = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        chev.setAttribute("viewBox", "0 0 24 24");
        chev.setAttribute("width", "20");
        chev.setAttribute("height", "20");
        chev.classList.add("chev");
        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        path.setAttribute("d", "M8 10l4 4 4-4");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "2");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        chev.appendChild(path);
        header.appendChild(chev);
      }

      header.setAttribute("role", "button");
      header.setAttribute("tabindex", "0");

      const setInitialState = () => {
        let storedState = null;
        try {
          storedState = localStorage.getItem(key);
        } catch (_) {}
        const hasStoredPreference = storedState === "0" || storedState === "1";
        const collapsed = hasStoredPreference
          ? storedState === "1"
          : COLLAPSE_CARDS_BY_DEFAULT;
        header.setAttribute("aria-expanded", collapsed ? "false" : "true");
        body.setAttribute("aria-hidden", collapsed ? "true" : "false");
        if (collapsed) {
          card.classList.add("collapsed");
          body.style.height = "0px";
          body.style.opacity = "0";
          body.style.display = "none";
        } else {
          card.classList.remove("collapsed");
          body.style.display = "block";
          body.style.height = "auto";
          body.style.opacity = "1";
        }
      };
      setInitialState();

      const expand = () => {
        if (body._wtCollapseListener) {
          body.removeEventListener("transitionend", body._wtCollapseListener);
          body._wtCollapseListener = null;
        }
        if (body._wtCollapseTimer) {
          clearTimeout(body._wtCollapseTimer);
          body._wtCollapseTimer = null;
        }
        card.classList.remove("collapsed");
        body.style.display = "block";
        body.setAttribute("aria-hidden", "false");
        // measure target height
        body.style.height = "auto";
        const target = body.scrollHeight;
        body.style.height = "0px";
        body.style.opacity = "0";
        // reflow
        void body.offsetHeight;
        body.style.height = `${target}px`;
        body.style.opacity = "1";
        const onEnd = (e) => {
          if (e.propertyName === "height") {
            body.style.height = "auto";
            body.removeEventListener("transitionend", onEnd);
          }
        };
        body.addEventListener("transitionend", onEnd);
      };
      const collapse = () => {
        if (body._wtCollapseListener) {
          body.removeEventListener("transitionend", body._wtCollapseListener);
          body._wtCollapseListener = null;
        }
        if (body._wtCollapseTimer) {
          clearTimeout(body._wtCollapseTimer);
          body._wtCollapseTimer = null;
        }
        body.style.display = "block";
        if (
          getComputedStyle(body).height === "auto" ||
          body.style.height === "" ||
          body.style.height === "auto"
        ) {
          body.style.height = `${body.scrollHeight}px`;
          void body.offsetHeight;
        }
        body.style.height = "0px";
        body.style.opacity = "0";
        body.setAttribute("aria-hidden", "true");
        const finish = (e) => {
          if (e.propertyName === "height") {
            body.style.display = "none";
            body.removeEventListener("transitionend", finish);
            body._wtCollapseListener = null;
            if (body._wtCollapseTimer) {
              clearTimeout(body._wtCollapseTimer);
              body._wtCollapseTimer = null;
            }
          }
        };
        body._wtCollapseListener = finish;
        body.addEventListener("transitionend", finish);
        body._wtCollapseTimer = setTimeout(() => {
          body.style.display = "none";
          if (body._wtCollapseListener) {
            body.removeEventListener("transitionend", body._wtCollapseListener);
            body._wtCollapseListener = null;
          }
          body._wtCollapseTimer = null;
        }, 350);
        card.classList.add("collapsed");
      };
      const toggle = () => {
        const nowCollapsed = !card.classList.contains("collapsed");
        if (nowCollapsed) {
          collapse();
          localStorage.setItem(key, "1");
          header.setAttribute("aria-expanded", "false");
        } else {
          expand();
          localStorage.setItem(key, "0");
          header.setAttribute("aria-expanded", "true");
        }
      };

      card._wtExpandWithoutPersist = () => {
        if (!card.classList.contains("collapsed")) return;
        expand();
        header.setAttribute("aria-expanded", "true");
      };

      header.addEventListener("click", toggle);
      header.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });
}

function expandSectionCards(section) {
  if (!section) return;
  section
    .querySelectorAll(".card.is-collapsible")
    .forEach((card) => {
      if (!card.classList.contains("collapsed")) return;
      const key = card.dataset.collapseKey;
      let hasStoredPreference = false;
      if (key) {
        try {
          const stored = localStorage.getItem(key);
          hasStoredPreference = stored === "0" || stored === "1";
        } catch (_) {}
      }
      if (hasStoredPreference) return;
      if (typeof card._wtExpandWithoutPersist === "function") {
        card._wtExpandWithoutPersist();
        return;
      }
      const header = card.querySelector("h3, h4");
      if (header) {
        header.dispatchEvent(new Event("click", { bubbles: true }));
      }
    });
}

// Resize sidebar brand logo to match title width (desktop)
function sizeBrandLogo() {
  const logo = $("brandLogo");
  const title = $("brandTitle");
  if (!logo || !title) return;
  try {
    const rect = title.getBoundingClientRect();
    const measuredWidth = rect && Number.isFinite(rect.width) ? rect.width : 0;
    const w =
      measuredWidth || title.offsetWidth || title.scrollWidth || logo.offsetWidth || 0;
    logo.style.height = "auto";
    if (w > 0) {
      logo.style.width = w + "px";
    } else {
      logo.style.removeProperty("width");
    }
    logo.style.marginBottom = "4px";
  } catch (_) {}
}

function parseCssNumber(value, fallback = 0) {
  if (typeof value !== "string") return fallback;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeAppVersion(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^v/i, "");
}

function toAppVersionParts(value) {
  if (typeof value !== "string") return [];
  return value
    .split(/[.-]/)
    .filter((part) => part.length > 0)
    .map((part) => {
      const num = Number(part);
      return Number.isFinite(num) ? num : part.toLowerCase();
    });
}

function compareAppVersions(a, b) {
  if (a === b) return 0;
  if (!a) return b ? -1 : 0;
  if (!b) return a ? 1 : 0;
  const partsA = toAppVersionParts(a);
  const partsB = toAppVersionParts(b);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i += 1) {
    const partA = partsA[i] ?? 0;
    const partB = partsB[i] ?? 0;
    if (partA === partB) continue;
    if (typeof partA === "number" && typeof partB === "number") {
      return partA < partB ? -1 : 1;
    }
    const strA = String(partA);
    const strB = String(partB);
    if (strA === strB) continue;
    return strA < strB ? -1 : 1;
  }
  return 0;
}

let controllerAppVersionCache = null;
let controllerAppVersionRequest = null;

function updateControllerAppVersionCache(value) {
  const normalized = normalizeAppVersion(value);
  if (!normalized) return null;
  controllerAppVersionCache = normalized;
  return controllerAppVersionCache;
}

async function requestControllerAppVersion(timeoutMs = 3000) {
  if (!("serviceWorker" in navigator)) return null;
  const controller = navigator.serviceWorker.controller;
  if (!controller) return null;
  try {
    return await new Promise((resolve) => {
      const channel = new MessageChannel();
      let settled = false;
      const finalize = (value) => {
        if (settled) return;
        settled = true;
        try {
          channel.port1.onmessage = null;
        } catch (_) {
          /* ignore */
        }
        try {
          channel.port1.close();
        } catch (_) {
          /* ignore */
        }
        try {
          channel.port2.close();
        } catch (_) {
          /* ignore */
        }
        const cached = updateControllerAppVersionCache(value);
        resolve(cached || null);
      };
      const timeoutId = setTimeout(() => finalize(null), Math.max(0, timeoutMs || 0));
      channel.port1.onmessage = (event) => {
        clearTimeout(timeoutId);
        const { data } = event || {};
        if (
          data &&
          data.type === "VERSION" &&
          typeof data.version === "string"
        ) {
          finalize(data.version);
        } else {
          finalize(null);
        }
      };
      try {
        if (typeof channel.port1.start === "function") {
          channel.port1.start();
        }
      } catch (_) {
        /* ignore */
      }
      try {
        controller.postMessage({ type: "GET_VERSION" }, [channel.port2]);
      } catch (_) {
        clearTimeout(timeoutId);
        finalize(null);
      }
    });
  } catch (_) {
    return null;
  }
}

function getControllerVersionFromServiceWorker({ refresh = false } = {}) {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  if (!refresh) {
    if (controllerAppVersionCache) return Promise.resolve(controllerAppVersionCache);
    if (controllerAppVersionRequest) return controllerAppVersionRequest;
  }
  controllerAppVersionRequest = requestControllerAppVersion().then((version) => {
    controllerAppVersionRequest = null;
    return version ?? controllerAppVersionCache;
  });
  return controllerAppVersionRequest;
}

if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  try {
    navigator.serviceWorker.addEventListener("message", (event) => {
      const { data } = event || {};
      if (
        data &&
        data.type === "VERSION" &&
        typeof data.version === "string"
      ) {
        updateControllerAppVersionCache(data.version);
      }
    });
  } catch (_) {
    /* ignore */
  }
}

async function fetchChangelogEntries() {
  let response;
  try {
    response = await fetch("assets/changelog.json", {
      cache: "no-store",
    });
  } catch (error) {
    console.error("Failed to request changelog entries", error);
    throw error;
  }
  if (!response || !response.ok) {
    throw new Error(
      `Unexpected changelog response status: ${response ? response.status : "no-response"}`,
    );
  }
  const contentType = (response.headers?.get("content-type") || "").toLowerCase();
  if (!contentType.includes("json")) {
    throw new Error(
      `Changelog response was not JSON (content-type: ${contentType || "unknown"})`,
    );
  }
  let data;
  try {
    data = await response.json();
  } catch (error) {
    console.error("Failed to parse changelog entries", error);
    throw error;
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((entry) => {
      if (!entry || typeof entry.version !== "string") return null;
      const version = normalizeAppVersion(entry.version);
      if (!version) return null;
      const changes = Array.isArray(entry.changes)
        ? entry.changes
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean)
        : [];
      if (!changes.length) return null;
      const date =
        typeof entry.date === "string" && entry.date.trim().length
          ? entry.date.trim()
          : null;
      return { version, changes, date };
    })
    .filter(Boolean);
}

function filterChangelogForUpdate(entries, previousVersion, latestVersion) {
  if (!Array.isArray(entries) || !latestVersion) return [];
  return entries
    .filter((entry) => {
      if (!entry || !entry.version) return false;
      if (compareAppVersions(entry.version, latestVersion) === 1) return false;
      if (
        previousVersion &&
        compareAppVersions(entry.version, previousVersion) <= 0
      )
        return false;
      return Array.isArray(entry.changes) && entry.changes.length > 0;
    })
    .sort((a, b) => compareAppVersions(b.version, a.version));
}

function formatChangelogDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  try {
    return parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (_) {
    return parsed.toLocaleDateString();
  }
}

function readSafeAreaTop() {
  if (!document?.body) return 0;
  try {
    const computed = getComputedStyle(document.body);
    const raw = computed.getPropertyValue("--mobile-safe-area-top");
    return parseCssNumber(raw, 0);
  } catch (_) {
    return 0;
  }
}

function updateMobileHeaderOffset() {
  const body = document.body;
  if (!body) return;
  const header = document.getElementById("mobileHeader");
  const rect = header ? header.getBoundingClientRect() : null;
  const height = Math.max(0, rect?.height || header?.offsetHeight || 0);
  const safeAreaTop = readSafeAreaTop();
  body.style.setProperty("--mobile-header-height", `${height}px`);
  const offset = isMobileNavSticky ? Math.max(0, height + safeAreaTop) : 0;
  body.style.setProperty("--mobile-header-offset", `${offset}px`);
}

function setupMobileHeaderOffsetWatcher() {
  updateMobileHeaderOffset();
  const header = document.getElementById("mobileHeader");
  if (!header || typeof ResizeObserver !== "function") return;
  try {
    if (mobileHeaderResizeObserver) mobileHeaderResizeObserver.disconnect();
    mobileHeaderResizeObserver = new ResizeObserver(() => {
      updateMobileHeaderOffset();
    });
    mobileHeaderResizeObserver.observe(header);
  } catch (_) {}
}

// --- Events and init ---
function handleFormSubmit(e) {
  e.preventDefault();
  let form = e.currentTarget;
  if (!(form instanceof HTMLFormElement)) {
    if (e.target instanceof HTMLFormElement) form = e.target;
    else if (e.target?.closest) form = e.target.closest("form");
    else form = null;
  }
  if (!form) return;
  switch (form.id) {
    case "assetForm": {
      const newAsset = {
        name: form.assetName.value,
        value: parseFloat(form.assetValue.value),
        originalDeposit: parseFloat(form.depositAmount.value) || 0,
        frequency: form.depositFrequency.value,
        dateAdded: Date.now(),
      };
      newAsset.depositDay = DEFAULT_DEPOSIT_DAY;
      const ret = parseFloat(form.assetReturn.value) || 0;
      newAsset.return = ret;
      newAsset.lowGrowth = parseFloat(form.lowGrowth.value) || ret;
      newAsset.highGrowth = parseFloat(form.highGrowth.value) || ret;
      newAsset.monthlyDeposit = monthlyFrom(
        newAsset.frequency,
        newAsset.originalDeposit,
      );
      const explicitAssetStart = toTimestamp(form.assetStartDate?.value);
      newAsset.explicitStartDate = explicitAssetStart;
      newAsset.startDate = explicitAssetStart ?? startOfToday();
      newAsset.includeInPassive = form.includePassive
        ? !!form.includePassive.checked
        : true;
      newAsset.taxTreatment = normalizeTaxTreatment(
        form.assetTaxTreatment?.value,
      );
      assets.push(newAsset);
      invalidateTaxCache();
      renderAssets();
      updateWealthChart();
      updateEmptyStates();
      form.reset();
      break;
    }
    case "incomeForm": {
      const newIncome = {
        name: form.incomeName.value,
        amount: parseFloat(form.incomeAmount.value) || 0,
        frequency: form.incomeFrequency.value,
        dateAdded: Date.now(),
      };
      const explicitIncomeStart = toTimestamp(form.incomeStartDate?.value);
      newIncome.explicitStartDate = explicitIncomeStart;
      newIncome.startDate = explicitIncomeStart ?? startOfToday();
      newIncome.monthlyAmount = monthlyFrom(
        newIncome.frequency,
        newIncome.amount,
      );
      incomes.push(newIncome);
      renderIncomes();
      updateWealthChart();
      updateEmptyStates();
      form.reset();
      if (form.incomeFrequency) form.incomeFrequency.value = "monthly";
      break;
    }
    case "liabilityForm": {
      const newLiab = {
        name: form.liabilityName.value,
        value: parseFloat(form.liabilityValue.value) || 0,
        interest: parseFloat(form.liabilityInterest.value) || 0,
        originalPayment:
          parseFloat(form.liabilityPaymentAmount.value) || 0,
        frequency: form.liabilityPaymentFrequency.value,
        dateAdded: Date.now(),
      };
      newLiab.monthlyPayment = monthlyFrom(
        newLiab.frequency,
        newLiab.originalPayment,
      );
      const explicitLiabStart = toTimestamp(form.liabilityStartDate?.value);
      newLiab.explicitStartDate = explicitLiabStart;
      newLiab.startDate = explicitLiabStart ?? startOfToday();
      liabilities.push(newLiab);
      renderLiabilities();
      updateWealthChart();
      updateEmptyStates();
      form.reset();
      break;
    }
    case "eventForm": {
      const direction = form.eventDirection?.value === "loss" ? "loss" : "gain";
      const rawAmount = parseFloat(form.eventAmount.value);
      const normalizedAmount = Number.isFinite(rawAmount)
        ? Math.abs(rawAmount)
        : NaN;
      const ev = {
        name: form.eventName.value,
        amount:
          direction === "loss" ? -normalizedAmount : normalizedAmount,
        isPercent: form.eventType.value === "percent",
        date: new Date(form.eventDate.value).getTime(),
      };
      const assetId = form.eventAsset.value;
      if (assetId) ev.assetId = Number(assetId);
      if (!ev.name || !Number.isFinite(ev.amount) || !ev.date) return;
      simEvents.push(ev);
      simEvents.sort((a, b) => a.date - b.date);
      renderEvents();
      updateEmptyStates();
      form.reset();
      if (form.eventDirection) form.eventDirection.value = "gain";
      break;
    }
    case "fireForm": {
      const amount = parseFloat(form.fireLivingExpenses.value);
      const frequency =
        form.fireExpensesFrequency.value === "monthly"
          ? "monthly"
          : "annual";
      const rate = parseFloat(form.fireWithdrawalRate.value);
      if (!(amount > 0)) {
        showAlert(
          "Enter your living costs to calculate your FIRE target.",
        );
        break;
      }
      if (!(rate > 0)) {
        showAlert("Safe withdrawal rate must be greater than zero.");
        break;
      }
      const annualExpenses =
        frequency === "monthly" ? amount * 12 : amount;
      fireExpenses = annualExpenses;
      fireExpensesFrequency = frequency;
      fireWithdrawalRate = rate;
      fireLastInputs = {
        annualExpenses,
        withdrawalRate: fireWithdrawalRate,
      };
      updateFireFormInputs();
      persist();
      refreshFireProjection();
      break;
    }
    case "fireForecastForm": {
      const amount = parseFloat(form.fireForecastLivingCosts.value);
      const frequency =
        form.fireForecastFrequency.value === "monthly"
          ? "monthly"
          : "annual";
      if (!(amount > 0)) {
        showAlert(
          "Enter your living costs to project your FIRE readiness.",
        );
        break;
      }
      const annual = frequency === "monthly" ? amount * 12 : amount;
      const inflationVal = parseFloat(form.fireForecastInflation.value);
      const inflation = isFinite(inflationVal)
        ? Math.max(0, inflationVal)
        : fireForecastInflation;
      const retireInput = form.fireForecastRetireDate.value;
      let retireTs = null;
      if (retireInput) {
        const parts = retireInput.split("-");
        if (parts.length === 3) {
          const [year, month, day] = parts.map(Number);
          if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
            const retireDate = new Date(year, month - 1, day);
            retireDate.setHours(0, 0, 0, 0);
            if (!Number.isNaN(retireDate.getTime())) {
              retireTs = retireDate.getTime();
            }
          }
        }
      }
      fireForecastCosts = annual;
      fireForecastFrequency = frequency;
      fireForecastInflation = inflation;
      fireForecastRetireDate = retireTs;
      updateFireForecastInputs();
      persist();
      updateFireForecastCard();
      break;
    }
    case "stressTestForm": {
      const runsInput = document.getElementById("stressRuns");
      const scenarioSelect = document.getElementById("stressScenario");
      let runs = Number.parseInt(runsInput?.value ?? "", 10);
      if (!Number.isFinite(runs) || runs <= 0) runs = 100;
      if (runs > 1000) runs = 1000;
      const scenario = scenarioSelect?.value || "base";
      if (!canRunStressTest()) {
        updateEmptyStates();
        break;
      }
      if (!stressAssetIds.size) {
        assets.forEach((a) => stressAssetIds.add(a.dateAdded));
        renderStressAssetOptions();
      }
      const selected = [...stressAssetIds];
      if (selected.length === 0) {
        const target = $("stressTestResult");
        if (target)
          target.innerHTML =
            '<p class="text-red-600">Select at least one asset for the stress test.</p>';
        break;
      }
      const res = runStressTest(runs, scenario, selected);
      const fmt = (d) => {
        if (d)
          return d.toLocaleString("default", {
            month: "short",
            year: "numeric",
          });
        const y = getGoalTargetYear();
        return y ? `Not met by ${y}` : "Not met in 30 years";
      };
      const cls = (d) => (d ? "text-green-500" : "text-red-600");
      const horizonText = (() => {
        const y = getGoalTargetYear();
        return y ? `by ${y}` : "within 30 years";
      })();
      let html = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="md:col-span-3 text-left text-sm text-gray-600 dark:text-gray-300">
        <strong>${res.pct.toFixed(0)}% of simulations reached the goal ${horizonText}</strong>
      </div>
      <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-center stat-box">
        <h5 class="font-bold text-gray-900 dark:text-gray-100">Earliest</h5>
        <p class="${cls(res.earliest)}">${fmt(res.earliest)}</p>
      </div>
      <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-center stat-box">
        <h5 class="font-bold text-gray-900 dark:text-gray-100">Median</h5>
        <p class="${cls(res.median)}">${fmt(res.median)}</p>
      </div>
      <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-center stat-box">
        <h5 class="font-bold text-gray-900 dark:text-gray-100">Latest</h5>
        <p class="${cls(res.latest)}">${fmt(res.latest)}</p>
      </div>
    </div>`;
      stressSampleEvents = res.sample.events;
      stressSort = { key: "date", dir: "asc" };
      html += `<div id="stressEventsCard" class="card is-collapsible collapsed mt-4">
      <h4 class="text-md font-medium text-gray-900 dark:text-gray-100">Sample events</h4>
      <div class="card-body">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-left">
            <thead id="stressEventsTableHeader" class="bg-gray-200 dark:bg-gray-700"></thead>
            <tbody id="stressEventsTableBody" class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"></tbody>
          </table>
        </div>
      </div>
    </div>`;
      const resEl = $("stressTestResult");
      if (resEl) {
        resEl.className = "mt-4 text-sm";
        resEl.innerHTML = html;
      }
      buildStressHeader();
      renderStressEvents();
      setupCardCollapsing();
      break;
    }
    case "taxImpactForm": {
      const resultEl = $("taxCalculatorResult");
      if (!resultEl) break;
      const scenario = form.taxScenario.value || "base";
      const scenarioText =
        scenario === "low"
          ? "Low growth scenario"
          : scenario === "high"
            ? "High growth scenario"
            : "Expected growth scenario";
      const assetId = form.taxAssetSelect.value;
      const band = getTaxBandConfig(taxSettings.band);
      const metaFromTreatment = (treatment) => getTaxTreatmentMeta(treatment);

      if (assetId) {
        const asset = assets.find((a) => String(a.dateAdded) === assetId);
        if (!asset) {
          resultEl.innerHTML =
            '<p class="text-sm text-red-600">Selected asset could not be found. Please choose another asset.</p>';
          break;
        }
        const taxDetails = computeAssetTaxDetails();
        const detail = taxDetails.detailMap.get(asset.dateAdded);
        const scenarioDetail =
          (detail && detail[scenario]) || detail?.base || detail?.expected;
        const grossRate = scenarioDetail?.grossRate ?? getGrossRate(asset, "base");
        const netRate = scenarioDetail?.netRate ?? grossRate;
        const annualGross = scenarioDetail?.annualGross ?? 0;
        const annualTax = scenarioDetail?.annualTax ?? 0;
        const taxableAmount = scenarioDetail?.taxableAmount ?? 0;
        const allowanceCovered = scenarioDetail?.allowanceShare ?? 0;
        const value = calculateCurrentValue(asset);
        const netAmount = annualGross - annualTax;
        const meta = metaFromTreatment(asset.taxTreatment);
        const totals =
          meta?.totalsKey
            ? taxDetails.totals[scenario]?.[meta.totalsKey] || null
            : null;
        const allowanceNote = (() => {
          if (!meta?.totalsKey || !totals) return meta?.info || "";
          const covered = totals.allowanceCovered || 0;
          const taxable = totals.taxable || 0;
          return `Across all assets taxed as ${meta.allowanceLabel}, projected returns total ${fmtCurrency(
            totals.total,
          )}. Your allowance covers ${fmtCurrency(covered)}, leaving ${fmtCurrency(
            taxable,
          )} taxable at ${formatPercent(totals.taxRate)}.`;
        })();
        resultEl.innerHTML = `
        <div class="rounded-lg bg-gray-100 dark:bg-gray-700 p-4 text-gray-700 dark:text-gray-200">
          <h4 class="text-lg font-semibold mb-1">Estimated tax due: ${fmtCurrency(Math.max(0, annualTax))}</h4>
          <p class="text-sm">${scenarioText} using ${formatPercent(grossRate)} growth on ${fmtCurrency(value)}.</p>
          <div class="mt-3 overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm text-left">
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr><th class="px-4 py-2 font-medium">Gross return</th><td class="px-4 py-2">${fmtCurrency(annualGross)}</td></tr>
                <tr><th class="px-4 py-2 font-medium">Allowance used</th><td class="px-4 py-2">${fmtCurrency(
                  Math.max(0, allowanceCovered),
                )}</td></tr>
                <tr><th class="px-4 py-2 font-medium">Taxable amount</th><td class="px-4 py-2">${fmtCurrency(
                  Math.max(0, taxableAmount),
                )}</td></tr>
                <tr><th class="px-4 py-2 font-medium">Tax rate</th><td class="px-4 py-2">${formatPercent(
                  scenarioDetail?.taxRateApplied ?? band.incomeRate,
                )}</td></tr>
                <tr><th class="px-4 py-2 font-medium">Tax due</th><td class="px-4 py-2 font-semibold">${fmtCurrency(
                  Math.max(0, annualTax),
                )}</td></tr>
                <tr><th class="px-4 py-2 font-medium">Net return</th><td class="px-4 py-2">${fmtCurrency(
                  netAmount,
                )} (${formatPercent(netRate)} net)</td></tr>
              </tbody>
            </table>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-3">${allowanceNote}</p>
        </div>`;
        break;
      }

      const rawValue = parseFloat(form.taxAssetValue.value);
      if (!(rawValue > 0)) {
        resultEl.innerHTML =
          '<p class="text-sm text-red-600">Enter the asset value you want to analyse.</p>';
        break;
      }
      const grossRate = parseFloat(form.taxAssetReturn.value) || 0;
      const treatment = normalizeTaxTreatment(form.taxAssetTreatment.value);
      const meta = metaFromTreatment(treatment);
      const grossAmount = rawValue * (grossRate / 100);
      const allowance = meta?.allowanceSetting
        ? toNonNegativeNumber(taxSettings[meta.allowanceSetting], 0)
        : 0;
      const taxableAmount =
        meta?.allowanceKey && grossAmount > 0
          ? Math.max(0, grossAmount - allowance)
          : 0;
      const allowanceCovered = grossAmount - taxableAmount;
      const taxRate = meta?.rateKey ? band[meta.rateKey] || 0 : 0;
      const annualTax = taxableAmount * (taxRate / 100);
      const netAmount = grossAmount - annualTax;
      const netRate = rawValue > 0 ? (netAmount / rawValue) * 100 : grossRate;
      const manualNote = meta?.totalsKey
        ? `Assumes your full ${meta.allowanceLabel} of ${fmtCurrency(
            allowance,
          )} is available for this asset and taxed at ${formatPercent(taxRate)} after the allowance.`
        : meta?.info || "No UK tax applies to this treatment.";
      resultEl.innerHTML = `
        <div class="rounded-lg bg-gray-100 dark:bg-gray-700 p-4 text-gray-700 dark:text-gray-200">
          <h4 class="text-lg font-semibold mb-1">Estimated tax due: ${fmtCurrency(Math.max(0, annualTax))}</h4>
          <p class="text-sm">${scenarioText} using ${formatPercent(grossRate)} growth on ${fmtCurrency(rawValue)}.</p>
          <div class="mt-3 overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm text-left">
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr><th class="px-4 py-2 font-medium">Gross return</th><td class="px-4 py-2">${fmtCurrency(grossAmount)}</td></tr>
                <tr><th class="px-4 py-2 font-medium">Allowance used</th><td class="px-4 py-2">${fmtCurrency(
                  Math.max(0, allowanceCovered),
                )}</td></tr>
                <tr><th class="px-4 py-2 font-medium">Taxable amount</th><td class="px-4 py-2">${fmtCurrency(
                  Math.max(0, taxableAmount),
                )}</td></tr>
                <tr><th class="px-4 py-2 font-medium">Tax rate</th><td class="px-4 py-2">${formatPercent(taxRate)}</td></tr>
                <tr><th class="px-4 py-2 font-medium">Tax due</th><td class="px-4 py-2 font-semibold">${fmtCurrency(
                  Math.max(0, annualTax),
                )}</td></tr>
                <tr><th class="px-4 py-2 font-medium">Net return</th><td class="px-4 py-2">${fmtCurrency(
                  netAmount,
                )} (${formatPercent(netRate)} net)</td></tr>
              </tbody>
            </table>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-3">${manualNote}</p>
        </div>`;
      break;
    }
    case "takeHomePayForm": {
      const resultEl = $("takeHomeResult");
      if (!resultEl) break;
      const incomeInput = form["take-home-income"];
      const freqInput = form["take-home-frequency"];
      const taxYearInput = form["take-home-tax-year"];
      const taxCodeInput = form["take-home-tax-code"];
      const sacrificeInput = form["take-home-sacrifice"];
      const sacrificeTypeInput = form["take-home-sacrifice-type"];
      const pensionMethodInput = form["take-home-pension-method"];
      const studentLoanInput = form["take-home-student-loan"];
      const incomeValue = parseFloat(incomeInput?.value);
      if (!(incomeValue > 0)) {
        resultEl.innerHTML =
          '<p class="text-sm text-red-600">Enter your income to estimate take home pay.</p>';
        break;
      }
      const taxYearCfg = getTaxYearConfig(taxYearInput?.value);
      const frequency =
        freqInput?.value === "monthly" || freqInput?.value === "annual"
          ? freqInput.value
          : "annual";
      const annualIncome = frequency === "monthly" ? incomeValue * 12 : incomeValue;
      const sacrificeRaw = Number.parseFloat(sacrificeInput?.value);
      const sacrificeType = sacrificeTypeInput?.value === "percent" ? "percent" : "amount";
      const contributionMethod = pensionMethodInput?.value === "relief" ? "relief" : "sacrifice";
      const pensionGrossContribution = (() => {
        const normalized = Number.isFinite(sacrificeRaw) && sacrificeRaw > 0 ? sacrificeRaw : 0;
        if (!normalized) return 0;
        const base =
          sacrificeType === "percent" ? (annualIncome * Math.min(normalized, 100)) / 100 : normalized;
        return Math.min(annualIncome, base);
      })();
      const grossAfterPension =
        contributionMethod === "sacrifice"
          ? Math.max(0, annualIncome - pensionGrossContribution)
          : annualIncome;
      const reliefTopUp =
        contributionMethod === "relief" ? pensionGrossContribution * BASIC_RELIEF_RATE : 0;
      const netPensionOutflow =
        contributionMethod === "relief"
          ? pensionGrossContribution - reliefTopUp
          : pensionGrossContribution;
      const taxCode = (taxCodeInput?.value || "1257L").trim();
      const personalAllowance = calculatePersonalAllowance(taxCode, grossAfterPension);
      const taxableIncome = Math.max(0, grossAfterPension - personalAllowance);
      const incomeTax = calculateUkIncomeTax(grossAfterPension, personalAllowance, taxYearCfg);
      const nationalInsurance = calculateUkNi(grossAfterPension, taxYearCfg);
      const studentLoan = calculateStudentLoanRepayment(
        grossAfterPension,
        studentLoanInput?.value || "none",
      );
      const takeHomeBeforePension = grossAfterPension - incomeTax - nationalInsurance - studentLoan;
      const takeHomeAnnual =
        contributionMethod === "relief"
          ? takeHomeBeforePension - netPensionOutflow
          : takeHomeBeforePension;
      const fmtRow = (label, annual) => {
        const monthly = annual / 12;
        return `<tr>
          <th class="px-4 py-2 font-medium text-left">${label}</th>
          <td class="px-4 py-2 font-semibold text-right">${fmtCurrency(annual)}</td>
          <td class="px-4 py-2 text-right">${fmtCurrency(monthly)}</td>
        </tr>`;
      };
      const rows = [
        fmtRow("Gross income", annualIncome),
        fmtRow("Pension contributions", pensionGrossContribution),
      ];
      if (reliefTopUp > 0) rows.push(fmtRow("HMRC top-up (relief at source)", reliefTopUp));
      rows.push(
        fmtRow("Taxable income", taxableIncome),
        fmtRow("Income tax", incomeTax),
        fmtRow("National Insurance", nationalInsurance),
        fmtRow("Student loan", studentLoan),
        fmtRow("Take home", takeHomeAnnual),
      );
      const pensionNote =
        contributionMethod === "relief"
          ? `Relief at source assumes 20% basic-rate relief. Your personal outlay is ${fmtCurrency(
              netPensionOutflow,
            )} per year (${fmtCurrency(
              netPensionOutflow / 12,
            )} monthly) for a gross contribution of ${fmtCurrency(
              pensionGrossContribution,
            )}.`
          : "Salary sacrifice contributions are taken from gross pay before tax and National Insurance.";
      resultEl.innerHTML = `
        <div class="rounded-lg bg-gray-100 dark:bg-gray-700 p-4 text-gray-700 dark:text-gray-200">
          <div class="flex flex-col gap-1 mb-3">
            <h4 class="text-lg font-semibold">Estimated take home: ${fmtCurrency(
              takeHomeAnnual,
            )} per year</h4>
            <p class="text-sm text-gray-600 dark:text-gray-300">Using tax code ${
              taxCode || "1257L"
            } with ${contributionMethod === "sacrifice" ? "salary sacrifice applied before tax and National Insurance" : "relief at source taken from take-home (basic-rate relief added)"}.</p>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm text-left">
              <thead class="bg-gray-200 dark:bg-gray-700">
                <tr>
                  <th class="px-4 py-2">Line item</th>
                  <th class="px-4 py-2 text-right">Yearly</th>
                  <th class="px-4 py-2 text-right">Monthly</th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                ${rows.join("")}
              </tbody>
            </table>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-3">
            ${pensionNote} Figures use ${taxYearCfg.label || "2025/26"} thresholds. Student loan repayments use the plan threshold you selected.
          </p>
        </div>`;
      break;
    }
    case "simpleInterestForm": {
      const P = +$("si-principal").value,
        R = +$("si-rate").value,
        T = +$("si-years").value;
      const annual = P * (R / 100);
      const totalInterest = annual * T;
      const total = P + totalInterest;
      const daily = annual / 365.25;
      const weekly = annual / 52;
      const monthly = annual / 12;
      $("simpleInterestResult").innerHTML = `
      <div class="mt-4">
        <p class="text-lg font-semibold mb-2">Future Value: ${fmtCurrency(total)}</p>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-left">
        <thead class="bg-gray-200 dark:bg-gray-700">
          <tr>
            <th class="table-header">Period</th>
            <th class="table-header">Interest Accrued</th>
          </tr>
        </thead>
        <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 text-sm text-left">
          <tr><td class="px-6 py-3">Daily</td><td class="px-6 py-3">${fmtCurrency(daily)}</td></tr>
          <tr><td class="px-6 py-3">Weekly</td><td class="px-6 py-3">${fmtCurrency(weekly)}</td></tr>
          <tr><td class="px-6 py-3">Monthly</td><td class="px-6 py-3">${fmtCurrency(monthly)}</td></tr>
          <tr><td class="px-6 py-3">Yearly</td><td class="px-6 py-3">${fmtCurrency(annual)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>`;
      break;
    }

    case "interestRateDifferenceForm": {
      const amount = +$("interest-difference-amount").value;
      const rateA = +$("interest-rate-a").value;
      const rateB = +$("interest-rate-b").value;
      const interestA = amount * (rateA / 100);
      const interestB = amount * (rateB / 100);
      const difference = interestB - interestA;
      const diffAbs = Math.abs(difference);
      const summary = (() => {
        if (!Number.isFinite(interestA) || !Number.isFinite(interestB)) {
          return "Enter valid numbers to compare the two rates.";
        }
        if (difference > 0) {
          return `The comparative rate pays ${fmtCurrency(diffAbs)} more interest each year than the base rate.`;
        }
        if (difference < 0) {
          return `The base rate pays ${fmtCurrency(diffAbs)} more interest each year than the comparative rate.`;
        }
        return "Both rates pay the same yearly interest.";
      })();
      $("interestDifferenceResult").innerHTML = `
      <div class="rounded-lg bg-gray-100 dark:bg-gray-700 p-4 text-gray-700 dark:text-gray-200">
        <h4 class="text-lg font-semibold mb-2">Yearly interest comparison</h4>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-left">
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <tr><th class="px-4 py-2 font-medium">Base rate interest</th><td class="px-4 py-2">${fmtCurrency(interestA)}</td></tr>
              <tr><th class="px-4 py-2 font-medium">Comparative rate interest</th><td class="px-4 py-2">${fmtCurrency(interestB)}</td></tr>
              <tr><th class="px-4 py-2 font-medium">Difference</th><td class="px-4 py-2 font-semibold">${fmtCurrency(diffAbs)}</td></tr>
            </tbody>
          </table>
        </div>
        <p class="text-sm mt-3">${summary}</p>
      </div>`;
      break;
    }

    case "stockProfitForm": {
      const price = +$("stock-price").value,
        tax = +$("sdrt-tax").value,
        target = +$("target-return").value;
      const salePrice = price * (1 + tax / 100) * (1 + target / 100);
      $("stockProfitResult").innerHTML =
        `<p class="text-xl font-bold mt-2">Required Sale Price: ${salePrice.toFixed(2)}p</p>`;
      break;
    }

    case "stockProfitAmountForm": {
      const price = +$("stock-price-profit").value,
        tax = +$("sdrt-tax-profit").value,
        shares = +$("stock-shares-profit").value,
        profit = +$("target-profit").value;
      const costPerShare = (price / 100) * (1 + tax / 100);
      const totalCost = costPerShare * shares;
      const salePrice = ((totalCost + profit) / shares) * 100;
      const returnPct = (profit / totalCost) * 100;
      $("stockProfitAmountResult").innerHTML = `
      <p class="text-xl font-bold mt-2">Required Sale Price: ${salePrice.toFixed(2)}p</p>
      <p class="text-lg mt-1">Return: ${returnPct.toFixed(2)}%</p>`;
      break;
    }

    case "compoundForm": {
      const p = +$("ci-principal").value,
        r = +$("ci-rate").value,
        t = +$("ci-years").value,
        c = +$("ci-contribution").value;
      const freq =
        ($("ci-frequency") && $("ci-frequency").value) || "monthly";
      const perYearMap = {
        daily: 365,
        weekly: 52,
        monthly: 12,
        yearly: 1,
      };
      const m = perYearMap[freq] || 12;
      const fv = calculateFutureValueFreq(p, c, r, t, m);
      const totalContrib = p + c * (t * m);
      const totalInterest = fv - totalContrib;
      const yearly = totalInterest / (t || 1);
      const monthly = totalInterest / ((t || 1) * 12);
      const weekly = totalInterest / ((t || 1) * 52);
      const daily = totalInterest / ((t || 1) * 365.25);
      $("compoundResult").innerHTML = `
      <div class="mt-4">
        <p class="text-lg font-semibold mb-2">Future Value: ${fmtCurrency(fv)}</p>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-left">
        <thead class="bg-gray-200 dark:bg-gray-700">
          <tr>
            <th class="table-header">Period</th>
            <th class="table-header">Interest Accrued (avg)</th>
          </tr>
        </thead>
        <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 text-sm text-left">
          <tr><td class="px-6 py-3">Daily</td><td class="px-6 py-3">${fmtCurrency(daily)}</td></tr>
          <tr><td class="px-6 py-3">Weekly</td><td class="px-6 py-3">${fmtCurrency(weekly)}</td></tr>
          <tr><td class="px-6 py-3">Monthly</td><td class="px-6 py-3">${fmtCurrency(monthly)}</td></tr>
          <tr><td class="px-6 py-3">Yearly</td><td class="px-6 py-3">${fmtCurrency(yearly)}</td></tr>
        </tbody>
      </table>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Compound calculator shows average interest per period over the full term.</p>
  </div>`;
      break;
    }
  }
}

window.addEventListener("load", () => {
  const versionTargets = document.querySelectorAll("[data-app-version]");
  if (versionTargets.length) {
    const fallbackVersion = "0.0.0-dev";
    const applyVersion = (value) => {
      const normalized = normalizeAppVersion(value) || fallbackVersion;
      versionTargets.forEach((el) => {
        el.textContent = normalized;
      });
      return normalized;
    };
    const getDisplayedVersion = () => {
      const first = versionTargets[0];
      if (!first || typeof first.textContent !== "string") return null;
      return normalizeAppVersion(first.textContent);
    };

    applyVersion(fallbackVersion);
    let appliedControllerVersion = false;

    getControllerVersionFromServiceWorker()
      .then((version) => {
        if (version) {
          applyVersion(version);
          appliedControllerVersion = true;
        }
      })
      .catch(() => {
        /* ignore */
      });

    fetch("assets/version.json", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data || typeof data.version !== "string") return;
        const normalized = normalizeAppVersion(data.version);
        if (!normalized) return;
        if (!appliedControllerVersion) {
          applyVersion(normalized);
          return;
        }
        const current = getDisplayedVersion();
        if (!current || compareAppVersions(normalized, current) === 1) {
          versionTargets.forEach((el) => {
            el.setAttribute("data-latest-version", normalized);
          });
        }
      })
      .catch(() => {
        /* ignore */
      });
  }

  // Generate light/dark favicons from the inline #app-logo symbol
  (function generateFavicons() {
    const sym = document.getElementById("app-logo");
    if (!sym) return;
    const vb = sym.getAttribute("viewBox") || "0 0 1024 1024";
    const content = sym.innerHTML;
    const makeSvg = (fill) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="${fill}">${content}</svg>`;
    const makeLink = (media, svgStr) => {
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/svg+xml";
      if (media) link.media = media;
      link.href = url;
      document.head.appendChild(link);
    };
    // Dark mode: white icon; Light mode: near-black icon
    makeLink("(prefers-color-scheme: dark)", makeSvg("#ffffff"));
    makeLink("(prefers-color-scheme: light)", makeSvg("#111827"));
  })();

  setupMobileHeaderOffsetWatcher();

  $("goalValue").value = goalValue || "";
  $("goalYear").value = goalTargetDate
    ? new Date(goalTargetDate).getFullYear()
    : "";
  updateGoalButton();

  Chart.register(ChartZoom);
  Chart.register(LegendPad);
  Chart.defaults.font.family = "Inter";
  if ($("themeToggle")) $("themeToggle").checked = isDarkMode;
  if (typeof Chart !== "undefined")
    Chart.defaults.color = isDarkMode ? "#ffffff" : "#374151";
  updateChartContainers();

  updateCurrencySymbols();
  updateTaxSettingsUI();

  const today = startOfToday();
  if (!Number.isFinite(passiveIncomeAsOf) || passiveIncomeAsOf < today)
    passiveIncomeAsOf = today;
  const passiveDateInput = $("passiveIncomeDate");
  if (passiveDateInput) {
    const todayValue = toDateInputValue(today);
    passiveDateInput.min = todayValue;
    passiveDateInput.value = toDateInputValue(passiveIncomeAsOf);
    on(passiveDateInput, "change", (e) => {
      const raw = e.target.value;
      const fallback = startOfToday();
      const parsed = raw ? parseDateInput(raw, fallback) : fallback;
      const clamped = Math.max(parsed, fallback);
      passiveIncomeAsOf = clamped;
      e.target.value = toDateInputValue(clamped);
      updatePassiveIncome();
    });
  }

  setupProfilePickers();
  setupPassiveIncomeAssetPicker();

  const scenarioToggle = $("scenarioEventsToggle");
  if (scenarioToggle) {
    scenarioToggle.checked = !!scenarioEventsEnabled;
    on(scenarioToggle, "change", (e) =>
      applyScenarioEventsEnabled(e.target.checked),
    );
  }
  updateScenarioEventsUI();

  const bandSelect = $("taxBandSelect");
  if (bandSelect)
    on(bandSelect, "change", (e) => {
      const band = e.target.value;
      const cfg = getTaxBandConfig(band);
      taxSettings = {
        ...taxSettings,
        band,
        incomeAllowance: cfg.defaultAllowances.income,
        dividendAllowance: cfg.defaultAllowances.dividend,
        capitalAllowance: cfg.defaultAllowances.capital,
      };
      applyTaxSettingsChanges({ refreshUI: true, clearCalculator: true });
    });
  [
    { id: "taxIncomeAllowance", key: "incomeAllowance" },
    { id: "taxDividendAllowance", key: "dividendAllowance" },
    { id: "taxCapitalAllowance", key: "capitalAllowance" },
  ].forEach(({ id, key }) => {
    const input = $(id);
    if (!input) return;
    on(input, "change", () => {
      const val = toNonNegativeNumber(input.value, taxSettings[key]);
      taxSettings = { ...taxSettings, [key]: val };
      input.value = Number(val.toFixed(2)).toString();
      applyTaxSettingsChanges({ clearCalculator: true });
    });
  });
  const taxAssetSelect = $("taxAssetSelect");
  if (taxAssetSelect)
    on(taxAssetSelect, "change", () => {
      updateTaxCalculatorInputs();
      clearTaxCalculatorResult();
    });
  const taxScenarioSelect = $("taxScenario");
  if (taxScenarioSelect)
    on(taxScenarioSelect, "change", () => clearTaxCalculatorResult());

  buildAssetHeader();
  renderAssets();
  renderLiabilities();
  renderEvents();
  renderSnapshots();
  updateEmptyStates();
  renderProfileOptions();
  updateFireFormInputs();
  refreshFireProjection();
  on($("profileSelect"), "change", (e) =>
    switchProfile(e.target.value, { showFeedback: true }),
  );
  const inflEl = $("inflationRate");
  if (inflEl) inflEl.value = inflationRate;
  const inflForm = $("inflationForm");
  if (inflForm)
    on(inflForm, "submit", (e) => {
      e.preventDefault();
      const val = parseFloat($("inflationRate").value);
      inflationRate = isFinite(val) ? val : 2.5;
      saveCurrentProfile();
      persist();
      updateInflationImpactCard();
    });
  const addProfileHandler = () => {
    showPrompt("New profile name", "", (name) =>
      addProfile(name || `Profile ${profiles.length + 1}`),
    );
  };
  const renameProfileHandler = () => {
    showPrompt("Edit profile name", activeProfile?.name || "", (name) =>
      renameActiveProfile(name),
    );
  };
  const deleteProfileHandler = () => {
    if (profiles.length <= 1) {
      showAlert("At least one profile is required.");
      return;
    }
    showConfirm(
      `Delete profile "${activeProfile?.name || ""}"?`,
      () => deleteActiveProfile(),
    );
  };
  ["addProfileBtn", "addProfileBtnMobile"].forEach((id) => {
    const el = $(id);
    if (el) on(el, "click", addProfileHandler);
  });
  ["renameProfileBtn", "renameProfileBtnMobile"].forEach((id) => {
    const el = $(id);
    if (el) on(el, "click", renameProfileHandler);
  });
  ["deleteProfileBtn", "deleteProfileBtnMobile"].forEach((id) => {
    const el = $(id);
    if (el) on(el, "click", deleteProfileHandler);
  });

  // Hide Start Now if returning user (has at least one asset)
  const startBtn = $("startNowBtn");
  if (startBtn)
    startBtn.classList.toggle(
      "hidden",
      assets.length > 0 || liabilities.length > 0,
    );
  updatePassiveIncome();

  // Mobile menu
  const sidebar = $("sidebar"),
    overlay = $("overlay");
  const scheduleBrandLogoResize = () => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestAnimationFrame(sizeBrandLogo));
    } else {
      setTimeout(sizeBrandLogo, 50);
    }
  };
  const setMenuState = (open) => {
    if (!sidebar || !overlay) return;
    const hideSidebar = !open;
    sidebar.classList.toggle("-translate-x-full", hideSidebar);
    const hideOverlay = hideSidebar || window.innerWidth >= 768;
    overlay.classList.toggle("hidden", hideOverlay);
    const body = document.body;
    const lockScroll = open && window.innerWidth < 768;
    if (body) {
      body.classList.toggle("mobile-nav-open", lockScroll);
      if (lockScroll) {
        body.style.overflow = "hidden";
        body.style.touchAction = "none";
      } else {
        body.style.overflow = "";
        body.style.touchAction = "";
      }
    }
    if (!hideSidebar || window.innerWidth >= 768) {
      scheduleBrandLogoResize();
    }
  };
  const toggleMenu = () => {
    if (!sidebar) return;
    const isHidden = sidebar.classList.contains("-translate-x-full");
    setMenuState(isHidden);
  };
  on($("menu-toggle"), "click", toggleMenu);
  on(overlay, "click", () => setMenuState(false));

  on(window, "resize", () => {
    if (window.innerWidth >= 768) setMenuState(false);
    updateMobileHeaderOffset();
    updateChartContainers();
  });

  const resetBtn = $("wealthChartReset");
  if (resetBtn)
    on(resetBtn, "click", () => {
      if (!wealthChart) return;
      try {
        if (typeof wealthChart.resetZoom === "function") {
          wealthChart.resetZoom();
        }
      } catch (_) {}
      clearChartTooltip(wealthChart);
      adaptChartToZoom(wealthChart);
    });

  const brandHome = $("brandHome");
  if (brandHome)
    on(brandHome, "click", () => {
      const seen = localStorage.getItem(LS.welcome) === "1";
      const disabled = isFirstTimeContentHidden();
      if (!seen && !disabled) {
        navigateTo("welcome");
        try {
          localStorage.setItem(LS.welcome, "1");
        } catch (_) {}
      } else {
        navigateTo("data-entry");
      }
      if (window.innerWidth < 768) toggleMenu();
    });

  // Global click handlers (nav, tabs, actions, modal close)
  on(document, "click", (e) => {
    // Sortable asset table headers
    const sortTh = e.target.closest("#assetTableHeader th[data-sort]");
    if (sortTh) {
      const key = sortTh.dataset.sort;
      if (assetSort.key === key)
        assetSort.dir = assetSort.dir === "asc" ? "desc" : "asc";
      else {
        assetSort.key = key;
        assetSort.dir = "asc";
      }
      buildAssetHeader();
      renderAssets();
      return;
    }
    const stressTh = e.target.closest(
      "#stressEventsTableHeader th[data-sort]",
    );
    if (stressTh) {
      const key = stressTh.dataset.sort;
      if (stressSort.key === key)
        stressSort.dir = stressSort.dir === "asc" ? "desc" : "asc";
      else {
        stressSort.key = key;
        stressSort.dir = "asc";
      }
      buildStressHeader();
      renderStressEvents();
      return;
    }
    const navBtn = e.target.closest("nav button[data-target]");
    if (navBtn) {
      navigateTo(navBtn.dataset.target);
      if (window.innerWidth < 768) toggleMenu();
    }

    const tabBtn = e.target.closest(".tab-btn[data-tab-target]");
    if (tabBtn) {
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("tab-btn-active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.add("hidden"));
      tabBtn.classList.add("tab-btn-active");
      $(tabBtn.dataset.tabTarget).classList.remove("hidden");
    }

    if (e.target.closest('[data-action="close-modal"]')) closeModal();

    if (
      !e.target.closest("[data-snapshot-menu]") &&
      !e.target.closest('[data-action="toggle-snapshot-actions"]')
    ) {
      closeSnapshotActionMenus();
    }

    const action = e.target.closest("[data-action]");
    if (action) {
      const { action: act, index } = action.dataset;

      switch (act) {
        case "create-profile":
          {
            showPrompt("New profile name", "", (name) =>
              addProfile(name || `Profile ${profiles.length + 1}`),
            );
          }
          break;
        case "edit-asset":
          showEditAsset(+index);
          break;
        case "edit-income":
          showEditIncome(+index);
          break;
        case "edit-liability":
          showEditLiability(+index);
          break;
        case "delete-asset":
          showConfirm(
            "Are you sure you want to delete this asset?",
            () => {
              assets.splice(+index, 1);
              invalidateTaxCache();
              renderAssets();
              renderEvents();
              updateWealthChart();
              updateEmptyStates();
            },
          );
          break;
        case "delete-income":
          showConfirm(
            "Are you sure you want to delete this income source?",
            () => {
              incomes.splice(+index, 1);
              renderIncomes();
              updateWealthChart();
              updateEmptyStates();
            },
          );
          break;
        case "delete-liability":
          showConfirm(
            "Are you sure you want to delete this liability?",
            () => {
              liabilities.splice(+index, 1);
              renderLiabilities();
              updateWealthChart();
              updateEmptyStates();
            },
          );
          break;
        case "view-snapshot":
          {
            closeSnapshotActionMenus();
            const s = snapshots[+index];
            if (s) showSnapshotDetails(s);
          }
          break;
        case "rename-snapshot":
          {
            closeSnapshotActionMenus();
            const snap = snapshots[+index];
            if (!snap) break;
            showPrompt("Rename snapshot", snap.name, (name) => {
              const newName = name || snap.name;
              if (!newName) return;
              snap.name = newName;
              persist();
              renderSnapshots();
            });
          }
          break;
        case "delete-snapshot":
          closeSnapshotActionMenus();
          showConfirm(
            "Are you sure you want to delete this snapshot?",
            () => {
              snapshots.splice(+index, 1);
              persist();
              renderSnapshots();
              updateEmptyStates();
            },
          );
          break;
        case "toggle-snapshot-actions":
          {
            const menu = document.querySelector(
              `[data-snapshot-menu="${index}"]`,
            );
            if (!menu) break;
            const shouldOpen = menu.classList.contains("hidden");
            closeSnapshotActionMenus();
            if (shouldOpen) {
              menu.classList.remove("hidden");
              action.setAttribute("aria-expanded", "true");
            }
          }
          break;
        case "edit-event":
          showEditEvent(+index);
          break;
        case "delete-event":
          showConfirm(
            "Are you sure you want to delete this event?",
            () => {
              simEvents.splice(+index, 1);
              renderEvents();
              updateEmptyStates();
            },
          );
          break;
        case "take-snapshot":
          {
            const input = $("snapshotName");
            if (!input.checkValidity()) {
              input.reportValidity();
              return;
            }
            if (assets.length === 0) {
              showAlert(
                "Add at least one asset before saving a snapshot.",
              );
              return;
            }
            const name = input.value.trim();
            const detailed = assets.map((a) => ({
              name: a.name,
              value: calculateCurrentValue(a),
            }));
            const total = detailed.reduce((sum, a) => sum + a.value, 0);
            snapshots.push({
              name,
              date: new Date().toISOString(),
              value: total,
              assets: detailed,
              forecast: getSnapshotForecastSeries(),
            });
            persist();
            renderSnapshots();
            updateEmptyStates();
            input.value = "";
            showAlert("Snapshot taken successfully");
          }
          break;

        case "export-data":
          {
            persist();
            const selectedIds = profilePickers.export
              ? getProfilePickerSelection("export")
              : profiles.map((p) => String(p.id));
            const selectedProfilesRaw = profiles.filter((p) =>
              selectedIds.includes(String(p.id)),
            );
            if (selectedProfilesRaw.length === 0) {
              showAlert("Select at least one profile to export.");
              return;
            }
            const hasAny = selectedProfilesRaw.some(
              (p) =>
                (p.assets?.length || 0) > 0 ||
                (p.liabilities?.length || 0) > 0 ||
                (p.snapshots?.length || 0) > 0 ||
                (p.simEvents?.length || 0) > 0,
            );
            if (!hasAny) {
              showAlert(
                "No data to export yet. Add assets, liabilities, events, or snapshots first.",
              );
              return;
            }
            const passwordInput = getLatestById("exportPassword");
            const password = passwordInput ? passwordInput.value : "";
            const activeId =
              selectedProfilesRaw.find((p) => p.id == activeProfile?.id)?.id ||
              selectedProfilesRaw[0]?.id ||
              null;
            const exportProfiles = selectedProfilesRaw.map((profile) => ({
              ...profile,
              taxSettings: normalizeTaxSettings(profile.taxSettings),
              mobileNavSticky: sanitizeMobileNavSticky(
                Object.prototype.hasOwnProperty.call(profile, "mobileNavSticky")
                  ? profile.mobileNavSticky
                  : readStoredMobileNavSticky(),
              ),
              assets: ensureArray(profile.assets).map((asset) => {
                if (!asset || typeof asset !== "object") return asset;
                return {
                  ...asset,
                  depositDay: DEFAULT_DEPOSIT_DAY,
                };
              }),
              incomes: ensureArray(profile.incomes),
            }));
            const dataToExport = {
              profiles: exportProfiles,
              activeProfileId: activeId,
            };
            let payload = JSON.stringify(dataToExport);
            if (password)
              payload = CryptoJS.AES.encrypt(
                payload,
                password,
              ).toString();
            const blob = new Blob([payload], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const now = new Date();
            const pad = (n) => String(n).padStart(2, "0");
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            const a = document.createElement("a");
            a.href = url;
            a.download = `wealthtrack-data-${dateStr}.json`;
            a.click();
            URL.revokeObjectURL(url);
            closeAllProfilePickers();
            showAlert("Data exported successfully");
          }
          break;

        case "import-data":
          {
            const fi = $("importFile");
            if (!fi || fi.files.length === 0) {
              showAlert("Please select a file to import first.");
              return;
            }
            const file = fi.files[0];
            const passwordInput = getLatestById("importPassword");
            const password = passwordInput ? passwordInput.value : "";
            const pickerState = profilePickers.import;
            const selectedIds =
              pickerState && pickerState.optionIds.size > 0
                ? getProfilePickerSelection("import")
                : null;
            const importToken = getImportFileToken(file);
            const executeImport = (raw) => {
              try {
                const parsed = parseImportPayload(raw, password);
                const idSet = selectedIds
                  ? new Set(selectedIds.map((id) => String(id)))
                  : null;
                const filteredProfiles = idSet
                  ? parsed.profiles.filter((p) => idSet.has(String(p.id)))
                  : parsed.profiles;
                const hasPickerSelection =
                  pickerState && pickerState.optionIds.size > 0;
                if (hasPickerSelection && (!idSet || idSet.size === 0)) {
                  showAlert("Select at least one profile to import.");
                  return;
                }
                if (filteredProfiles.length === 0) {
                  showAlert("Select at least one profile to import.");
                  return;
                }
                const nextActiveId =
                  idSet && !idSet.has(String(parsed.activeProfileId))
                    ? filteredProfiles[0]?.id
                    : parsed.activeProfileId;
                profiles = filteredProfiles.map((profile) => ({ ...profile }));
                profiles.forEach((profile) => {
                  if (!profile || typeof profile !== "object") return;
                  if (
                    Object.prototype.hasOwnProperty.call(
                      profile,
                      "firstTimeContentHidden",
                    )
                  ) {
                    profile.firstTimeContentHidden = !!profile.firstTimeContentHidden;
                  } else {
                    profile.firstTimeContentHidden = getStoredFirstTimeHidden();
                  }
                  if (
                    Object.prototype.hasOwnProperty.call(
                      profile,
                      "mobileNavSticky",
                    )
                  ) {
                    profile.mobileNavSticky = sanitizeMobileNavSticky(
                      profile.mobileNavSticky,
                      readStoredMobileNavSticky(),
                    );
                  } else {
                    profile.mobileNavSticky = readStoredMobileNavSticky();
                  }
                });
                activeProfile =
                  profiles.find((p) => p.id == nextActiveId) || profiles[0];
                assets = activeProfile.assets || [];
                liabilities = activeProfile.liabilities || [];
                snapshots = activeProfile.snapshots || [];
                simEvents = activeProfile.simEvents || [];
                goalValue = activeProfile.goalValue || 0;
                goalTargetDate = activeProfile.goalTargetDate || null;
                inflationRate =
                  activeProfile.inflationRate != null
                    ? activeProfile.inflationRate
                    : 2.5;
                fireExpenses =
                  activeProfile.fireExpenses != null
                    ? activeProfile.fireExpenses
                    : 0;
                fireExpensesFrequency =
                  activeProfile.fireExpensesFrequency === "monthly"
                    ? "monthly"
                    : "annual";
                fireWithdrawalRate =
                  activeProfile.fireWithdrawalRate > 0
                    ? activeProfile.fireWithdrawalRate
                    : 4;
                fireProjectionYears =
                  activeProfile.fireProjectionYears &&
                  activeProfile.fireProjectionYears > 0
                    ? activeProfile.fireProjectionYears
                    : 30;
                fireLastInputs =
                  fireExpenses > 0 && fireWithdrawalRate > 0
                    ? {
                        annualExpenses: fireExpenses,
                        withdrawalRate: fireWithdrawalRate,
                      }
                    : null;
                fireForecastCosts =
                  activeProfile.fireForecastCosts != null
                    ? activeProfile.fireForecastCosts
                    : 0;
                fireForecastFrequency =
                  activeProfile.fireForecastFrequency === "monthly"
                    ? "monthly"
                    : "annual";
                fireForecastInflation =
                  activeProfile.fireForecastInflation >= 0
                    ? activeProfile.fireForecastInflation
                    : 2.5;
                fireForecastRetireDate =
                  activeProfile.fireForecastRetireDate &&
                  isFinite(activeProfile.fireForecastRetireDate)
                    ? activeProfile.fireForecastRetireDate
                    : null;
                activeProfile.fireForecastCosts = fireForecastCosts;
                activeProfile.fireForecastFrequency = fireForecastFrequency;
                activeProfile.fireForecastInflation = fireForecastInflation;
                activeProfile.fireForecastRetireDate = fireForecastRetireDate;
                taxSettings = normalizeTaxSettings(activeProfile.taxSettings);
                activeProfile.taxSettings = taxSettings;
                invalidateTaxCache();
                updateTaxSettingsUI();
                applyProfilePreferences(activeProfile);
                applyFirstTimeContentHidden(
                  isFirstTimeContentHidden(activeProfile),
                  { persistProfile: false },
                );
                const inflEl = $("inflationRate");
                if (inflEl) inflEl.value = inflationRate;
                $("goalValue").value = goalValue || "";
                $("goalYear").value = goalTargetDate
                  ? new Date(goalTargetDate).getFullYear()
                  : "";
                updateFireFormInputs();
                updateFireForecastInputs();
                updateGoalButton();
                normalizeData();
                renderAssets();
                renderLiabilities();
                renderEvents();
                renderSnapshots();
                updateWealthChart();
                updateSnapshotChart();
                renderAssetBreakdownChart();
                updatePassiveIncome();
                updateEmptyStates();
                refreshFireProjection();
                updateFireForecastCard();
                persist();
                renderProfileOptions();
                fi.value = "";
                document
                  .querySelectorAll('[data-import-filename]')
                  .forEach((el) => (el.textContent = "No file chosen"));
                resetProfilePicker("import");
                importFileContent = null;
                importFileToken = null;
                importPreviewData = null;
                closeAllProfilePickers();
                showAlert("Data imported successfully", () => {
                  navigateTo("data-entry");
                  updateEmptyStates();
                });
              } catch (err) {
                console.error(err);
                showAlert(
                  "Error importing file. Check password or file format.",
                );
              }
            };
            if (
              importFileToken === importToken &&
              typeof importFileContent === "string"
            ) {
              executeImport(importFileContent);
            } else {
              const reader = new FileReader();
              reader.onload = (ev) => {
                importFileContent = ev.target.result;
                importFileToken = importToken;
                executeImport(importFileContent);
              };
              reader.onerror = () => {
                showAlert(
                  "Error importing file. Check password or file format.",
                );
              };
              reader.readAsText(file);
            }
          }
          break;
        case "clear-data":
          showConfirm(
            "This will erase all locally stored data. Continue?",
            () => {
              localStorage.clear();
              location.reload();
            }
          );
          break;
      }
    }
  });

  on($("themeToggle"), "change", (e) =>
    applyDarkMode(e.target.checked, { withTransition: true }),
  );
  on($("goalBtn"), "click", () => {
    const prevGoalValue = goalValue;
    const prevGoalTargetDate = goalTargetDate;
    const nextGoalValue = parseFloat($("goalValue").value) || 0;
    const yr = parseInt($("goalYear").value);
    const nextGoalTargetDate = yr ? new Date(yr, 11, 31).getTime() : null;

    goalValue = nextGoalValue;
    goalTargetDate = nextGoalTargetDate;
    persist();
    updateWealthChart();
    updateEmptyStates();
    updateGoalButton();

    const goalChanged =
      prevGoalValue !== goalValue || prevGoalTargetDate !== goalTargetDate;
    if (!goalChanged) return;

    if (goalValue > 0) {
      const messageParts = [
        "Your wealth goal has been updated."
      ].filter(Boolean);
      showAlert(messageParts.join(" "));
    } else {
      showAlert("Your wealth goal has been cleared.");
    }
  });
  const importInput = $("importFile");
  if (importInput)
    on(importInput, "change", (e) => {
      const file = e.target.files[0] || null;
      const name = file?.name || "No file chosen";
      document
        .querySelectorAll("[data-import-filename]")
        .forEach((el) => (el.textContent = name));
      if (!file) {
        importFileContent = null;
        importFileToken = null;
        importPreviewData = null;
        resetProfilePicker("import");
        return;
      }
      importFileToken = getImportFileToken(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        importFileContent = ev.target.result;
        attemptImportPreview();
      };
      reader.onerror = () => {
        importFileContent = null;
        importFileToken = null;
        importPreviewData = null;
        resetProfilePicker("import", "Unable to read the selected file", {
          hint: "Please choose a different file to continue.",
        });
      };
      reader.readAsText(file);
    });
  document
    .querySelectorAll('[id="importPassword"]')
    .forEach((el) =>
      on(el, "input", () => {
        if (importFileContent != null) attemptImportPreview();
      }),
    );
  // Theme choice handlers
  const themeSel = document.getElementById("themeSelect");
  if (themeSel)
    on(themeSel, "change", (e) => applyThemeChoice(e.target.value));

  const navStickyToggle = document.getElementById("mobileNavStickyToggle");
  if (navStickyToggle) {
    navStickyToggle.checked = isMobileNavSticky;
    on(navStickyToggle, "change", (e) =>
      applyMobileNavSticky(e.target.checked),
    );
  }

  // First-time content toggle
  const welcomeToggle = $("welcomeToggle");
  updateFirstTimeContentVisibility(isFirstTimeContentHidden());
  if (welcomeToggle) {
    on(welcomeToggle, "change", (e) => {
      const show = e.target.checked;
      const hide = !show;
      applyFirstTimeContentHidden(hide);
      if (hide && $("welcome").classList.contains("active"))
        navigateTo("data-entry");
    });
  }

  // Enable collapsible cards
  setupCardCollapsing();

  // Remove stray leading whitespace from card headings for consistent layout
  normalizeCardHeadings();

  renderChangelogCard();

  // Brand logo sizing
  sizeBrandLogo();
  on(window, "resize", sizeBrandLogo);

  // Form submissions
  document
    .querySelectorAll("form")
    .forEach((f) => on(f, "submit", handleFormSubmit));
  const stressToggle = $("stressAssetsToggle");
  const stressMenu = $("stressAssetsMenu");
  if (stressToggle && stressMenu) {
    on(stressToggle, "click", () => stressMenu.classList.toggle("hidden"));
    on(stressMenu, "change", (e) => {
      const cb = e.target;
      if (cb && cb.type === "checkbox") {
        const id = Number(cb.dataset.id);
        if (cb.checked) stressAssetIds.add(id);
        else stressAssetIds.delete(id);
        updateStressAssetsButtonLabel();
      }
    });
    on(document, "click", (e) => {
      if (
        !stressMenu.contains(e.target) &&
        e.target !== stressToggle &&
        !stressToggle.contains(e.target)
      ) {
        stressMenu.classList.add("hidden");
      }
    });
  }
  const fpDate = $("futurePortfolioDate");
  if (fpDate) {
    fpDate.min = new Date().toISOString().split("T")[0];
    on(fpDate, "change", () => updateFuturePortfolioCard());
  }
  const fpScenario = $("futurePortfolioScenario");
  if (fpScenario) on(fpScenario, "change", () => updateFuturePortfolioCard());
  // First-run welcome routing
  const seen = localStorage.getItem(LS.welcome) === "1";
  const storedViewId = (() => {
    try {
      return localStorage.getItem(LS.view);
    } catch (_) {
      return null;
    }
  })();
  const storedSection = storedViewId ? document.getElementById(storedViewId) : null;
  const hasStoredSection =
    storedSection && storedSection.classList.contains("content-section");
  if (!seen && !isFirstTimeContentHidden()) {
    navigateTo("welcome");
    localStorage.setItem(LS.welcome, "1");
  } else if (hasStoredSection) {
    navigateTo(storedViewId);
  } else {
    navigateTo("data-entry");
  }

  updateFuturePortfolioCard();

  async function renderChangelogCard() {
    const card = document.getElementById("changelogCard");
    if (!card) return;
    const list = card.querySelector("[data-changelog-list]");
    if (!list) return;
    const emptyState = card.querySelector("[data-changelog-empty]");
    const errorState = card.querySelector("[data-changelog-error]");
    list.innerHTML = "";
    if (emptyState) emptyState.classList.add("hidden");
    if (errorState) errorState.classList.add("hidden");
    try {
      const entries = await fetchChangelogEntries();
      if (!entries.length) {
        if (emptyState) emptyState.classList.remove("hidden");
        return;
      }
      const recentEntries = entries
        .slice()
        .sort((a, b) => compareAppVersions(b.version, a.version))
        .slice(0, 5);
      recentEntries.forEach((entry) => {
        const section = document.createElement("div");
        section.className = "space-y-2";
        const heading = document.createElement("p");
        heading.className = "font-semibold text-gray-900 dark:text-gray-100";
        const formattedDate = formatChangelogDate(entry.date);
        heading.textContent = formattedDate
          ? `Version ${entry.version}: ${formattedDate}`
          : `Version ${entry.version}`;
        section.appendChild(heading);
        const listEl = document.createElement("ul");
        listEl.className =
          "list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300";
        entry.changes.forEach((change) => {
          const item = document.createElement("li");
          item.textContent = change;
          listEl.appendChild(item);
        });
        section.appendChild(listEl);
        list.appendChild(section);
      });
    } catch (_) {
      if (errorState) errorState.classList.remove("hidden");
    }
  }

  async function handleAppUpdateRequest(button) {
    if (!button) return;
    const originalLabel =
      button.getAttribute("data-default-label") || button.textContent.trim();
    button.setAttribute("data-default-label", originalLabel);
    const renderBusyContent = (label) =>
      `<span class="flex items-center justify-center gap-2">
        <span
          class="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        ></span>
        <span>${label}</span>
      </span>`;
    const setBusyState = (label) => {
      button.innerHTML = renderBusyContent(label);
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    };
    const resetButtonState = () => {
      button.textContent = originalLabel;
      button.disabled = false;
      button.removeAttribute("aria-busy");
    };
    let updateResolved = false;
    let timeoutId = null;
    const cancelTimeout = () => {
      if (timeoutId === null) return;
      clearTimeout(timeoutId);
      timeoutId = null;
    };
    const markResolved = () => {
      if (updateResolved) return false;
      updateResolved = true;
      cancelTimeout();
      return true;
    };
    const finishWithAlert = (message) => {
      if (!markResolved()) return;
      resetButtonState();
      showAlert(message);
    };
    const controllerVersionPromise = getControllerVersionFromServiceWorker({
      refresh: true,
    });
    const fetchLatestAppVersion = async () => {
      try {
        const response = await fetch("assets/version.json", { cache: "no-store" });
        if (!response || !response.ok) return null;
        const data = await response.json();
        if (!data || typeof data.version !== "string") return null;
        return normalizeAppVersion(data.version);
      } catch (_) {
        return null;
      }
    };
    const getDisplayedAppVersion = () => {
      const el = document.querySelector("[data-app-version]");
      if (!el || typeof el.textContent !== "string") return null;
      return normalizeAppVersion(el.textContent);
    };
    const initialDisplayedVersion = getDisplayedAppVersion();
    const buildUpdateSummaryContent = (
      summary,
      changesByVersion,
    ) => {
      const wrapper = document.createElement("div");
      wrapper.className = "space-y-4 text-left";
      const summaryParagraph = document.createElement("p");
      summaryParagraph.className =
        "text-base text-gray-700 dark:text-gray-200";
      summaryParagraph.textContent = summary;
      wrapper.appendChild(summaryParagraph);
      changesByVersion.forEach((entry) => {
        const section = document.createElement("div");
        section.className = "space-y-2";
        const heading = document.createElement("p");
        heading.className = "font-semibold text-gray-900 dark:text-gray-100";
        const formattedDate = formatChangelogDate(entry.date);
        heading.textContent = formattedDate
          ? `Version ${entry.version}: ${formattedDate}`
          : `Version ${entry.version}`;
        section.appendChild(heading);
        const list = document.createElement("ul");
        list.className =
          "list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300";
        entry.changes.forEach((change) => {
          const item = document.createElement("li");
          item.textContent = change;
          list.appendChild(item);
        });
        section.appendChild(list);
        wrapper.appendChild(section);
      });
      const reloadNote = document.createElement("p");
      reloadNote.className = "text-xs text-gray-500 dark:text-gray-400";
      reloadNote.textContent = "WealthTrack will reload to finish applying the update.";
      wrapper.appendChild(reloadNote);
      return wrapper;
    };
    const notifyUpdateComplete = async () => {
      const controllerVersion = await controllerVersionPromise;
      if (!markResolved()) return;
      const latestVersion = await fetchLatestAppVersion();
      let previousVersion =
        controllerVersion || initialDisplayedVersion || getDisplayedAppVersion();
      if (
        latestVersion &&
        previousVersion &&
        compareAppVersions(previousVersion, latestVersion) >= 0 &&
        initialDisplayedVersion &&
        compareAppVersions(initialDisplayedVersion, latestVersion) === -1
      ) {
        previousVersion = initialDisplayedVersion;
      }
      if (latestVersion) {
        document
          .querySelectorAll("[data-app-version]")
          .forEach((el) => {
            el.textContent = latestVersion;
          });
      }
      resetButtonState();
      try {
        button.focus({ preventScroll: true });
      } catch (_) {
        button.focus();
      }
      const hasVersion = typeof latestVersion === "string" && latestVersion;
      const versionAdvanced =
        hasVersion &&
        (!previousVersion ||
          compareAppVersions(previousVersion, latestVersion) === -1);
      if (versionAdvanced) {
        const changelogEntries = await fetchChangelogEntries();
        const relevantChanges = filterChangelogForUpdate(
          changelogEntries,
          previousVersion,
          latestVersion,
        );
        if (relevantChanges.length) {
          const summaryMessage = previousVersion
            ? `WealthTrack has been updated to version ${latestVersion}. Here's what's new since version ${previousVersion}.`
            : `WealthTrack has been updated to version ${latestVersion}. Here's what's new.`;
          const content = buildUpdateSummaryContent(
            summaryMessage,
            relevantChanges,
          );
          showAlert(content, () => window.location.reload());
          return;
        }
      }
      const message = hasVersion
        ? previousVersion && hasVersion && compareAppVersions(previousVersion, latestVersion) === 0
          ? `You're already using the latest version of WealthTrack (version ${latestVersion}).`
          : `WealthTrack has been updated to version ${latestVersion}.`
        : "WealthTrack has been updated to the latest version.";
      showAlert(message, () => window.location.reload());
    };
    if (!("serviceWorker" in navigator)) {
      finishWithAlert(
        "Automatic updates aren't supported in this browser. Please refresh manually to get the latest version.",
      );
      return;
    }

    const waitForInstalled = (worker) =>
      new Promise((resolve, reject) => {
        if (!worker) {
          resolve();
          return;
        }
        if (worker.state === "installed" || worker.state === "activated") {
          resolve();
          return;
        }
        if (worker.state === "redundant") {
          reject(new Error("Service worker install failed"));
          return;
        }
        const onStateChange = () => {
          if (worker.state === "installed" || worker.state === "activated") {
            worker.removeEventListener("statechange", onStateChange);
            resolve();
          } else if (worker.state === "redundant") {
            worker.removeEventListener("statechange", onStateChange);
            reject(new Error("Service worker install failed"));
          }
        };
        worker.addEventListener("statechange", onStateChange);
      });

    const waitForActivation = (worker) =>
      new Promise((resolve, reject) => {
        if (!worker) {
          resolve();
          return;
        }
        if (worker.state === "activated") {
          resolve();
          return;
        }
        if (worker.state === "redundant") {
          reject(new Error("Service worker became redundant"));
          return;
        }
        const onStateChange = () => {
          if (worker.state === "activated") {
            worker.removeEventListener("statechange", onStateChange);
            resolve();
          } else if (worker.state === "redundant") {
            worker.removeEventListener("statechange", onStateChange);
            reject(new Error("Service worker became redundant"));
          }
        };
        worker.addEventListener("statechange", onStateChange);
      });

    const waitForControllerChange = () =>
      new Promise((resolve) => {
        let resolved = false;
        const finish = () => {
          if (resolved) return;
          resolved = true;
          navigator.serviceWorker.removeEventListener("controllerchange", finish);
          resolve();
        };
        navigator.serviceWorker.addEventListener("controllerchange", finish);
        setTimeout(finish, 5000);
      });

    const waitForRegistration = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) return reg;
      } catch (_) {
        /* ignore */
      }
      try {
        return await navigator.serviceWorker.ready;
      } catch (_) {
        return null;
      }
    };

    const waitForNewWorker = (registration) =>
      new Promise((resolve) => {
        if (registration.installing) {
          resolve(registration.installing);
          return;
        }
        const handleUpdateFound = () => {
          const worker = registration.installing || registration.waiting;
          if (!worker) return;
          registration.removeEventListener("updatefound", handleUpdateFound);
          resolve(worker);
        };
        registration.addEventListener("updatefound", handleUpdateFound);
        setTimeout(() => {
          registration.removeEventListener("updatefound", handleUpdateFound);
          resolve(registration.installing || registration.waiting || null);
        }, 10000);
      });

    const activateWorker = async (worker) => {
      if (updateResolved) return true;
      if (!worker) return false;
      try {
        setBusyState("Downloading update…");
        await waitForInstalled(worker);
        if (updateResolved) return true;
      } catch (err) {
        console.error("Update install failed", err);
        finishWithAlert("We couldn't finish installing the update. Please try again later.");
        return true;
      }
      setBusyState("Installing update…");
      const controllerChange = waitForControllerChange();
      try {
        worker.postMessage({ type: "SKIP_WAITING" });
      } catch (err) {
        console.error("Failed to notify service worker", err);
      }
      try {
        await waitForActivation(worker);
        if (updateResolved) return true;
      } catch (err) {
        console.error("Update activation failed", err);
        finishWithAlert("We couldn't activate the update. Please try again later.");
        return true;
      }
      setBusyState("Finalizing update…");
      await controllerChange;
      if (updateResolved) return true;
      await notifyUpdateComplete();
      return true;
    };

    setBusyState("Checking…");
    cancelTimeout();
    timeoutId = setTimeout(() => {
      console.warn("Update request timed out after 30 seconds");
      finishWithAlert("Checking for updates failed. Please try again later.");
    }, 30000);

    try {
      const registration = await waitForRegistration();
      if (updateResolved) return;
      if (!registration) {
        finishWithAlert(
          "We couldn't reach the update service. Please refresh manually to check for updates.",
        );
        return;
      }

      if (registration.waiting) {
        await activateWorker(registration.waiting);
        return;
      }

      if (registration.installing) {
        const applied = await activateWorker(registration.installing);
        if (applied) return;
      }

      const newWorkerPromise = waitForNewWorker(registration);
      try {
        await registration.update();
      } catch (err) {
        console.error("Service worker update failed", err);
      }
      if (updateResolved) return;
      const newWorker = await newWorkerPromise;
      if (updateResolved) return;
      if (newWorker) {
        await activateWorker(newWorker);
        return;
      }

      finishWithAlert("You're already using the latest version of WealthTrack.");
    } catch (error) {
      console.error("Update check failed", error);
      finishWithAlert("We couldn't complete the update check. Please try again later.");
    }
  }

  // Welcome buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    switch (btn.dataset.action) {
      case "start-now":
        localStorage.setItem(LS.onboardPending, "1");
        navigateTo("data-entry", { expandCards: true });
        break;
      case "focus-asset-form":
        {
          closeModal();
          navigateTo("data-entry", { expandCards: true });
          const el = $("assetName");
          if (el) {
            try {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.focus({ preventScroll: true });
            } catch (_) {
              el.focus();
            }
          }
        }
        break;
      case "focus-goal":
        {
          closeModal();
          navigateTo("data-entry", { expandCards: true });
          const el = $("goalValue");
          if (el) {
            try {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.focus({ preventScroll: true });
            } catch (_) {
              el.focus();
            }
          }
        }
        break;
      case "go-assets":
        closeModal();
        navigateTo("data-entry", { expandCards: true });
        break;
      case "go-forecasts":
        closeModal();
        navigateTo("forecasts", { expandCards: true });
        break;
      case "go-insights":
        closeModal();
        navigateTo("portfolio-analysis", { expandCards: true });
        break;
      case "go-settings":
        closeModal();
        navigateTo("settings", { expandCards: true });
        break;
      case "open-tour":
        {
          const tpl = document.importNode($("tpl-quick-tour").content, true);
          openModalNode(tpl);
        }
        break;
      case "load-demo":
        loadDemoData();
        break;
      case "close-modal":
        closeModal();
        break;
      case "update-app":
        handleAppUpdateRequest(btn);
        break;
    }
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  });
}
