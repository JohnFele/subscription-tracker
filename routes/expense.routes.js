import { Router } from "express";
import authorize from "../middlewares/auth.middleware.js";
import { createExpense, getExpenses, getExpenditureSummary } from "../controllers/expense.controller.js";

const expenseRouter = Router();

expenseRouter.get("/summary", authorize, getExpenditureSummary);
expenseRouter.get("/", authorize, getExpenses);
expenseRouter.post("/", authorize, createExpense);

export default expenseRouter;
