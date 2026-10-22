import { convertCurrency } from "../services/currency.service.js";

export const convertForUser = async (req, res, next) => {
  try {
    const { amount, fromCurrency, toCurrency } = req.body ?? {};
    const conversion = await convertCurrency(amount, fromCurrency, toCurrency ?? req.user.defaultCurrency ?? "ZAR");
    res.status(200).json({ success: true, data: conversion });
  } catch (error) {
    next(error);
  }
};
