import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Subscription Name is required"],
    trim: true,
    minLength: 3,
    maxLength: 100,
  },
  price: {
    type: Number,
    required: [true, "Subscription Price is required"],
    min: [0, "Subscription Price must be greater than 0"],
  },
  currency: {
    type: String,
    required: [true, "Subscription Currency is required"],
    uppercase: true,
    match: [/^[A-Z]{3}$/, "Subscription Currency must be a three-letter ISO code"],
    default: "ZAR",
  },
  recurring: {
    type: Boolean,
    default: true,
  },
  frequency: {
    type: String,
    required: function () { return this.recurring !== false; },
    enum: ["daily", "weekly", "monthly", "yearly"],
  },
  category: {
    type: String,
    required: [true, "Subscription Category is required"],
    enum: [
      "entertainment",
      "sports",
      "news",
      "food",
      "health",
      "fitness",
      "education",
      "technology",
      "travel",
      "productivity",
      "communication",
      "utilities",
      "shopping",
      "finance",
      "home",
      "lifestyle",
      "other",
    ],
  },
  paymentMethod: {
    type: String,
    required: [true, "Subscription Payment Method is required"],
    trim: true,
    // enum: ["credit card", "paypal", "bank transfer", "other"],
  },
  status: {
    type: String,
    required: true,
    enum: ["active", "expired", "cancelled", "inactive"],
    default: "active",
  },
  startDate: {
    type: Date,
    required: [true, "Subscription Start Date is required"],
    validate: {
      validator: function (value) {
        return value <= new Date();
      },
      message: "Start date must be in the past or present",
    },
    default: Date.now,
  },
  renewalDate: {
    type: Date,
    required: function () { return this.recurring !== false; },
    validate: {
      validator: function (value) {
        return this.recurring === false || (value && value > this.startDate);
      },
      message: "Renewal date must be after the start date",
    },
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "User ID is required"],
    index: true,
  },
}, { timestamps: true });

// Auto-calculate renewal dates only for recurring subscriptions.
SubscriptionSchema.pre("save", function (next) {
  if (this.recurring !== false && !this.renewalDate) {
    const frequencyMap = {
      daily: 1,
      weekly: 7,
      monthly: 30,
      yearly: 365,
    };
    this.renewalDate = new Date(this.startDate);
    this.renewalDate.setDate(this.renewalDate.getDate() + frequencyMap[this.frequency]);
  }

  //auto-update the status of the subscription if the renewal date has passed
  if (this.recurring !== false && this.renewalDate < new Date()) {
    this.status = "expired";
  }

  next();
});

const Subscription = mongoose.model("Subscription", SubscriptionSchema);

export default Subscription;
