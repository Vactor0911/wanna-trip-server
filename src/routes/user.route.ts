import express from "express";
import { csrfProtection, limiter } from "../utils";
import { authenticateToken } from "../middleware/authenticate";
import UserController from "../controllers/user.controller";
import { validateBody } from "../middleware/validation";
import { searchUsersSchema } from "../schema/user.schema";

const userRouter = express.Router();

// CSRF 보호 미들웨어 적용
userRouter.use(csrfProtection);

// 사용자 검색
userRouter.post(
  "/search",
  limiter,
  authenticateToken,
  validateBody(searchUsersSchema),
  UserController.searchUsers
);

export default userRouter;
