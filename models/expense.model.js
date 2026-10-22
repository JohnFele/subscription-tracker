import mongoose from "mongoose";

const ExpenseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Expense name is required"],
    trim: true,
    minLength: 1,
    maxLength: 100,
  },
  amount: {
    type: Number,
    required: [true, "Expense amount is required"],
    min: [0.01, "Expense amount must be greater than 0"],
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    match: [/^[A-Z]{3}$/, "Expense currency must be a three-letter ISO code"],
  },
  category: {
    type: String,
    required: true,
    enum: [
      "entertainment", "sports", "news", "food", "health", "fitness", "education",
      "technology", "travel", "productivity", "communication", "utilities", "shopping",
      "finance", "home", "lifestyle", "other",
    ],
  },
  date: {
    type: Date,
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: ["subscription", "one-time"],
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subscription",
    default: null,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
}, { timestamps: true });

ExpenseSchema.index({ user: 1, date: 1 });
ExpenseSchema.index(
  { user: 1, subscription: 1, date: 1 },
  { unique: true, partialFilterExpression: { subscription: { $type: "objectId" } } },
);

const Expense = mongoose.model("Expense", ExpenseSchema);

export default Expense;
