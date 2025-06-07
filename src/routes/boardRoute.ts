import express from "express";
import { authenticateToken } from "../middleware/authenticate";
import { csrfProtection, limiter } from "../utils";
import { 
  createBoard, 
  updateBoard, 
  deleteBoard,
  getBoardDetail,
  reorderBoards,
  duplicateBoard,
  createBoardAfter
} from "../controllers/boardController";

const boardRoute = express.Router();

// CSRF 보호 미들웨어 적용
boardRoute.use(csrfProtection);

// 새 보드 생성 (맨 뒤에 생성)
boardRoute.post("/:templateId", limiter, authenticateToken, createBoard);

// 특정 보드 뒤에 새 보드 생성
boardRoute.post("/after/:boardId", limiter, authenticateToken, createBoardAfter);

// 보드 정보 조회
boardRoute.get("/:boardId", limiter, authenticateToken, getBoardDetail);

// 보드 수정
boardRoute.put("/:boardId", limiter, authenticateToken, updateBoard);

// 보드 삭제
boardRoute.delete("/:boardId", limiter, authenticateToken, deleteBoard);

// 보드 순서 변경
boardRoute.put("/reorder/:templateId", limiter, authenticateToken, reorderBoards);

// 보드 복제 (특정 보드 바로 뒤에 복제)
boardRoute.post("/duplicate/:boardId", limiter, authenticateToken, duplicateBoard);

export default boardRoute;