const RATE_URL = "https://open.er-api.com/v6/latest/USD";
let cachedRates = null;
let pendingRates = null;
let retryAfter = 0;

async function loadRates() {
  if (cachedRates && Date.now() < cachedRates.expiresAt) return cachedRates;
  if (cachedRates && Date.now() < retryAfter) return { ...cachedRates, stale: true };
  if (pendingRates) return pendingRates;

  pendingRates = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(RATE_URL, { signal: controller.signal });
      if (!response.ok) throw new Error(`Exchange rate provider returned ${response.status}`);
      const payload = await response.json();
      if (payload?.result !== "success" || payload?.base_code !== "USD" || !payload?.rates || typeof payload.rates !== "object") {
        throw new Error("Exchange rate provider returned an invalid response");
      }

      const rates = Object.fromEntries(Object.entries(payload.rates)
        .filter(([code, rate]) => /^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0));
      if (rates.USD !== 1 || !payload.time_next_update_unix) throw new Error("Exchange rate data is incomplete");

      cachedRates = {
        rates,
        updatedAt: payload.time_last_update_utc ?? new Date().toISOString(),
        expiresAt: Math.max(Date.now() + 60_000, Number(payload.time_next_update_unix) * 1000),
        stale: false,
      };
      retryAfter = 0;
      return cachedRates;
    } catch (error) {
      if (cachedRates) {
        retryAfter = Date.now() + 10 * 60 * 1000;
        return { ...cachedRates, stale: true };
      }
      const unavailable = new Error("Currency conversion is temporarily unavailable");
      unavailable.statusCode = 503;
      throw unavailable;
    } finally {
      clearTimeout(timeout);
    }
  })();
  try {
    return await pendingRates;
  } finally {
    pendingRates = null;
  }
}

export async function convertCurrency(amount, fromCurrency, toCurrency) {
  const value = Number(amount);
  const from = String(fromCurrency ?? "").trim().toUpperCase();
  const to = String(toCurrency ?? "").trim().toUpperCase();
  if (amount === null || amount === "" || typeof amount === "boolean" || !Number.isFinite(value) || value < 0) {
    const error = new Error("Amount must be a non-negative number");
    error.statusCode = 400;
    throw error;
  }
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    const error = new Error("Currencies must be three-letter ISO codes");
    error.statusCode = 400;
    throw error;
  }
  if (from === to) return { amount: value, fromCurrency: from, toCurrency: to, convertedAmount: value, rate: 1, rateUpdatedAt: null, stale: false };

  const data = await loadRates();
  const sourceRate = data.rates[from];
  const targetRate = data.rates[to];
  if (!sourceRate || !targetRate) {
    const error = new Error(`Exchange rates are not available for ${!sourceRate ? from : to}`);
    error.statusCode = 422;
    throw error;
  }
  const rate = targetRate / sourceRate;
  return {
    amount: value,
    fromCurrency: from,
    toCurrency: to,
    convertedAmount: value * rate,
    rate,
    rateUpdatedAt: data.updatedAt,
    stale: data.stale,
  };
}

export async function enrichSubscriptions(subscriptions, defaultCurrency = "ZAR") {
  const records = subscriptions.map(subscription => subscription.toObject ? subscription.toObject() : subscription);
  const target = String(defaultCurrency ?? "ZAR").toUpperCase();
  if (records.every(record => String(record.currency ?? "").toUpperCase() === target)) {
    return records.map(record => ({ ...record, convertedPrice: Number(record.price), convertedCurrency: target, conversionRate: 1, rateUpdatedAt: null, ratesStale: false }));
  }
  let rates;
  try {
    rates = await loadRates();
  } catch {
    return records.map(record => {
      const source = String(record.currency ?? "").toUpperCase();
      return { ...record, convertedPrice: source === target ? Number(record.price) : null, convertedCurrency: target, conversionRate: source === target ? 1 : null, rateUpdatedAt: null, ratesStale: true };
    });
  }

  return records.map(record => {
    const source = String(record.currency ?? "").toUpperCase();
    const sourceRate = rates.rates[source];
    const targetRate = rates.rates[target];
    const conversionRate = sourceRate && targetRate ? targetRate / sourceRate : null;
    return {
      ...record,
      convertedPrice: conversionRate === null ? (source === target ? Number(record.price) : null) : Number(record.price) * conversionRate,
      convertedCurrency: target,
      conversionRate,
      rateUpdatedAt: rates.updatedAt,
      ratesStale: rates.stale,
    };
  });
}
