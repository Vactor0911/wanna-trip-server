import express from "express";
import { limiter } from "../utils"; // 기존 rate limiter 사용
import {
  travelPlanChatbot,
  generateTravelPlan,
} from "../controllers/chatController";
import { authenticateToken } from "../middleware/authenticate";

const chatRoute = express.Router();

// 여행 계획 챗봇 대화
chatRoute.post(
  "/travel/chat",
  authenticateToken,
  limiter,
  travelPlanChatbot
);

// 여행 계획 최종 생성
chatRoute.post(
  "/travel/generate",
  authenticateToken,
  limiter,
  generateTravelPlan
);

export default chatRoute;
