import express from "express";
import { authenticateToken } from "../middleware/authenticate";
import { csrfProtection, limiter } from "../utils";
import BoardController from "../controllers/board.controller";
import { validateBody, validateParams } from "../middleware/validation";
import {
  copyBoardSchema,
  createBoardSchema,
  deleteBoardSchema,
  moveBoardSchema,
  sortCardsSchema,
} from "../schema/board.schema";

const boardRoute = express.Router();

// CSRF 보호 미들웨어 적용
boardRoute.use(csrfProtection);

// 보드 복제 (특정 보드 바로 뒤에 복제)
boardRoute.post(
  "/copy/:boardUuid",
  limiter,
  authenticateToken,
  validateParams(copyBoardSchema),
  BoardController.copyBoard
);

// 보드 이동
boardRoute.post(
  "/move",
  limiter,
  authenticateToken,
  validateBody(moveBoardSchema),
  BoardController.moveBoard
);

// 보드 생성 및 삽입
boardRoute.post(
  "/",
  limiter,
  authenticateToken,
  validateBody(createBoardSchema),
  BoardController.createBoard
);

// 보드 내 카드 정렬
boardRoute.put(
  "/sort/:boardUuid",
  limiter,
  authenticateToken,
  csrfProtection,
  validateParams(sortCardsSchema),
  BoardController.sortCards
);

// 보드 삭제
boardRoute.delete(
  "/:boardUuid",
  limiter,
  authenticateToken,
  validateParams(deleteBoardSchema),
  BoardController.deleteBoard
);

export default boardRoute;
