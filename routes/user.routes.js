import { Router } from "express";
import { createUser, getAllUsers, getUser, updateUser, deleteUser } from "../controllers/user.controller.js";
import authorize from "../middlewares/auth.middleware.js";
import restrictTo from "../middlewares/restrict.middleware.js";

const userRouter = Router();

userRouter.get("/", authorize, restrictTo("admin"), getAllUsers);

userRouter.get("/:id", authorize, getUser);

userRouter.post("/", authorize, restrictTo("admin"), createUser);

userRouter.put("/:id", authorize, updateUser);

userRouter.delete("/:id", authorize, deleteUser);

export default userRouter;
