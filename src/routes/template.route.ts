import express from "express";
import { authenticateToken } from "../middleware/authenticate";
import { csrfProtection, limiter } from "../utils";
import TemplateController from "../controllers/template.controller";
import { validateBody, validateParams } from "../middleware/validation";
import {
  createTemplateSchema,
  deleteTemplateSchema,
  getTemplateSchema,
  updateTemplateBodySchema,
  updateTemplateParamsSchema,
} from "../schema/template.schema";

const router = express.Router();

// CSRF 보호 미들웨어 적용
router.use(csrfProtection);

// 템플릿 목록 조회
router.get("/", limiter, authenticateToken, TemplateController.getTemplates);

// 인기 템플릿 조회
router.get("/popular", limiter, TemplateController.getPopularTemplates);

// UUID로 특정 템플릿 조회
router.get(
  "/:templateUuid",
  limiter,
  authenticateToken,
  validateParams(getTemplateSchema),
  TemplateController.getTemplate
);

// 새 템플릿 생성
router.post(
  "/",
  limiter,
  authenticateToken,
  validateBody(createTemplateSchema),
  TemplateController.createTemplate
);

// 템플릿 삭제
router.delete(
  "/:templateUuid",
  limiter,
  authenticateToken,
  validateParams(deleteTemplateSchema),
  TemplateController.deleteTemplate
);

// UUID로 템플릿 수정
router.put(
  "/:templateUuid",
  limiter,
  authenticateToken,
  csrfProtection,
  validateParams(updateTemplateParamsSchema),
  validateBody(updateTemplateBodySchema),
  TemplateController.updateTemplate
);

// 템플릿 내 모든 보드의 카드 정렬하기
// router.post(
//   "/uuid/:templateUuid/sort",
//   limiter,
//   authenticateToken,
//   csrfProtection,
//   sortTemplateCards
// );

export default router;
