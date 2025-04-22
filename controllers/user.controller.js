import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET, JWT_EXPIRES_IN, NODE_ENV } from "../config/env.js";

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json({ success: true, data: users });
  }catch (error) {
    next(error);
  }
};

export const getUser = async (req, res, next) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id).select("-password");

    if (!user) {
      const error = new Error(`User not found`);
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({ success: true, data: user });

  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "user",
    });

    res.status(201).json({
      success: true,
      message: "User created successfully by admin",
      data: {
        user: {
          _id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
      },
    });

  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    // 🔐 Authorization: only the user or an admin
    if (req.user._id.toString() !== id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this user",
      });
    }

    const { name, email, password, role } = req.body;
    const updateFields = {};

    if (name) updateFields.name = name;
    if (email) updateFields.email = email;

    if (role && req.user.role === "admin") {
      updateFields.role = role;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateFields.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await User.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    });

    const { password: _, __v, ...userData } = updatedUser._doc;

    res.clearCookie("accessToken");

    const newToken = jwt.sign(
      { userId: updatedUser._id, role: updatedUser.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.cookie("accessToken", newToken, {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 1000 * 60 * 60, // 1 hour
    });

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        user: userData,
      },
    });

  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  const { id } = req.params;
  const { confirm } = req.body;

  try {
    if (!confirm || confirm !== true) {
      return res.status(400).json({
        success: false,
        message: "Deletion not confirmed. Please send { confirm: true } in the request body.",
      });
    }

    if (req.user._id.toString() !== id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this user",
      });
    }

    if (req.user._id.toString() === id && req.user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admins cannot delete their own accounts",
      });
    }

    const userToDelete = await User.findById(id);
    if (!userToDelete) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    await User.findByIdAndDelete(id);

    if (req.user._id.toString() === id) {
      res.clearCookie("accessToken");
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });

  } catch (error) {
    next(error);
  }
};
