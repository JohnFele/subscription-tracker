import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/env.js";
import User from "../models/user.model.js";

export const signUp = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create user
    const { name, email, password: userPassword, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      const error = new Error(`User with email ${email} already exists`);
      error.statusCode = 409;
      throw error;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userPassword, salt);

    // Create user
    const newUsers = await User.create(
      [{ name, email, password: hashedPassword, role }], { session }
    );

    const user = newUsers[0];
    
    // Create token
    const token = jwt.sign({ userId:user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    const { password: _, __v, ...userData } = user._doc;

    await session.commitTransaction();
    session.endSession();

    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 1000 * 60 * 60, // 1 hour
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        user: userData,
      },
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
};

export const signIn = async (req, res, next) => {
  const { email, password: userPassword } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      const error = new Error(`User with email ${email} not found`);
      error.statusCode = 404;
      throw error;
    }

    const isPasswordCorrect = await bcrypt.compare(userPassword, user.password);

    if (!isPasswordCorrect) {
      const error = new Error("Incorrect password");
      error.statusCode = 401;
      throw error;
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    const { password: _, __v, ...userData } = user._doc;

    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 1000 * 60 * 60, // 1 hour
    });

    res.status(200).json({
      success: true,
      message: "User signed in successfully",
      data: {
        userData,
      },
    });
    
  } catch (error) {
    next(error);
  }
};

export const signOut = async (req, res, next) => {
  try {
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({
      success: true,
      message: "User signed out successfully",
    });
  } catch (error) {
    next(error);
  }
};

// export const forgotPassword = async (req, res, next) => {};