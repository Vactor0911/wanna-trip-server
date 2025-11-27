import { Pool, PoolConnection } from "mariadb";

// 알림 유형
export type NotificationType =
  | "comment"
  | "reply"
  | "like_post"
  | "like_comment"
  | "collaborator"
  | "popular_post"
  | "password_change"
  | "system";

// 대상 유형
export type TargetType = "post" | "comment" | "template" | "user" | "system" | "news";

// 알림 인터페이스
export interface Notification {
  notification_id?: number;
  notification_uuid?: string;
  user_uuid: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read?: boolean;
  target_type?: TargetType;
  target_uuid?: string;
  actor_uuid?: string;
  metadata?: Record<string, any>;
  created_at?: Date;
  read_at?: Date;
}

// 알림 생성 입력 인터페이스
export interface CreateNotificationInput {
  userUuid: string;
  type: NotificationType;
  title: string;
  message: string;
  targetType?: TargetType;
  targetUuid?: string;
  actorUuid?: string;
  metadata?: Record<string, any>;
}

class NotificationModel {
  /**
   * 알림 생성
   * @param input 알림 생성 입력
   * @param connection 데이터베이스 연결 객체
   * @returns 생성된 알림 ID
   */
  static async create(
    input: CreateNotificationInput,
    connection: PoolConnection | Pool
  ): Promise<{ insertId: number; notificationUuid: string }> {
    const result = await connection.query(
      `
      INSERT INTO notification (user_uuid, type, title, message, target_type, target_uuid, actor_uuid, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.userUuid,
        input.type,
        input.title,
        input.message,
        input.targetType || null,
        input.targetUuid || null,
        input.actorUuid || null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ]
    );

    // 생성된 알림의 UUID 조회
    const [notification] = await connection.query(
      `SELECT notification_uuid FROM notification WHERE notification_id = ?`,
      [result.insertId]
    );

    return {
      insertId: result.insertId,
      notificationUuid: notification.notification_uuid,
    };
  }

  /**
   * 사용자의 알림 목록 조회
   * @param userUuid 사용자 UUID
   * @param connection 데이터베이스 연결 객체
   * @param options 조회 옵션 (limit, offset, unreadOnly)
   * @returns 알림 목록
   */
  static async findByUserUuid(
    userUuid: string,
    connection: PoolConnection | Pool,
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
  ): Promise<Notification[]> {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    let query = `
      SELECT 
        n.*,
        u.name AS actor_name,
        u.profile_image AS actor_profile_image
      FROM notification n
      LEFT JOIN user u ON n.actor_uuid = u.user_uuid
      WHERE n.user_uuid = ?
    `;

    if (unreadOnly) {
      query += ` AND n.is_read = 0`;
    }

    query += ` ORDER BY n.created_at DESC LIMIT ? OFFSET ?`;

    const notifications = await connection.query(query, [
      userUuid,
      limit,
      offset,
    ]);

    return notifications;
  }

  /**
   * 알림 UUID로 알림 조회
   * @param notificationUuid 알림 UUID
   * @param connection 데이터베이스 연결 객체
   * @returns 알림 정보
   */
  static async findByUuid(
    notificationUuid: string,
    connection: PoolConnection | Pool
  ): Promise<Notification | null> {
    const [notification] = await connection.query(
      `SELECT * FROM notification WHERE notification_uuid = ?`,
      [notificationUuid]
    );

    return notification || null;
  }

  /**
   * 알림 읽음 처리
   * @param notificationUuid 알림 UUID
   * @param userUuid 사용자 UUID (권한 확인용)
   * @param connection 데이터베이스 연결 객체
   * @returns 업데이트된 행 수
   */
  static async markAsRead(
    notificationUuid: string,
    userUuid: string,
    connection: PoolConnection | Pool
  ): Promise<number> {
    const result = await connection.query(
      `
      UPDATE notification 
      SET is_read = 1, read_at = NOW() 
      WHERE notification_uuid = ? AND user_uuid = ?
      `,
      [notificationUuid, userUuid]
    );

    return result.affectedRows;
  }

  /**
   * 사용자의 모든 알림 읽음 처리
   * @param userUuid 사용자 UUID
   * @param connection 데이터베이스 연결 객체
   * @returns 업데이트된 행 수
   */
  static async markAllAsRead(
    userUuid: string,
    connection: PoolConnection | Pool
  ): Promise<number> {
    const result = await connection.query(
      `
      UPDATE notification 
      SET is_read = 1, read_at = NOW() 
      WHERE user_uuid = ? AND is_read = 0
      `,
      [userUuid]
    );

    return result.affectedRows;
  }

  /**
   * 알림 삭제
   * @param notificationUuid 알림 UUID
   * @param userUuid 사용자 UUID (권한 확인용)
   * @param connection 데이터베이스 연결 객체
   * @returns 삭제된 행 수
   */
  static async delete(
    notificationUuid: string,
    userUuid: string,
    connection: PoolConnection | Pool
  ): Promise<number> {
    const result = await connection.query(
      `DELETE FROM notification WHERE notification_uuid = ? AND user_uuid = ?`,
      [notificationUuid, userUuid]
    );

    return result.affectedRows;
  }

  /**
   * 사용자의 모든 알림 삭제
   * @param userUuid 사용자 UUID
   * @param connection 데이터베이스 연결 객체
   * @returns 삭제된 행 수
   */
  static async deleteAllByUser(
    userUuid: string,
    connection: PoolConnection | Pool
  ): Promise<number> {
    const result = await connection.query(
      `DELETE FROM notification WHERE user_uuid = ?`,
      [userUuid]
    );

    return result.affectedRows;
  }

  /**
   * 읽은 알림 삭제 (정리용)
   * @param userUuid 사용자 UUID
   * @param connection 데이터베이스 연결 객체
   * @returns 삭제된 행 수
   */
  static async deleteReadNotifications(
    userUuid: string,
    connection: PoolConnection | Pool
  ): Promise<number> {
    const result = await connection.query(
      `DELETE FROM notification WHERE user_uuid = ? AND is_read = 1`,
      [userUuid]
    );

    return result.affectedRows;
  }

  /**
   * 읽지 않은 알림 개수 조회
   * @param userUuid 사용자 UUID
   * @param connection 데이터베이스 연결 객체
   * @returns 읽지 않은 알림 개수
   */
  static async getUnreadCount(
    userUuid: string,
    connection: PoolConnection | Pool
  ): Promise<number> {
    const [result] = await connection.query(
      `SELECT COUNT(*) AS count FROM notification WHERE user_uuid = ? AND is_read = 0`,
      [userUuid]
    );

    return Number(result.count);
  }

  /**
   * 오래된 알림 삭제 (30일 이상)
   * @param connection 데이터베이스 연결 객체
   * @returns 삭제된 행 수
   */
  static async deleteOldNotifications(
    connection: PoolConnection | Pool
  ): Promise<number> {
    const result = await connection.query(
      `DELETE FROM notification WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );

    return result.affectedRows;
  }
}

export default NotificationModel;
