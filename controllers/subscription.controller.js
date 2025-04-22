import Subscription from "../models/subscription.model.js";

export const createSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.create({ ...req.body, user : req.user._id });
    res.status(201).json({
      success: true,
      data:subscription,
      message: "Subscription created successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getAllSubscriptions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      Subscription.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Subscription.countDocuments({ user: req.user._id }),
    ]);
    
    res.status(200).json({
      success: true,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      data: subscriptions,
      message: "Subscriptions fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getSubscription = async (req, res, next) => {
  const { id } = req.params;
  try {
    const subscription = await Subscription.findOne({ _id: id, user: req.user._id });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    res.status(200).json({
      success: true,
      data: subscription,
      message: "Subscription fetched successfully",
    });

  } catch (error) {
    next(error);
  }
};

export const updateSubscription = async (req, res, next) => {
  const { id } = req.params;

  try {
    const subscription = await Subscription.findOneAndUpdate({ _id: id, user: req.user._id }, req.body, {
      new: true,
      runValidators: true,
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    res.status(200).json({
      success: true,
      data: subscription,
      message: "Subscription updated successfully",
    });

  } catch (error) {   
    next(error);
  }
}

export const deleteSubscription = async (req, res, next) => {
  const { id } = req.params;
  try {
    const subscription = await Subscription.findOneAndDelete({ _id: id, user: req.user._id });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    res.status(200).json({
      success: true,
      data: null,
      message: "Subscription deleted successfully",
    });

  } catch (error) {
    next(error);
  }
};

export const getUserSubscriptions = async (req, res, next) => {
  const { userId } = req.params;
  try {
    if (req.user.role !== "admin" && req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You are not authorized to view these subscriptions.",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      Subscription.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Subscription.countDocuments({ user: userId }),
    ]);
    
    if (subscriptions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No subscriptions found for this user",
      });
    }

    res.status(200).json({
      success: true,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      data: subscriptions,
      message: "Subscriptions fetched successfully",
    });

  } catch (error) {
    next(error);
  }
};

export const cancelSubscription = async (req, res, next) => {
  const { id } = req.params;
  try {
    const subscription = await Subscription.findById(id);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    if (
      req.user.role !== "admin" &&
      subscription.user.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You cannot cancel this subscription",
      });
    }

    if (subscription.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Subscription is already cancelled",
      });
    }

    subscription.status = "cancelled";
    await subscription.save();

    res.status(200).json({
      success: true,
      data: subscription,
      message: "Subscription cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getUpcomingSubscriptions = async (req, res, next) => {
  try {
    const today = new Date();

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([ 
      Subscription.find({ user: req.user._id, startDate: { $gte: today }})
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(limit),
      Subscription.countDocuments({ user: req.user._id, startDate: { $gte: today } }),
    ]);
    
    if (!subscriptions) {
      return res.status(404).json({
        success: false,
        message: "Upcoming subscriptions not found",
      });
    }
    res.status(200).json({
      success: true,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      data: subscriptions,
      message: "Upcoming subscriptions fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};
