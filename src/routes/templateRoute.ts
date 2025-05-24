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
import { csrfProtection } from "../utils";

const router = express.Router();

// 사용자 인증 필요한 라우트
router.use(authenticateToken);

// CSRF 보호 미들웨어 적용
router.use(csrfProtection);

// 템플릿 목록 조회
router.get("/", getUserTemplates);

// 새 템플릿 생성
router.post("/", createTemplate);

// 템플릿 삭제
router.delete("/:templateId", deleteTemplate);

// UUID로 특정 템플릿 조회 (프론트에서 URL 접근 시 사용)
router.get("/uuid/:templateUuid", getTemplateByUuid);

// 템플릿 상세 조회 - 미연동
router.get("/:templateId", getTemplateDetail);

// 템플릿 수정 - 미연동
router.put("/:templateId", updateTemplate);




export default router;