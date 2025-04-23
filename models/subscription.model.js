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
    enum: ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "JPY"],
    default: "USD",
  },
  frequency: {
    type: String,
    required: [true, "Subscription Frequency is required"],
    enum: ["daily", "weekly", "monthly", "yearly", "other"],
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
    validate: {
      validator: function (value) {
        return value > this.startDate;
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

//auto-calculate renewal date based on frequency
SubscriptionSchema.pre("save", function (next) {
  if (!this.renewalDate) {
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
  if (this.renewalDate < new Date()) {	
    this.status = "expired";
  }

  next();
});

const Subscription = mongoose.model("Subscription", SubscriptionSchema);

export default Subscription;
