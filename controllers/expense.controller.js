import Expense from "../models/expense.model.js";
import Subscription from "../models/subscription.model.js";
import { enrichSubscriptions } from "../services/currency.service.js";

const responseRecords = async (records, currency) => {
  const converted = await enrichSubscriptions(records.map(record => {
    const value = record.toObject ? record.toObject() : record;
    return { ...value, price: value.amount };
  }), currency);
  return converted.map(({ price, convertedPrice, convertedCurrency, conversionRate, rateUpdatedAt, ratesStale, ...record }) => ({
    ...record,
    convertedAmount: convertedPrice,
    convertedCurrency,
    conversionRate,
    rateUpdatedAt,
    ratesStale,
  }));
};

const dateKey = value => new Date(value).toISOString().slice(0, 10);
const advanceDateKey = (dateKeyValue, frequency) => {
  const next = new Date(`${dateKeyValue}T00:00:00.000Z`);
  if (frequency === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else if (frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else if (frequency === "monthly") {
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(Math.min(day, new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()));
  } else if (frequency === "yearly") {
    const month = next.getUTCMonth();
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCFullYear(next.getUTCFullYear() + 1);
    next.setUTCMonth(month);
    next.setUTCDate(Math.min(day, new Date(Date.UTC(next.getUTCFullYear(), month + 1, 0)).getUTCDate()));
  }
  return dateKey(next);
};
const monthKey = date => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const monthlyCost = subscription => subscription.recurring === false ? 0 : Number(subscription.convertedPrice) * ({ daily: 365 / 12, weekly: 52 / 12, monthly: 1, yearly: 1 / 12 }[subscription.frequency] ?? 0);

export const getExpenditureSummary = async (req, res, next) => {
  try {
    const currency = String(req.query.currency ?? req.user.defaultCurrency ?? "ZAR").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return res.status(400).json({ success: false, message: "Currency must be a three-letter ISO code" });

    const [rawExpenses, activeSubscriptions] = await Promise.all([
      Expense.find({ user: req.user._id }).sort({ date: 1, createdAt: 1 }),
      Subscription.find({ user: req.user._id, status: "active" }).sort({ renewalDate: 1 }),
    ]);
    const [expenses, subscriptions] = await Promise.all([
      responseRecords(rawExpenses, currency),
      enrichSubscriptions(activeSubscriptions, currency),
    ]);

    const today = new Date();
    const todayKey = dateKey(today);
    const currentYear = today.getUTCFullYear();
    const previousYear = currentYear - 1;
    const yearStart = `${currentYear}-01-01`;
    const previousYearStart = `${previousYear}-01-01`;
    const previousYearEnd = `${previousYear}-12-31`;
    const amountOf = expense => expense.convertedAmount ?? (expense.currency === currency ? Number(expense.amount) : null);
    let conversionIncomplete = subscriptions.some(subscription => subscription.recurring !== false && subscription.convertedPrice == null && subscription.currency !== currency);
    let priorYearActual = 0;
    let priorYearPayments = 0;
    let currentYearToDate = 0;
    let currentYearPayments = 0;
    let currentYearOneTime = 0;
    let currentYearSubscription = 0;
    let unconvertedExpenses = 0;
    const categoryTotals = new Map();
    const monthlyTotals = new Map();
    for (const expense of expenses) {
      const date = dateKey(expense.date);
      const amount = amountOf(expense);
      if (amount == null) { unconvertedExpenses++; conversionIncomplete = true; continue; }
      const month = date.slice(0, 7);
      const monthly = monthlyTotals.get(month) ?? { amount: 0, payments: 0, subscriptionAmount: 0, oneTimeAmount: 0 };
      monthly.amount += amount;
      monthly.payments++;
      if (expense.type === "subscription") monthly.subscriptionAmount += amount;
      else monthly.oneTimeAmount += amount;
      monthlyTotals.set(month, monthly);

      if (date >= previousYearStart && date <= previousYearEnd) { priorYearActual += amount; priorYearPayments++; }
      if (date >= yearStart && date <= todayKey) {
        currentYearToDate += amount;
        currentYearPayments++;
        if (expense.type === "subscription") currentYearSubscription += amount;
        else currentYearOneTime += amount;
        const category = expense.category ?? "other";
        const stats = categoryTotals.get(category) ?? { amount: 0, payments: 0 };
        stats.amount += amount;
        stats.payments++;
        categoryTotals.set(category, stats);
      }
    }

    const subscriptionPayments = expenses.filter(expense => expense.subscription);
    const paidOccurrences = new Set(subscriptionPayments.map(expense => `${String(expense.subscription)}:${dateKey(expense.date)}`));
    const subscriptionsWithPayments = new Set(subscriptionPayments.map(expense => String(expense.subscription)));
    const yearEndKey = `${currentYear}-12-31`;
    let remainingRecurring = 0;
    let nextMonthForecast = 0;
    let nextMonthNewSubscriptionCount = 0;
    let activeMonthlyCommitment = 0;
    const nowMonth = monthKey(today);
    const nextMonthDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    const nextMonthStartKey = `${monthKey(nextMonthDate)}-01`;
    const nextMonthEndKey = `${monthKey(nextMonthDate)}-${String(new Date(Date.UTC(nextMonthDate.getUTCFullYear(), nextMonthDate.getUTCMonth() + 1, 0)).getUTCDate()).padStart(2, "0")}`;

    for (const subscription of subscriptions) {
      if (subscription.recurring === false) continue;
      if (subscription.convertedPrice == null) { conversionIncomplete = true; continue; }
      const price = Number(subscription.convertedPrice);
      activeMonthlyCommitment += monthlyCost(subscription);
      let renewal = dateKey(subscription.renewalDate);
      let guard = 0;
      while (renewal < todayKey && guard < 500) {
        const advanced = advanceDateKey(renewal, subscription.frequency);
        if (advanced <= renewal) break;
        renewal = advanced;
        guard++;
      }
      while (renewal <= yearEndKey && guard < 600) {
        if (!paidOccurrences.has(`${String(subscription._id)}:${renewal}`)) remainingRecurring += price;
        const advanced = advanceDateKey(renewal, subscription.frequency);
        if (advanced <= renewal) break;
        renewal = advanced;
        guard++;
      }

      const created = subscription.createdAt ? dateKey(subscription.createdAt) : null;
      const hasPayment = subscriptionsWithPayments.has(String(subscription._id));
      if (created?.slice(0, 7) !== nowMonth || hasPayment) continue;
      let nextRenewal = dateKey(subscription.renewalDate);
      guard = 0;
      let hasNextMonthCharge = false;
      while (nextRenewal < nextMonthStartKey && guard < 500) {
        const advanced = advanceDateKey(nextRenewal, subscription.frequency);
        if (advanced <= nextRenewal) break;
        nextRenewal = advanced;
        guard++;
      }
      while (nextRenewal <= nextMonthEndKey && guard < 600) {
        if (nextRenewal >= nextMonthStartKey) { nextMonthForecast += price; hasNextMonthCharge = true; }
        const advanced = advanceDateKey(nextRenewal, subscription.frequency);
        if (advanced <= nextRenewal) break;
        nextRenewal = advanced;
        guard++;
      }
      if (hasNextMonthCharge) nextMonthNewSubscriptionCount++;
    }

    const chartMonths = Array.from({ length: 12 }, (_, index) => new Date(Date.UTC(currentYear, today.getUTCMonth() - 11 + index, 1))).map(date => {
      const key = monthKey(date);
      const month = monthlyTotals.get(key) ?? { amount: 0, payments: 0, subscriptionAmount: 0, oneTimeAmount: 0 };
      return {
        key,
        label: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date),
        axisLabel: `${new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date)}${date.getUTCMonth() === 0 ? ` '${String(date.getUTCFullYear()).slice(-2)}` : ""}`,
        fullLabel: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date),
        date: `${key}-01T00:00:00.000Z`,
        amount: month.amount,
        payments: month.payments,
        subscriptionAmount: month.subscriptionAmount,
        oneTimeAmount: month.oneTimeAmount,
        predicted: false,
      };
    });
    const upcomingMonth = {
      key: monthKey(nextMonthDate),
      label: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(nextMonthDate),
      axisLabel: `${new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(nextMonthDate)} *`,
      fullLabel: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(nextMonthDate),
      date: `${monthKey(nextMonthDate)}-01T00:00:00.000Z`,
      amount: nextMonthForecast,
      payments: 0,
      subscriptionAmount: nextMonthForecast,
      oneTimeAmount: 0,
      predicted: true,
    };
    const categories = [...categoryTotals.entries()].map(([category, stats]) => ({ category, ...stats, share: currentYearToDate ? stats.amount / currentYearToDate : 0 })).sort((a, b) => b.amount - a.amount);
    const remainingDaysInYear = Math.max(1, Math.ceil((Date.UTC(currentYear + 1, 0, 1) - Date.parse(`${todayKey}T00:00:00.000Z`)) / 86400000));
    res.status(200).json({
      success: true,
      data: {
        currency, currentYear, previousYear, asOf: todayKey,
        monthly: [...chartMonths, upcomingMonth],
        totals: {
          priorYearActual, priorYearPayments, currentYearToDate, currentYearPayments,
          currentYearOneTime, currentYearSubscription, remainingRecurring,
          currentYearForecast: currentYearToDate + remainingRecurring,
          nextMonthForecast, nextMonthNewSubscriptionCount,
          activeMonthlyCommitment,
          monthlyAverage: currentYearPayments ? currentYearToDate / Math.max(1, Math.min(today.getUTCMonth() + 1, 12)) : 0,
          averagePerPayment: currentYearPayments ? currentYearToDate / currentYearPayments : 0,
          daysRemainingInYear: remainingDaysInYear,
        },
        categories,
        conversionIncomplete,
        unconvertedExpenses,
        historyRecorded: expenses.length > 0,
      },
      message: "Expenditure summary fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getExpenses = async (req, res, next) => {
  try {
    const currency = String(req.query.currency ?? req.user.defaultCurrency ?? "ZAR").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return res.status(400).json({ success: false, message: "Currency must be a three-letter ISO code" });
    const filter = { user: req.user._id };
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(`${req.query.from}T00:00:00.000Z`);
      if (req.query.to) filter.date.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
    }
    const expenses = await Expense.find(filter).sort({ date: 1, createdAt: 1 });
    res.status(200).json({ success: true, data: await responseRecords(expenses, currency), message: "Expenses fetched successfully" });
  } catch (error) {
    next(error);
  }
};

const addFrequency = (date, frequency) => {
  const next = new Date(date);
  if (frequency === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else if (frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else if (frequency === "monthly") {
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(Math.min(day, new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()));
  } else if (frequency === "yearly") next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
};

export const createExpense = async (req, res, next) => {
  let expense;
  let subscription;
  let previousRenewalDate;
  try {
    const body = req.body ?? {};
    const subscriptionId = body.subscriptionId ? String(body.subscriptionId) : null;
    if (subscriptionId) {
      subscription = await Subscription.findOne({ _id: subscriptionId, user: req.user._id });
      if (!subscription) return res.status(404).json({ success: false, message: "Subscription not found" });
    }
    expense = await Expense.create({
      name: subscription?.name ?? body.name,
      amount: body.amount,
      currency: body.currency ?? subscription?.currency ?? req.user.defaultCurrency ?? "ZAR",
      category: body.category ?? subscription?.category ?? "other",
      date: body.date,
      type: subscription ? "subscription" : "one-time",
      subscription: subscription?._id ?? null,
      user: req.user._id,
    });

    if (subscription && subscription.recurring !== false && body.advanceRenewal === true) {
      previousRenewalDate = new Date(subscription.renewalDate);
      const paidAt = expense.date;
      const scheduledAt = subscription.renewalDate;
      const nextBase = paidAt > scheduledAt ? paidAt : scheduledAt;
      subscription.renewalDate = addFrequency(nextBase, subscription.frequency);
      await subscription.save();
    }

    const [record] = await responseRecords([expense], req.user.defaultCurrency ?? "ZAR");
    res.status(201).json({ success: true, data: record, message: "Expense recorded successfully" });
  } catch (error) {
    if (expense?._id) await Expense.deleteOne({ _id: expense._id }).catch(() => {});
    if (subscription && previousRenewalDate) {
      subscription.renewalDate = previousRenewalDate;
      await subscription.save().catch(() => {});
    }
    next(error);
  }
};
