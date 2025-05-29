import express from "express";
import { authenticateToken } from "../middleware/authenticate";
import {
  getUserTemplates,
  createTemplate,
  getTemplateDetail,
  updateTemplate,
  deleteTemplate,
  getTemplateByUuid,
} from "../controllers/templateController";
import { csrfProtection, limiter } from "../utils";

const router = express.Router();

// CSRF 보호 미들웨어 적용
router.use(csrfProtection);

// 템플릿 목록 조회
router.get("/", limiter, authenticateToken, getUserTemplates);

// 새 템플릿 생성
router.post("/", limiter, authenticateToken, createTemplate);

// 템플릿 삭제
router.delete("/:templateId", limiter, authenticateToken, deleteTemplate);

// UUID로 특정 템플릿 조회 (프론트에서 URL 접근 시 사용)
router.get("/uuid/:templateUuid", limiter, authenticateToken, getTemplateByUuid);

// // 템플릿 상세 조회 - 미연동
// router.get("/:templateId", getTemplateDetail);

// // 템플릿 수정 - 미연동
// router.put("/:templateId", updateTemplate);




export default router;