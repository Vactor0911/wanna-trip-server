import express from "express";
import { authenticateToken, optionalAuthenticate } from "../middleware/authenticate";
import { csrfProtection, limiter } from "../utils";
import TemplateController from "../controllers/template.controller";
import { validateBody, validateParams } from "../middleware/validation";
import {
  createTemplateSchema,
  deleteTemplateSchema,
  bulkDeleteTemplatesSchema,
  getTemplatePrivacySchema,
  getTemplateSchema,
  sortCardsSchema,
  updateTemplateBodySchema,
  updateTemplateParamsSchema,
  updateTemplatePrivacyBodySchema,
  updateTemplatePrivacyParamsSchema,
  copyTemplateParamsSchema,
  copyTemplateBodySchema,
  copyBoardParamsSchema,
  copyBoardBodySchema,
  copyCardParamsSchema,
  copyCardBodySchema,
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

// 인기 공개 템플릿 조회 (퍼가기 횟수 기준)
templateRouter.get("/popular/public", limiter, TemplateController.getPopularPublicTemplates);

// 공개 템플릿 조회 (비로그인 사용자용)
templateRouter.get(
  "/public/:templateUuid",
  limiter,
  validateParams(getTemplateSchema),
  TemplateController.getPublicTemplate
);

// 공유 받은 템플릿 목록 조회
templateRouter.get(
  "/shared",
  limiter,
  authenticateToken,
  TemplateController.getSharedTemplates
);

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

// 템플릿 복사
templateRouter.post(
  "/copy/:sourceTemplateUuid",
  limiter,
  authenticateToken,
  validateParams(copyTemplateParamsSchema),
  validateBody(copyTemplateBodySchema),
  TemplateController.copyTemplate
);

// 보드 복사
templateRouter.post(
  "/board/copy/:sourceBoardUuid",
  limiter,
  authenticateToken,
  validateParams(copyBoardParamsSchema),
  validateBody(copyBoardBodySchema),
  TemplateController.copyBoard
);

// 카드 복사
templateRouter.post(
  "/card/copy/:sourceCardUuid",
  limiter,
  authenticateToken,
  validateParams(copyCardParamsSchema),
  validateBody(copyCardBodySchema),
  TemplateController.copyCard
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

// 템플릿 일괄 삭제
templateRouter.post(
  "/bulk-delete",
  limiter,
  authenticateToken,
  validateBody(bulkDeleteTemplatesSchema),
  TemplateController.bulkDeleteTemplates
);

export default templateRouter;
