import express from "express";
import { authenticateToken, optionalAuthenticate } from "../middleware/authenticate";
import { csrfProtection, limiter } from "../utils";
import TemplateController from "../controllers/template.controller";
import { validateBody, validateParams } from "../middleware/validation";
import {
  createTemplateSchema,
  deleteTemplateSchema,
  getTemplatePrivacySchema,
  getTemplateSchema,
  sortCardsSchema,
  updateTemplateBodySchema,
  updateTemplateParamsSchema,
  updateTemplatePrivacyBodySchema,
  updateTemplatePrivacyParamsSchema,
} from "../schema/template.schema";

const templateRouter = express.Router();

// CSRF 보호 미들웨어 적용
templateRouter.use(csrfProtection);

// 템플릿 공개 설정 조회
templateRouter.get(
  "/privacy/:templateUuid",
  limiter,
  authenticateToken,
  validateParams(getTemplatePrivacySchema),
  TemplateController.getTemplatePrivacy
)

// 인기 템플릿 조회
templateRouter.get("/popular", limiter, TemplateController.getPopularTemplates);

// UUID로 특정 템플릿 조회
templateRouter.get(
  "/:templateUuid",
  limiter,
  optionalAuthenticate,
  validateParams(getTemplateSchema),
  TemplateController.getTemplate
);

// 템플릿 목록 조회
templateRouter.get("/", limiter, authenticateToken, TemplateController.getTemplates);

// 새 템플릿 생성
templateRouter.post(
  "/",
  limiter,
  authenticateToken,
  validateBody(createTemplateSchema),
  TemplateController.createTemplate
);

// 템플릿 내 모든 보드의 카드 정렬하기
templateRouter.put(
  "/sort/:templateUuid",
  limiter,
  authenticateToken,
  csrfProtection,
  validateParams(sortCardsSchema),
  TemplateController.sortCards
);

// 템플릿 권한 설정 변경
templateRouter.put(
  "/privacy/:templateUuid",
  limiter,
  authenticateToken,
  csrfProtection,
  validateParams(updateTemplatePrivacyParamsSchema),
  validateBody(updateTemplatePrivacyBodySchema),
  TemplateController.updateTemplatePrivacy
)

// UUID로 템플릿 수정
templateRouter.put(
  "/:templateUuid",
  limiter,
  authenticateToken,
  csrfProtection,
  validateParams(updateTemplateParamsSchema),
  validateBody(updateTemplateBodySchema),
  TemplateController.updateTemplate
);

// 템플릿 삭제
templateRouter.delete(
  "/:templateUuid",
  limiter,
  authenticateToken,
  validateParams(deleteTemplateSchema),
  TemplateController.deleteTemplate
);

export default templateRouter;
