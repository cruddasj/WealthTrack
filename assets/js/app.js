// --- State ---
let profiles = [];
let activeProfile = null;
let assets = [];
let liabilities = [];
let snapshots = [];
let simEvents = [];
let stressAssetIds = new Set();
let goalValue = 0;
let goalTargetDate = null;
let inflationRate = 2.5;
let wealthChart, snapshotChart, assetBreakdownChart;
let assetForecasts = new Map();
let liabilityForecasts = new Map();
let lastForecastScenarios = null;
let progressCheckSelection = null;
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
const LS = {
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
  profiles: "profiles",
  activeProfile: "activeProfile",
  forecastTip: "forecastTipSeen",
  currency: "currency",
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const load = (k, d) => JSON.parse(localStorage.getItem(k)) || d;
const getLocalStorageItem = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
};

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

const currencyOptions = {
  GBP: { label: "Pounds (£)", locale: "en-GB", currency: "GBP", symbol: "£" },
  USD: { label: "Dollars ($)", locale: "en-US", currency: "USD", symbol: "$" },
  EUR: { label: "Euros (€)", locale: "en-IE", currency: "EUR", symbol: "€" },
};

const sanitizeCurrencyCode = (code) =>
  currencyOptions[code] ? code : "GBP";

const sanitizeThemeChoice = (val) =>
  val === "inverted" || val === "glass" ? val : "default";

let currencyCode = sanitizeCurrencyCode(load(LS.currency, "GBP"));
let currentThemeChoice = sanitizeThemeChoice(
  getLocalStorageItem(LS.themeChoice) || "default",
);
let isDarkMode = getLocalStorageItem(LS.theme) === "1";

const getCurrencyConfig = () =>
  currencyOptions[currencyCode] || currencyOptions.GBP;

