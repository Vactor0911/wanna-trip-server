import { dbPool } from "../config/db";
import NotificationModel, {
  CreateNotificationInput,
  NotificationType,
  TargetType,
} from "../models/notification.model";
import { getSocketIO } from "../socket";

// 알림 메시지 템플릿
const NOTIFICATION_TEMPLATES = {
  comment: {
    title: "새 댓글",
    getMessage: (actorName: string) =>
      `${actorName}님이 회원님의 게시글에 댓글을 남겼습니다.`,
  },
  reply: {
    title: "새 답글",
    getMessage: (actorName: string) =>
      `${actorName}님이 회원님의 댓글에 답글을 남겼습니다.`,
  },
  like_post: {
    title: "게시글 좋아요",
    getMessage: (actorName: string) =>
      `${actorName}님이 회원님의 게시글을 좋아합니다.`,
  },
  like_comment: {
    title: "댓글 좋아요",
    getMessage: (actorName: string) =>
      `${actorName}님이 회원님의 댓글을 좋아합니다.`,
  },
  collaborator: {
    title: "공동 작업자 초대",
    getMessage: (actorName: string) =>
      `${actorName}님이 회원님을 여행 계획의 공동 작업자로 초대했습니다.`,
  },
  popular_post: {
    getTitle: (rank: number) => {
      const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
      return `인기 게시글 ${rank}등 선정 ${emoji}`;
    },
    getMessage: (rank: number) => {
      const rankText = rank === 1 ? "1등" : rank === 2 ? "2등" : "3등";
      return `축하합니다! 회원님의 게시글이 인기 게시글 ${rankText}으로 선정되었습니다.`;
    },
  },
  password_change: {
    title: "비밀번호 변경 알림",
    getMessage: () =>
      `회원님의 비밀번호가 변경되었습니다. 본인이 아니라면 즉시 고객센터에 문의해주세요.`,
  },
  system: {
    title: "시스템 공지",
    getMessage: (message: string) => message,
  },
};

