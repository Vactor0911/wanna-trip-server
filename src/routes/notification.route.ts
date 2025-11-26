import express from "express";
import { csrfProtection, limiter } from "../utils";
import { authenticateToken } from "../middleware/authenticate";
import NotificationController from "../controllers/notification.controller";

const notificationRoute = express.Router();

// CSRF 보호 미들웨어 적용
notificationRoute.use(csrfProtection);

// 알림 목록 조회
// GET /notification?page=1&limit=20&unreadOnly=false
notificationRoute.get(
  "/",
  limiter,
  authenticateToken,
  NotificationController.getNotifications
);

// 읽지 않은 알림 개수 조회
// GET /notification/unread-count
notificationRoute.get(
  "/unread-count",
  limiter,
  authenticateToken,
  NotificationController.getUnreadCount
);

// 모든 알림 읽음 처리
// PATCH /notification/read-all
notificationRoute.patch(
  "/read-all",
  limiter,
  authenticateToken,
  NotificationController.markAllAsRead
);

// 알림 읽음 처리
// PATCH /notification/:notificationUuid/read
notificationRoute.patch(
  "/:notificationUuid/read",
  limiter,
  authenticateToken,
  NotificationController.markAsRead
);

// 읽은 알림 삭제
// DELETE /notification/read
notificationRoute.delete(
  "/read",
  limiter,
  authenticateToken,
  NotificationController.deleteReadNotifications
);

// 모든 알림 삭제
// DELETE /notification/all
notificationRoute.delete(
  "/all",
  limiter,
  authenticateToken,
  NotificationController.deleteAllNotifications
);

// 알림 삭제
// DELETE /notification/:notificationUuid
notificationRoute.delete(
  "/:notificationUuid",
  limiter,
  authenticateToken,
  NotificationController.deleteNotification
);

export default notificationRoute;
