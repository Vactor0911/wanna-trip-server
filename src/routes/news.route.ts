import express from "express";
import { authenticateToken } from "../middleware/authenticate";
import { csrfProtection, limiter } from "../utils";
import NewsController from "../controllers/news.controller";
import { validateBody, validateParams, validateQuery } from "../middleware/validation";
import {
  createNewsSchema,
  updateNewsSchema,
  newsUuidParamSchema,
  newsListQuerySchema,
} from "../schema/news.schema";

const newsRoute = express.Router();

// 공지사항 목록 조회 (비로그인 가능)
newsRoute.get(
  "/",
  limiter,
  validateQuery(newsListQuerySchema),
  NewsController.getNewsList
);

// 공지사항 상세 조회 (비로그인 가능)
newsRoute.get(
  "/:newsUuid",
  limiter,
  validateParams(newsUuidParamSchema),
  NewsController.getNewsById
);

// 공지사항 생성 (관리자 전용)
newsRoute.post(
  "/",
  limiter,
  authenticateToken,
  csrfProtection,
  validateBody(createNewsSchema),
  NewsController.createNews
);

// 공지사항 수정 (관리자 전용)
newsRoute.put(
  "/:newsUuid",
  limiter,
  authenticateToken,
  csrfProtection,
  validateParams(newsUuidParamSchema),
  validateBody(updateNewsSchema),
  NewsController.updateNews
);

// 공지사항 삭제 (관리자 전용)
newsRoute.delete(
  "/:newsUuid",
  limiter,
  authenticateToken,
  csrfProtection,
  validateParams(newsUuidParamSchema),
  NewsController.deleteNews
);

export default newsRoute;