class NotificationService {
  /**
   * 알림 생성 및 실시간 전송
   * @param input 알림 생성 입력
   * @returns 생성된 알림 정보
   */
  static async createNotification(input: CreateNotificationInput) {
    const connection = await dbPool.getConnection();

    try {
      await connection.beginTransaction();

      // 알림 생성
      const result = await NotificationModel.create(input, connection);

      await connection.commit();

      // 실시간 알림 전송 (Socket.io)
      try {
        const io = getSocketIO();
        io.to(`user:${input.userUuid}`).emit("notification:new", {
          notificationUuid: result.notificationUuid,
          type: input.type,
          title: input.title,
          message: input.message,
          targetType: input.targetType,
          targetUuid: input.targetUuid,
          actorUuid: input.actorUuid,
          createdAt: new Date().toISOString(),
        });
      } catch (socketError) {
        // 소켓 전송 실패해도 알림 생성은 성공
        console.error("실시간 알림 전송 실패:", socketError);
      }

      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 댓글 알림 생성
   * @param postOwnerUuid 게시글 작성자 UUID
   * @param actorUuid 댓글 작성자 UUID
   * @param actorName 댓글 작성자 이름
   * @param postUuid 게시글 UUID
   * @param commentUuid 댓글 UUID
   */
  static async createCommentNotification(
    postOwnerUuid: string,
    actorUuid: string,
    actorName: string,
    postUuid: string,
    commentUuid: string
  ) {
    // 자기 자신에게는 알림을 보내지 않음
    if (postOwnerUuid === actorUuid) return;

    const template = NOTIFICATION_TEMPLATES.comment;
    await this.createNotification({
      userUuid: postOwnerUuid,
      type: "comment",
      title: template.title,
      message: template.getMessage(actorName),
      targetType: "post",
      targetUuid: postUuid,
      actorUuid,
      metadata: { commentUuid },
    });
  }

  /**
   * 대댓글 알림 생성
   * @param commentOwnerUuid 원 댓글 작성자 UUID
   * @param actorUuid 답글 작성자 UUID
   * @param actorName 답글 작성자 이름
   * @param postUuid 게시글 UUID
   * @param parentCommentUuid 부모 댓글 UUID
   * @param replyUuid 답글 UUID
   */
  static async createReplyNotification(
    commentOwnerUuid: string,
    actorUuid: string,
    actorName: string,
    postUuid: string,
    parentCommentUuid: string,
    replyUuid: string
  ) {
    // 자기 자신에게는 알림을 보내지 않음
    if (commentOwnerUuid === actorUuid) return;

    const template = NOTIFICATION_TEMPLATES.reply;
    await this.createNotification({
      userUuid: commentOwnerUuid,
      type: "reply",
      title: template.title,
      message: template.getMessage(actorName),
      targetType: "post",
      targetUuid: postUuid,
      actorUuid,
      metadata: { parentCommentUuid, replyUuid },
    });
  }

  /**
   * 게시글 좋아요 알림 생성
   * @param postOwnerUuid 게시글 작성자 UUID
   * @param actorUuid 좋아요한 사용자 UUID
   * @param actorName 좋아요한 사용자 이름
   * @param postUuid 게시글 UUID
   */
  static async createPostLikeNotification(
    postOwnerUuid: string,
    actorUuid: string,
    actorName: string,
    postUuid: string
  ) {
    // 자기 자신에게는 알림을 보내지 않음
    if (postOwnerUuid === actorUuid) return;

    const template = NOTIFICATION_TEMPLATES.like_post;
    await this.createNotification({
      userUuid: postOwnerUuid,
      type: "like_post",
      title: template.title,
      message: template.getMessage(actorName),
      targetType: "post",
      targetUuid: postUuid,
      actorUuid,
    });
  }

  /**
   * 댓글 좋아요 알림 생성
   * @param commentOwnerUuid 댓글 작성자 UUID
   * @param actorUuid 좋아요한 사용자 UUID
   * @param actorName 좋아요한 사용자 이름
   * @param postUuid 게시글 UUID
   * @param commentUuid 댓글 UUID
   */
  static async createCommentLikeNotification(
    commentOwnerUuid: string,
    actorUuid: string,
    actorName: string,
    postUuid: string,
    commentUuid: string
  ) {
    // 자기 자신에게는 알림을 보내지 않음
    if (commentOwnerUuid === actorUuid) return;

    const template = NOTIFICATION_TEMPLATES.like_comment;
    await this.createNotification({
      userUuid: commentOwnerUuid,
      type: "like_comment",
      title: template.title,
      message: template.getMessage(actorName),
      targetType: "post",
      targetUuid: postUuid,
      actorUuid,
      metadata: { commentUuid },
    });
  }

  /**
   * 공동 작업자 초대 알림 생성
   * @param collaboratorUuid 초대받은 사용자 UUID
   * @param actorUuid 초대한 사용자 UUID
   * @param actorName 초대한 사용자 이름
   * @param templateUuid 템플릿 UUID
   * @param templateTitle 템플릿 제목
   */
  static async createCollaboratorNotification(
    collaboratorUuid: string,
    actorUuid: string,
    actorName: string,
    templateUuid: string,
    templateTitle?: string
  ) {
    const template = NOTIFICATION_TEMPLATES.collaborator;
    await this.createNotification({
      userUuid: collaboratorUuid,
      type: "collaborator",
      title: template.title,
      message: template.getMessage(actorName),
      targetType: "template",
      targetUuid: templateUuid,
      actorUuid,
      metadata: { templateTitle },
    });
  }

  /**
   * 인기 게시글 선정 알림 생성
   * @param postOwnerUuid 게시글 작성자 UUID
   * @param postUuid 게시글 UUID
   * @param postTitle 게시글 제목
   * @param rank 순위 (1, 2, 3)
   */
  static async createPopularPostNotification(
    postOwnerUuid: string,
    postUuid: string,
    postTitle: string,
    rank: number = 1
  ) {
    const template = NOTIFICATION_TEMPLATES.popular_post;
    await this.createNotification({
      userUuid: postOwnerUuid,
      type: "popular_post",
      title: template.getTitle(rank),
      message: template.getMessage(rank),
      targetType: "post",
      targetUuid: postUuid,
      metadata: { postTitle, rank },
    });
  }

  /**
   * 비밀번호 변경 알림 생성
   * @param userUuid 사용자 UUID
   */
  static async createPasswordChangeNotification(userUuid: string) {
    const template = NOTIFICATION_TEMPLATES.password_change;
    await this.createNotification({
      userUuid,
      type: "password_change",
      title: template.title,
      message: template.getMessage(),
      targetType: "user",
      targetUuid: userUuid,
    });
  }

  /**
   * 시스템 공지 알림 생성
   * @param userUuid 사용자 UUID
   * @param title 공지 제목
   * @param message 공지 내용
   */
  static async createSystemNotification(
    userUuid: string,
    title: string,
    message: string
  ) {
    await this.createNotification({
      userUuid,
      type: "system",
      title,
      message,
      targetType: "system",
    });
  }

  /**
   * 사용자의 알림 목록 조회
   * @param userUuid 사용자 UUID
   * @param options 조회 옵션
   * @returns 알림 목록
   */
  static async getNotifications(
    userUuid: string,
    options: { page?: number; limit?: number; unreadOnly?: boolean } = {}
  ) {
    const { page = 1, limit = 20, unreadOnly = false } = options;
    const offset = (page - 1) * limit;

    const notifications = await NotificationModel.findByUserUuid(
      userUuid,
      dbPool,
      { limit, offset, unreadOnly }
    );

    // 읽지 않은 알림 개수 조회
    const unreadCount = await NotificationModel.getUnreadCount(
      userUuid,
      dbPool
    );

    return {
      notifications: notifications.map((n: any) => {
        // metadata가 이미 객체인 경우와 문자열인 경우를 모두 처리
        let parsedMetadata = null;
        if (n.metadata) {
          if (typeof n.metadata === "string") {
            try {
              parsedMetadata = JSON.parse(n.metadata);
            } catch {
              parsedMetadata = null;
            }
          } else {
            parsedMetadata = n.metadata;
          }
        }

        return {
          uuid: n.notification_uuid,
          type: n.type,
          title: n.title,
          message: n.message,
          isRead: !!n.is_read,
          targetType: n.target_type,
          targetUuid: n.target_uuid,
          actorUuid: n.actor_uuid,
          actorName: n.actor_name,
          actorProfileImage: n.actor_profile_image,
          metadata: parsedMetadata,
          createdAt: n.created_at,
          readAt: n.read_at,
        };
      }),
      unreadCount,
      hasMore: notifications.length === limit,
    };
  }

  /**
   * 알림 읽음 처리
   * @param notificationUuid 알림 UUID
   * @param userUuid 사용자 UUID
   * @returns 처리 결과
   */
  static async markAsRead(notificationUuid: string, userUuid: string) {
    const affectedRows = await NotificationModel.markAsRead(
      notificationUuid,
      userUuid,
      dbPool
    );

    if (affectedRows === 0) {
      throw new Error("알림을 찾을 수 없거나 권한이 없습니다.");
    }

    return { success: true };
  }

  /**
   * 모든 알림 읽음 처리
   * @param userUuid 사용자 UUID
   * @returns 처리 결과
   */
  static async markAllAsRead(userUuid: string) {
    const affectedRows = await NotificationModel.markAllAsRead(
      userUuid,
      dbPool
    );

    return { success: true, count: affectedRows };
  }

  /**
   * 알림 삭제
   * @param notificationUuid 알림 UUID
   * @param userUuid 사용자 UUID
   * @returns 처리 결과
   */
  static async deleteNotification(
    notificationUuid: string,
    userUuid: string
  ) {
    const affectedRows = await NotificationModel.delete(
      notificationUuid,
      userUuid,
      dbPool
    );

    if (affectedRows === 0) {
      throw new Error("알림을 찾을 수 없거나 권한이 없습니다.");
    }

    return { success: true };
  }

  /**
   * 모든 알림 삭제
   * @param userUuid 사용자 UUID
   * @returns 처리 결과
   */
  static async deleteAllNotifications(userUuid: string) {
    const affectedRows = await NotificationModel.deleteAllByUser(
      userUuid,
      dbPool
    );

    return { success: true, count: affectedRows };
  }

  /**
   * 읽은 알림 삭제
   * @param userUuid 사용자 UUID
   * @returns 처리 결과
   */
  static async deleteReadNotifications(userUuid: string) {
    const affectedRows = await NotificationModel.deleteReadNotifications(
      userUuid,
      dbPool
    );

    return { success: true, count: affectedRows };
  }

  /**
   * 읽지 않은 알림 개수 조회
   * @param userUuid 사용자 UUID
   * @returns 읽지 않은 알림 개수
   */
  static async getUnreadCount(userUuid: string) {
    const count = await NotificationModel.getUnreadCount(userUuid, dbPool);
    return { count };
  }
}

export default NotificationService;
