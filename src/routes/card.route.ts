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
import { validateBody, validateParams } from "../middleware/validation";
import {
  createCardSchema,
  deleteCardSchema,
  updateCardBodySchema,
  updateCardParamsSchema,
} from "../schema/card.schema";
import CardController from "../controllers/card.controller";

const router = express.Router();

// CSRF 보호 미들웨어 적용
router.use(csrfProtection);

// 새 카드 생성 및 복제
router.post(
  "/",
  limiter,
  authenticateToken,
  validateBody(createCardSchema),
  CardController.createCard
);

// 카드 수정 (텍스트 에디터 내용 업데이트 포함)
router.put(
  "/:cardUuid",
  limiter,
  authenticateToken,
  validateParams(updateCardParamsSchema),
  validateBody(updateCardBodySchema),
  CardController.updateCard
);

// 카드 삭제
router.delete(
  "/:cardUuid",
  limiter,
  authenticateToken,
  validateParams(deleteCardSchema),
  CardController.deleteCard
);

// 카드 이동
router.post("/move", limiter, authenticateToken, moveCard);

// 카드 ID로 위치 정보 조회
router.get(
  "/location/:cardId",
  limiter,
  authenticateToken,
  getLocationByCardId
);

export default router;
