import express from "express";
import { authenticateToken } from "../middleware/authenticate";
import { csrfProtection, limiter } from "../utils";
import {
  addCard,
  deleteCard,
  updateCard,
  moveCard,
  getLocationByCardId,
} from "../controllers/cardController";

const router = express.Router();

// CSRF 보호 미들웨어 적용
router.use(csrfProtection);

// 새 카드 생성
router.post("/add/:boardId/:index?", limiter, authenticateToken, addCard);

// 카드 수정 (텍스트 에디터 내용 업데이트 포함)
router.put("/:cardId", limiter, authenticateToken, updateCard);

// 카드 삭제
router.delete("/:cardId", limiter, authenticateToken, deleteCard);

// 카드 이동
router.post("/move", limiter, authenticateToken, moveCard);

// 카드 ID로 위치 정보 조회
router.get("/location/:cardId", limiter, authenticateToken, getLocationByCardId);

// // 카드 조회
// router.get("/:cardId", limiter, authenticateToken, getCard);

// // 카드 순서 변경
// router.put("/reorder/:boardId", limiter, authenticateToken, reorderCards);

// // 카드 검색
// router.get("/search/:templateId", limiter, authenticateToken, searchCards);


export default router;