const fmtCurrency = (value) => {
  const cfg = getCurrencyConfig();
  const amount =
    typeof value === "number" ? value : Number.parseFloat(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return safeAmount.toLocaleString(cfg.locale, {
    style: "currency",
    currency: cfg.currency,
  });
};

const updateCurrencySymbols = () => {
  const cfg = getCurrencyConfig();
  document
    .querySelectorAll("[data-currency-symbol]")
    .forEach((el) => {
      el.textContent = cfg.symbol;
    });
  document
    .querySelectorAll("template")
    .forEach((tpl) => {
      const fragment = tpl.content;
      if (!fragment) return;
      fragment
        .querySelectorAll("[data-currency-symbol]")
        .forEach((el) => {
          el.textContent = cfg.symbol;
        });
    });
};

const currencyTick = (v) => fmtCurrency(v);

function applyCurrencyChoice(
  code,
  { persistChoice = true, refresh = true } = {},
) {
  const normalized = sanitizeCurrencyCode(code);
  currencyCode = normalized;
  if (activeProfile) activeProfile.currencyCode = currencyCode;
  if (persistChoice) {
    save(LS.currency, currencyCode);
    if (activeProfile) persist();
  }
  if (refresh) {
    refreshCurrencyDisplays();
  } else {
    updateCurrencySymbols();
    const select = document.getElementById("currencySelect");
    if (select && select.value !== currencyCode) select.value = currencyCode;
  }
}

function refreshCurrencyDisplays() {
  updateCurrencySymbols();
  const select = document.getElementById("currencySelect");
  if (select && select.value !== currencyCode) select.value = currencyCode;
  renderAssets();
  renderLiabilities();
  renderEvents();
  renderSnapshots();
  updateInflationImpactCard();
  refreshFireProjection();
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
    label: "Income tax (interest, rent, coupons)",
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
    )} · Dividends: ${fmtCurrency(taxSettings.dividendAllowance)} · Capital gains: ${fmtCurrency(
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
    assets: ensureArray(profile?.assets),
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
    currencyCode: sanitizeCurrencyCode(
      profile?.currencyCode || profile?.currency || currencyCode,
    ),
    themeChoice: sanitizeThemeChoice(profile?.themeChoice),
    darkMode: !!profile?.darkMode,
    passiveIncomeAssetSelection: sanitizePassiveSelection(
      profile?.passiveIncomeAssetSelection ?? profile?.passiveIncomeSelection,
    ),
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
  activeProfile.liabilities = liabilities;
  activeProfile.snapshots = snapshots;
  activeProfile.simEvents = simEvents;
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
  activeProfile.currencyCode = currencyCode;
  activeProfile.themeChoice = currentThemeChoice;
  activeProfile.darkMode = isDarkMode;
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
  return date.toISOString().slice(0, 10);
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
    const ret = parseFloat(a.return) || 0;
    if (a.lowGrowth == null) a.lowGrowth = ret;
    if (a.highGrowth == null) a.highGrowth = ret;
    if (a.includeInPassive === undefined) a.includeInPassive = true;
    a.taxTreatment = normalizeTaxTreatment(a.taxTreatment);
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
      currencyCode: sanitizeCurrencyCode(load(LS.currency, "GBP")),
      themeChoice: sanitizeThemeChoice(
        localStorage.getItem(LS.themeChoice) || "default",
      ),
      darkMode: localStorage.getItem(LS.theme) === "1",
      passiveIncomeAssetSelection: null,
      firstTimeContentHidden: getStoredFirstTimeHidden(),
    };
    profiles = [def];
    id = def.id;
    save(LS.profiles, profiles);
  }
  if (profiles) {
    const fallbackCurrency = currencyCode;
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
      if (p.currencyCode != null) {
        const sanitizedCurrency = sanitizeCurrencyCode(p.currencyCode);
        if (sanitizedCurrency !== p.currencyCode) {
          p.currencyCode = sanitizedCurrency;
          profilesUpdated = true;
        }
      } else if (p.currency != null) {
        const sanitizedCurrency = sanitizeCurrencyCode(p.currency);
        if (p.currencyCode !== sanitizedCurrency) {
          p.currencyCode = sanitizedCurrency;
          profilesUpdated = true;
        }
      } else if (fallbackCurrency && p.currencyCode !== fallbackCurrency) {
        p.currencyCode = fallbackCurrency;
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

const depositsSoFar = (asset, now = Date.now()) => {
  if (!asset) return 0;
  const start = getStartDate(asset);
  if (now <= start) return 0;
  const years = (now - start) / (1000 * 60 * 60 * 24 * 365.25);
  const perYearRate = perYear[asset.frequency] || 0;
  const periods = Math.max(0, Math.floor(years * perYearRate));
  return (asset.originalDeposit || 0) * periods;
};

const calculateCurrentValue = (asset, now = Date.now()) => {
  if (!asset) return 0;
  const start = getStartDate(asset);
  if (now < start) return 0;
  return (asset.value || 0) + depositsSoFar(asset, now);
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

  const base = Array(labels.length).fill(0);
  const low = Array(labels.length).fill(0);
  const high = Array(labels.length).fill(0);

  const nextAssetForecasts = new Map();
  const assetDetails = includeBreakdown ? [] : null;
  const globalEvents = [];
  const eventsByAsset = new Map();
  const consideredAssets = passiveOnly
    ? assets.filter((a) => a && a.includeInPassive !== false)
    : assets;
  const assetIds = new Set(consideredAssets.map((a) => a.dateAdded));
  const taxDetails = computeAssetTaxDetails();
  const taxDetailMap = taxDetails.detailMap;

  simEvents.forEach((ev) => {
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
    const monthlyContribution = asset.monthlyDeposit || 0;
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
      if (active) {
        valueBase = valueBase * (1 + rateBase) + monthlyContribution;
        valueLow = valueLow * (1 + rateLow) + monthlyContribution;
        valueHigh = valueHigh * (1 + rateHigh) + monthlyContribution;
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
        if (active && outstanding > 0) {
          outstanding = outstanding * (1 + rate);
          outstanding = Math.max(
            0,
            outstanding - Math.min(outstanding, payment),
          );
        }
      }
      nextLiabilityForecasts.set(liability.dateAdded, arr);
    });
  }

  if (!passiveOnly) {
    assetForecasts = nextAssetForecasts;
    liabilityForecasts = nextLiabilityForecasts;
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
  tpl.querySelector("[data-text]").textContent = message;
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
  [wealthChart, snapshotChart, assetBreakdownChart].forEach((c) => {
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
  const storedCurrency = load(LS.currency, "GBP");
  const currencyPref = sanitizeCurrencyCode(
    profile?.currencyCode || profile?.currency || storedCurrency,
  );
  applyCurrencyChoice(currencyPref, { persistChoice: false, refresh: false });
  if (profile) profile.currencyCode = currencyCode;

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
  simEvents.forEach((ev) => {
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
    currencyCode,
    themeChoice: currentThemeChoice,
    darkMode: isDarkMode,
    passiveIncomeAssetSelection: null,
    firstTimeContentHidden: isFirstTimeContentHidden(),
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
    liabilities = [];
    snapshots = [];
    simEvents = [];
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
  const hasLiabs = liabilities.length > 0;
  const hasGoalData = goalValue > 0 || goalTargetDate;
  const hasGoal = goalValue > 0 && goalTargetDate;
  const canForecast = hasAssets || hasLiabs;
  const goalInsightsAvailable = canForecast && hasGoal;
  const canStressTest = canRunStressTest();
  const hasAnyData =
    hasAssets ||
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
  if (ForecastCard) ForecastCard.hidden = !canForecast;
  if (forecastGoalsCard) forecastGoalsCard.hidden = !goalInsightsAvailable;
  const saveSnapCard = $("saveSnapshotCard");
  if (saveSnapCard) saveSnapCard.hidden = isFresh;
  const snapHistCard = $("snapshotHistoryCard");
  if (snapHistCard) snapHistCard.hidden = snapshots.length === 0;
  const progressCard = $("progressCheckCard");
  if (progressCard)
    progressCard.hidden = snapshots.length === 0 || !canForecast;
  const exportCard = $("exportCard");
  if (exportCard) exportCard.hidden = isFresh;
  const futureCard = $("futureValueCard");
  if (futureCard) futureCard.hidden = !hasAssets;
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
      const depositText = hasDeposit
        ? `${fmtCurrency(asset.originalDeposit)} (${asset.frequency})`
        : "-";
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
  renderFutureValueAssetOptions();
  renderTaxCalculatorOptions();
  renderStressAssetOptions();
  renderPassiveAssetPickerOptions();
  persist();
  updateWealthChart();
  renderAssetBreakdownChart();
  updatePassiveIncome();
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

function renderFutureValueAssetOptions() {
  const sel = $("fvAsset");
  if (!sel) return;
  const opts = [...assets].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", undefined, {
      sensitivity: "base",
    }),
  );
  sel.innerHTML = opts
    .map((a) => `<option value="${a.dateAdded}">${a.name}</option>`)
    .join("");
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
  persist();
  updateWealthChart();
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
      '<p class="text-sm text-gray-500 dark:text-gray-400">Take a snapshot to unlock progress comparisons.</p>';
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
      '<p class="text-sm text-gray-500 dark:text-gray-400">Take a snapshot to unlock progress comparisons.</p>';
    return;
  }

  const selectedDate = select.value;
  const snapshot = snapshots.find((s) => s.date === selectedDate);
  if (!snapshot) {
    result.innerHTML =
      '<p class="text-sm text-gray-500 dark:text-gray-400">Select a snapshot to see its saved forecast comparison.</p>';
    return;
  }

  const forecastSeries = snapshot.forecast || snapshot.expectedForecast;
  if (!Array.isArray(forecastSeries) || forecastSeries.length === 0) {
    result.innerHTML =
      '<p class="text-sm text-gray-500 dark:text-gray-400">This snapshot does not include saved forecast data. Capture a new snapshot to compare forecasts.</p>';
    return;
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  // Ensure data is sorted and valid
  const series = forecastSeries
    .map((e) => ({ date: new Date(e.date), value: Number(e.value) }))
    .filter((e) => !Number.isNaN(e.date.getTime()) && Number.isFinite(e.value))
    .sort((a, b) => a.date - b.date);

  if (series.length === 0) {
    result.innerHTML =
      '<p class="text-sm text-gray-500 dark:text-gray-400">Saved forecast data for this snapshot could not be read.</p>';
    return;
  }

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

  let forecastValue;
  let comparisonDate = now;
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
      '<p class="text-sm text-gray-500 dark:text-gray-400">Saved forecast data for this snapshot could not be read.</p>';
    return;
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
      ? `You're ahead of this saved forecast by ${diffAbs}.`
      : diff < -tolerance
        ? `You're behind this saved forecast by ${diffAbs}.`
        : `You're tracking this saved forecast closely (within ${diffAbs}).`;

  result.innerHTML = `
    <div class="space-y-3">
      <p class="text-sm text-gray-600 dark:text-gray-300">
        Saved forecast from <strong>${snapshot.name}</strong> expected <span class="whitespace-nowrap">${fmtCurrency(
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

function updateWealthChart() {
  const hasData = assets.length > 0 || liabilities.length > 0;
  $("wealthChart").hidden = !hasData;
  $("wealthChartMessage").hidden = hasData;
  if (!hasData) {
    wealthChart?.destroy();
    wealthChart = null;
    lastForecastScenarios = null;
    assetForecasts = new Map();
    liabilityForecasts = new Map();
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
              const lines = [...assetLines, ...liabLines];
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
  if (!has) {
    assetBreakdownChart?.destroy();
    assetBreakdownChart = null;
    return;
  }

  const colorFor = (i) => `hsl(${(i * 57) % 360},70%,60%)`;
  const data = {
    labels: assets.map((a) => a.name),
    datasets: [
      {
        data: assets.map((asset) => calculateCurrentValue(asset)),
        backgroundColor: assets.map((_, i) => colorFor(i)),
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
  updateChartTheme();
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
  years.forEach((y) => {
    assetList.forEach((a) => {
      if (Math.random() < 0.3) {
        const m = Math.floor(Math.random() * 12);
        const amt = Math.max(-15, Math.min(15, randomNormal(0, 5)));
        events.push({
          name: a.name,
          assetId: a.dateAdded,
          amount: amt,
          isPercent: true,
          date: new Date(y, m, 1).getTime(),
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

  const globalEvents = [];
  const eventsByAsset = new Map();
  const assetList = assetIdSet
    ? assets.filter((a) => assetIdSet.has(a.dateAdded))
    : assets;
  const assetIds = new Set(assetList.map((a) => a.dateAdded));
  const taxDetails = computeAssetTaxDetails();
  const taxDetailMap = taxDetails.detailMap;
  [...simEvents, ...extraEvents].forEach((ev) => {
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
      while (
        evIdx < assetEvents.length &&
        currentDate >= new Date(assetEvents[evIdx].date)
      ) {
        const evt = assetEvents[evIdx];
        v = evt.isPercent ? v * (1 + evt.amount / 100) : v + evt.amount;
        evIdx++;
      }
      base[i] += v;
      v = v * (1 + r) + a.monthlyDeposit;
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

function navigateTo(viewId) {
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
  document
    .querySelector(`nav button[data-target="${viewId}"]`)
    .classList.add("active-nav-button");
  document
    .querySelectorAll(".content-section")
    .forEach((s) => s.classList.remove("active"));
  $(viewId).classList.add("active");
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
      const key = `cardCollapsed:${baseId}`;
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
        const collapsed = localStorage.getItem(key) === "1";
        header.setAttribute(
          "aria-expanded",
          collapsed ? "false" : "true",
        );
        if (collapsed) {
          card.classList.add("collapsed");
          body.style.height = "0px";
          body.style.opacity = "0";
        } else {
          card.classList.remove("collapsed");
          body.style.height = "auto";
          body.style.opacity = "1";
        }
      };
      setInitialState();

      const expand = () => {
        card.classList.remove("collapsed");
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
        // from current natural height to 0
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

      header.addEventListener("click", toggle);
      header.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });
}

// Resize sidebar brand logo to match title width (desktop)
function sizeBrandLogo() {
  const logo = $("brandLogo");
  const title = $("brandTitle");
  if (!logo || !title) return;
  try {
    const w = title.offsetWidth || 0;
    logo.style.height = "auto";
    if (w > 0) {
      logo.style.width = w + "px";
    }
    logo.style.marginBottom = "4px";
  } catch (_) {}
}

// --- Events and init ---
function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  switch (form.id) {
    case "assetForm": {
      const newAsset = {
        name: form.assetName.value,
        value: parseFloat(form.assetValue.value),
        originalDeposit: parseFloat(form.depositAmount.value) || 0,
        frequency: form.depositFrequency.value,
        dateAdded: Date.now(),
      };
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
      const runs = parseInt(form.stressRuns.value) || 100;
      const scenario = form.stressScenario.value;
      if (!canRunStressTest()) {
        updateEmptyStates();
        break;
      }
      const selected = [...stressAssetIds];
      if (selected.length === 0) {
        $("stressTestResult").innerHTML =
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
      const scenarioLabel =
        {
          low: "Low Growth",
          base: "Expected Growth",
          high: "High Growth",
        }[scenario] || "Expected Growth";
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
      resEl.className = "mt-4 text-sm";
      resEl.innerHTML = html;
      buildStressHeader();
      renderStressEvents();
      setupCardCollapsing();
      break;
    }
    case "futureValueForm": {
      const assetId = form.fvAsset.value;
      const dateStr = form.fvDate.value;
      const asset = assets.find((a) => a.dateAdded == assetId);
      if (!asset || !dateStr) {
        showAlert("Please select an asset and future date.");
        break;
      }
      const target = new Date(dateStr);
      const now = new Date();
      if (target <= now) {
        showAlert("Please pick a future date.");
        break;
      }
      const years = (target - now) / (1000 * 60 * 60 * 24 * 365.25);
      const principal = calculateCurrentValue(asset);
      const monthly = asset.monthlyDeposit || 0;
      const taxDetail = computeAssetTaxDetails().detailMap.get(asset.dateAdded);
      const lowRate = taxDetail?.low?.netRate ?? getGrossRate(asset, "low");
      const baseRate = taxDetail?.base?.netRate ?? getGrossRate(asset, "base");
      const highRate = taxDetail?.high?.netRate ?? getGrossRate(asset, "high");
      const low = calculateFutureValue(principal, monthly, lowRate || 0, years);
      const exp = calculateFutureValue(principal, monthly, baseRate || 0, years);
      const high = calculateFutureValue(principal, monthly, highRate || 0, years);
      $("fvLow").textContent = fmtCurrency(low);
      $("fvExpected").textContent = fmtCurrency(exp);
      $("fvHigh").textContent = fmtCurrency(high);
      const res = $("fvResult");
      if (res) res.classList.remove("hidden");
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
    const normalizeVersion = (value) => {
      if (typeof value !== "string") return fallbackVersion;
      const trimmed = value.trim();
      if (!trimmed) return fallbackVersion;
      return trimmed.replace(/^v/i, "");
    };
    const applyVersion = (value) =>
      versionTargets.forEach((el) => {
        el.textContent = value;
      });
    fetch("assets/version.json", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data && data.version) {
          applyVersion(normalizeVersion(data.version));
        } else {
          applyVersion(fallbackVersion);
        }
      })
      .catch(() => {
        applyVersion(fallbackVersion);
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

  const currencySelect = document.getElementById("currencySelect");
  if (currencySelect) {
    currencySelect.value = currencyCode;
    on(currencySelect, "change", (e) => applyCurrencyChoice(e.target.value));
  }

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
  const setMenuState = (open) => {
    if (!sidebar || !overlay) return;
    const hideSidebar = !open;
    sidebar.classList.toggle("-translate-x-full", hideSidebar);
    const hideOverlay = hideSidebar || window.innerWidth >= 768;
    overlay.classList.toggle("hidden", hideOverlay);
    if (open && window.innerWidth < 768) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
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
            const selectedProfiles = profiles.filter((p) =>
              selectedIds.includes(String(p.id)),
            );
            if (selectedProfiles.length === 0) {
              showAlert("Select at least one profile to export.");
              return;
            }
            const hasAny = selectedProfiles.some(
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
              selectedProfiles.find((p) => p.id == activeProfile?.id)?.id ||
              selectedProfiles[0]?.id ||
              null;
            const dataToExport = {
              profiles: selectedProfiles,
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
  const fvDate = $("fvDate");
  if (fvDate) fvDate.min = new Date().toISOString().split("T")[0];
  // First-run welcome routing
  const seen = localStorage.getItem(LS.welcome) === "1";
  if (!seen && !isFirstTimeContentHidden()) {
    navigateTo("welcome");
    localStorage.setItem(LS.welcome, "1");
  } else {
    navigateTo("data-entry");
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
    const fetchLatestAppVersion = async () => {
      try {
        const response = await fetch("assets/version.json", { cache: "no-store" });
        if (!response || !response.ok) return null;
        const data = await response.json();
        if (!data || typeof data.version !== "string") return null;
        const trimmed = data.version.trim();
        if (!trimmed) return null;
        return trimmed.replace(/^v/i, "");
      } catch (_) {
        return null;
      }
    };
    const notifyUpdateComplete = async () => {
      const latestVersion = await fetchLatestAppVersion();
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
      const message = latestVersion
        ? `WealthTrack has been updated to version ${latestVersion}. Reload now to start using it.`
        : "WealthTrack has been updated. Reload now to use the latest version.";
      showAlert(message, () => window.location.reload());
    };
    if (!("serviceWorker" in navigator)) {
      resetButtonState();
      showAlert(
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
      if (!worker) return false;
      try {
        setBusyState("Downloading update…");
        await waitForInstalled(worker);
      } catch (err) {
        console.error("Update install failed", err);
        resetButtonState();
        showAlert("We couldn't finish installing the update. Please try again later.");
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
      } catch (err) {
        console.error("Update activation failed", err);
        resetButtonState();
        showAlert("We couldn't activate the update. Please try again later.");
        return true;
      }
      setBusyState("Finalizing update…");
      await controllerChange;
      await notifyUpdateComplete();
      return true;
    };

    setBusyState("Checking…");

    try {
      const registration = await waitForRegistration();
      if (!registration) {
        resetButtonState();
        showAlert("We couldn't reach the update service. Please refresh manually to check for updates.");
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
      const newWorker = await newWorkerPromise;
      if (newWorker) {
        await activateWorker(newWorker);
        return;
      }

      resetButtonState();
      showAlert("You're already using the latest version of WealthTrack.");
    } catch (error) {
      console.error("Update check failed", error);
      resetButtonState();
      showAlert("We couldn't complete the update check. Please try again later.");
    }
  }

  // Welcome buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    switch (btn.dataset.action) {
      case "start-now":
        localStorage.setItem(LS.onboardPending, "1");
        navigateTo("data-entry");
        break;
      case "focus-asset-form":
        {
          closeModal();
          navigateTo("data-entry");
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
          navigateTo("data-entry");
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
        navigateTo("data-entry");
        break;
      case "go-forecasts":
        closeModal();
        navigateTo("forecasts");
        break;
      case "go-insights":
        closeModal();
        navigateTo("portfolio-analysis");
        break;
      case "go-settings":
        closeModal();
        navigateTo("settings");
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
