import { Socket } from "socket.io";
import { getSocketIO } from "./index";

// 사용자별 소켓 연결 관리
const userSockets = new Map<string, Set<string>>();

class NotificationSocket {
  /**
   * 사용자 알림 Room 참가
   * @param socket 소켓 객체
   */
  static joinNotificationRoom(socket: Socket) {
    const userUuid = socket.data.userUuid;
    if (!userUuid) return;

    // 사용자 알림 Room 참가
    socket.join(`user:${userUuid}`);

    // 사용자 소켓 매핑 추가
    if (!userSockets.has(userUuid)) {
      userSockets.set(userUuid, new Set());
    }
    userSockets.get(userUuid)?.add(socket.id);
  }

  /**
   * 사용자 알림 Room 퇴장
   * @param socket 소켓 객체
   */
  static leaveNotificationRoom(socket: Socket) {
    const userUuid = socket.data.userUuid;
    if (!userUuid) return;

    // 사용자 알림 Room 퇴장
    socket.leave(`user:${userUuid}`);

    // 사용자 소켓 매핑 제거
    const sockets = userSockets.get(userUuid);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userSockets.delete(userUuid);
      }
    }
  }

  /**
   * 특정 사용자에게 알림 전송
   * @param userUuid 사용자 UUID
   * @param notification 알림 데이터
   */
  static sendNotification(
    userUuid: string,
    notification: {
      notificationUuid: string;
      type: string;
      title: string;
      message: string;
      targetType?: string;
      targetUuid?: string;
      actorUuid?: string;
      actorName?: string;
      actorProfileImage?: string;
      metadata?: Record<string, any>;
      createdAt: string;
    }
  ) {
    try {
      const io = getSocketIO();
      io.to(`user:${userUuid}`).emit("notification:new", notification);
    } catch (error) {
      console.error("[Notification] Failed to send notification:", error);
    }
  }

  /**
   * 읽지 않은 알림 개수 업데이트 전송
   * @param userUuid 사용자 UUID
   * @param count 읽지 않은 알림 개수
   */
  static sendUnreadCountUpdate(userUuid: string, count: number) {
    try {
      const io = getSocketIO();
      io.to(`user:${userUuid}`).emit("notification:unread-count", { count });
    } catch (error) {
      console.error("[Notification] Failed to send unread count:", error);
    }
  }

  /**
   * 사용자가 온라인인지 확인
   * @param userUuid 사용자 UUID
   * @returns 온라인 여부
   */
  static isUserOnline(userUuid: string): boolean {
    const sockets = userSockets.get(userUuid);
    return sockets !== undefined && sockets.size > 0;
  }

  /**
   * 온라인 사용자 목록 조회
   * @returns 온라인 사용자 UUID 목록
   */
  static getOnlineUsers(): string[] {
    return Array.from(userSockets.keys());
  }
}

export default NotificationSocket;
