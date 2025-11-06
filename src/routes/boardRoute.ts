import express from "express";
import { authenticateToken } from "../middleware/authenticate";
import { csrfProtection, limiter } from "../utils";
import { 
  createBoard, 
  deleteBoard,
  duplicateBoard,
  createBoardAfter,
  clearBoard,
  moveBoard,
  sortBoardCards,
} from "../controllers/boardController";
import BoardController from "../controllers/board.controller";

const boardRoute = express.Router();

// CSRF 보호 미들웨어 적용
boardRoute.use(csrfProtection);

// 보드 이동
boardRoute.post("/move", limiter, authenticateToken, moveBoard);

// 보드 생성 및 삽입
boardRoute.post("/", limiter, authenticateToken, BoardController.createBoard);

// 보드 삭제
boardRoute.delete("/:boardUuid", limiter, authenticateToken, BoardController.deleteBoard);

// 보드의 모든 카드 삭제 (보드는 유지)
boardRoute.delete("/:boardId/cards", limiter, authenticateToken, clearBoard);

// 보드 복제 (특정 보드 바로 뒤에 복제)
boardRoute.post("/duplicate/:boardId", limiter, authenticateToken, duplicateBoard);

// 보드 내 카드 정렬
boardRoute.post("/:boardId/sort", limiter, authenticateToken, csrfProtection, sortBoardCards);


export default boardRoute;