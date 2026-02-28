'use strict';

const GBP_CURRENCY = { locale: "en-GB", currency: "GBP", symbol: "£" };

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

const STUDENT_LOAN_PLANS = {
  none: { threshold: Infinity, rate: 0 },
  plan1: { threshold: 24990, rate: 0.09 },
  plan2: { threshold: 27295, rate: 0.09 },
  plan4: { threshold: 31295, rate: 0.09 },
  plan5: { threshold: 25000, rate: 0.09 },
  postgrad: { threshold: 21000, rate: 0.06 },
};

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

function toNonNegativeNumber(value, fallback = 0) {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

function formatPercent(value) {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num)) return "0%";
  const fixed = Math.abs(num) < 1 ? num.toFixed(2) : num.toFixed(1);
  const display = Number(fixed);
  return `${display}%`;
}

function getTaxBandConfig(band) {
  return TAX_BANDS[band] || TAX_BANDS.basic;
}

function getBandSummary(bandKey) {
  const band = getTaxBandConfig(bandKey);
  return `${band.label}: ${formatPercent(band.incomeRate)} income, ${formatPercent(
    band.dividendRate,
  )} dividends, ${formatPercent(band.capitalGainsRate)} capital gains`;
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

function calculatePersonalAllowance(code, grossAfterPension) {
  const allowance = getAllowanceFromTaxCode(code);
  const taperStart = 100000;
  const excess = Math.max(0, grossAfterPension - taperStart);
  const taperReduction = excess / 2;
  return Math.max(0, allowance - taperReduction);
}

function getAllowanceFromTaxCode(code) {
  const match = (code || "").toUpperCase().match(/(\d{1,5})/);
  const allowance = match ? Number.parseInt(match[1], 10) * 10 : 0;
  return Number.isFinite(allowance) && allowance > 0 ? allowance : 12570;
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

function parseCssNumber(value, fallback = 0) {
  if (typeof value !== "string") return fallback;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function normalizeAppVersion(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^v/i, "");
}

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

function getTaxYearConfig(yearValue) {
  const key = Number.parseInt(yearValue, 10);
  const base = TAX_YEAR_THRESHOLDS[DEFAULT_TAX_YEAR_KEY];
  if (Number.isFinite(key) && TAX_YEAR_THRESHOLDS[key]) {
    return { ...base, ...TAX_YEAR_THRESHOLDS[key], key };
  }
  return { ...base, key: DEFAULT_TAX_YEAR_KEY };
}

function randomNormal(mean = 0, std = 1) {
  const u1 = Math.random();
  const u2 = Math.random();
  const randStdNormal =
    Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * randStdNormal;
}

if (typeof module !== 'undefined') {
  module.exports = {
    fmtCurrency,
    fmtPercent,
    calculateUkIncomeTax,
    calculateUkNi,
    calculateStudentLoanRepayment,
    toNonNegativeNumber,
    formatPercent,
    getTaxBandConfig,
    getBandSummary,
    normalizeTaxTreatment,
    getTaxTreatmentMeta,
    normalizeTaxSettings,
    calculatePersonalAllowance,
    getAllowanceFromTaxCode,
    formatGrossNetRate,
    getGrossRate,
    parseCssNumber,
    formatDateForInput,
    formatChangelogDate,
    compareAppVersions,
    toAppVersionParts,
    normalizeAppVersion,
    calculateFutureValueFreq,
    getTaxYearConfig,
    randomNormal
  };
}
