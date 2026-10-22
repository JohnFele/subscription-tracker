import { NODE_ENV } from "./env.js";

const developmentOrigins = new Set([
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
]);

const productionOrigins = new Set([
  "https://johns-subscription-tracker.netlify.app",
]);

const allowedOrigins = NODE_ENV === "production"
  ? productionOrigins
  : developmentOrigins;

export default function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;

  if (origin) {
    res.vary("Origin");
  }

  if (origin && !allowedOrigins.has(origin)) {
    if (req.method === "OPTIONS") {
      return res.sendStatus(403);
    }

    return next();
  }

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.sendStatus(204);
  }

  next();
}
