import express from "express";
import { authenticateToken } from "../middleware/authenticate";
import { csrfProtection, limiter } from "../utils";
import { 
  createBoard, 
  deleteBoard,
  duplicateBoard,
  createBoardAfter,
  clearBoard
} from "../controllers/boardController";

const boardRoute = express.Router();

// CSRF 보호 미들웨어 적용
boardRoute.use(csrfProtection);

// 새 보드 생성 (맨 뒤에 생성)
boardRoute.post("/:templateUuid", limiter, authenticateToken, createBoard);

// 특정 보드 뒤에 새 보드 생성
boardRoute.post("/after/:boardId", limiter, authenticateToken, createBoardAfter);

// 보드 삭제
boardRoute.delete("/:boardId", limiter, authenticateToken, deleteBoard);

// 보드의 모든 카드 삭제 (보드는 유지)
boardRoute.delete("/:boardId/cards", limiter, authenticateToken, clearBoard);

// 보드 복제 (특정 보드 바로 뒤에 복제)
boardRoute.post("/duplicate/:boardId", limiter, authenticateToken, duplicateBoard);

export default boardRoute;