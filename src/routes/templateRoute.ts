import express from "express";
import { authenticateToken } from "../middleware/authenticate";
import {
  getUserTemplates,
  createTemplate,
  deleteTemplate,
  getTemplateByUuid,
  updateTemplateByUuid,
  getPopularTemplates,
  sortTemplateCards,
} from "../controllers/templateController";
import { csrfProtection, limiter } from "../utils";
import TemplateController from "../controllers/template.controller";

const router = express.Router();

// CSRF 보호 미들웨어 적용
router.use(csrfProtection);

// 템플릿 목록 조회
router.get("/", limiter, authenticateToken, TemplateController.getTemplates);

// UUID로 특정 템플릿 조회
router.get("/:templateUuid", limiter, authenticateToken, TemplateController.getTemplate);

// 새 템플릿 생성
router.post("/", limiter, authenticateToken, TemplateController.createTemplate);

// 템플릿 삭제
router.delete("/:templateUuid", limiter, authenticateToken, TemplateController.deleteTemplate);

// UUID로 템플릿 수정
router.put("/:templateUuid", limiter, authenticateToken, csrfProtection, TemplateController.updateTemplate);

// 인기 템플릿 조회 - 로그인 필요 없음 (공개 API)
router.get("/popular", limiter, getPopularTemplates);

// 템플릿 내 모든 보드의 카드 정렬하기
router.post("/uuid/:templateUuid/sort", limiter, authenticateToken, csrfProtection, sortTemplateCards);



export default router;