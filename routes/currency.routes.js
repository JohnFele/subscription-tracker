import { Router } from "express";
import authorize from "../middlewares/auth.middleware.js";
import { convertForUser } from "../controllers/currency.controller.js";

const currencyRouter = Router();
currencyRouter.post("/convert", authorize, convertForUser);

export default currencyRouter;
