import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import NotificationService from "../services/notification.service";

class NotificationController {
  /**
   * 알림 목록 조회
   */
  static getNotifications = asyncHandler(
    async (req: Request, res: Response) => {
      const userUuid = req.user?.userUuid;

      if (!userUuid) {
        res.status(401).json({
          success: false,
          message: "로그인이 필요합니다.",
        });
        return;
      }

      const { page, limit, unreadOnly } = req.query;

      const result = await NotificationService.getNotifications(userUuid, {
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
        unreadOnly: unreadOnly === "true",
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    }
  );

  /**
   * 읽지 않은 알림 개수 조회
   */
  static getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
    const userUuid = req.user?.userUuid;

    if (!userUuid) {
      res.status(401).json({
        success: false,
        message: "로그인이 필요합니다.",
      });
      return;
    }

    const result = await NotificationService.getUnreadCount(userUuid);

    res.status(200).json({
      success: true,
      ...result,
    });
  });

  /**
   * 알림 읽음 처리
   */
  static markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userUuid = req.user?.userUuid;
    const { notificationUuid } = req.params;

    if (!userUuid) {
      res.status(401).json({
        success: false,
        message: "로그인이 필요합니다.",
      });
      return;
    }

    if (!notificationUuid) {
      res.status(400).json({
        success: false,
        message: "알림 UUID가 필요합니다.",
      });
      return;
    }

    try {
      await NotificationService.markAsRead(notificationUuid, userUuid);

      res.status(200).json({
        success: true,
        message: "알림을 읽음 처리했습니다.",
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message || "알림을 찾을 수 없습니다.",
      });
    }
  });

  /**
   * 모든 알림 읽음 처리
   */
  static markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userUuid = req.user?.userUuid;

    if (!userUuid) {
      res.status(401).json({
        success: false,
        message: "로그인이 필요합니다.",
      });
      return;
    }

    const result = await NotificationService.markAllAsRead(userUuid);

    res.status(200).json({
      success: true,
      message: `${result.count}개의 알림을 읽음 처리했습니다.`,
      count: result.count,
    });
  });

  /**
   * 알림 삭제
   */
  static deleteNotification = asyncHandler(
    async (req: Request, res: Response) => {
      const userUuid = req.user?.userUuid;
      const { notificationUuid } = req.params;

      if (!userUuid) {
        res.status(401).json({
          success: false,
          message: "로그인이 필요합니다.",
        });
        return;
      }

      if (!notificationUuid) {
        res.status(400).json({
          success: false,
          message: "알림 UUID가 필요합니다.",
        });
        return;
      }

      try {
        await NotificationService.deleteNotification(
          notificationUuid,
          userUuid
        );

        res.status(200).json({
          success: true,
          message: "알림이 삭제되었습니다.",
        });
      } catch (error: any) {
        res.status(404).json({
          success: false,
          message: error.message || "알림을 찾을 수 없습니다.",
        });
      }
    }
  );

  /**
   * 모든 알림 삭제
   */
  static deleteAllNotifications = asyncHandler(
    async (req: Request, res: Response) => {
      const userUuid = req.user?.userUuid;

      if (!userUuid) {
        res.status(401).json({
          success: false,
          message: "로그인이 필요합니다.",
        });
        return;
      }

      const result = await NotificationService.deleteAllNotifications(
        userUuid
      );

      res.status(200).json({
        success: true,
        message: `${result.count}개의 알림이 삭제되었습니다.`,
        count: result.count,
      });
    }
  );

  /**
   * 읽은 알림 삭제
   */
  static deleteReadNotifications = asyncHandler(
    async (req: Request, res: Response) => {
      const userUuid = req.user?.userUuid;

      if (!userUuid) {
        res.status(401).json({
          success: false,
          message: "로그인이 필요합니다.",
        });
        return;
      }

      const result = await NotificationService.deleteReadNotifications(
        userUuid
      );

      res.status(200).json({
        success: true,
        message: `${result.count}개의 읽은 알림이 삭제되었습니다.`,
        count: result.count,
      });
    }
  );
}

export default NotificationController;
