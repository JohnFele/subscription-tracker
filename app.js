import express from "express";
import { PORT } from "./config/env.js";
import userRouter from "./routes/user.routes.js";
import authRouter from "./routes/auth.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import connectDB from "./database/mongodb.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import cookieParser from "cookie-parser";
import arcjetMiddleware from "./middlewares/arcjet.middleware.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/api/v1/users', userRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/subscriptions', subscriptionRouter);

app.use(errorMiddleware);
app.use(arcjetMiddleware);

app.get("/", (req, res) => {
  res.send("Welcome to the Subscription tracker API");
});

connectDB()
.then(() => {
  app.listen(PORT, () => {
    console.log(`Subscription tracker API is running on port http://localhost:${PORT}`);
  });
})
.catch((error) => {
  console.error("Error starting server:", error);
  process.exit(1);
});