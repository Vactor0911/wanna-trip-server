import z from "zod";

// 알림 유형 enum
export const NotificationTypeEnum = z.enum([
  "comment",
  "reply",
  "like_post",
  "like_comment",
  "collaborator",
  "popular_post",
  "password_change",
  "system",
]);

// 대상 유형 enum
export const TargetTypeEnum = z.enum([
  "post",
  "comment",
  "template",
  "user",
  "system",
  "news",
]);

/**
 * 알림 목록 조회 스키마
 */
export const getNotificationsSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20)),
  unreadOnly: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

/**
 * 알림 읽음 처리 스키마
 */
export const markAsReadSchema = z.object({
  notificationUuid: z
    .string()
    .uuid("올바른 알림 UUID 형식이 아닙니다."),
});

/**
 * 알림 삭제 스키마
 */
export const deleteNotificationSchema = z.object({
  notificationUuid: z
    .string()
    .uuid("올바른 알림 UUID 형식이 아닙니다."),
});

/**
 * 알림 생성 스키마 (내부 사용)
 */
export const createNotificationSchema = z.object({
  userUuid: z
    .string()
    .uuid("올바른 사용자 UUID 형식이 아닙니다."),
  type: NotificationTypeEnum,
  title: z
    .string()
    .min(1, "알림 제목은 필수입니다.")
    .max(100, "알림 제목은 100자를 초과할 수 없습니다."),
  message: z
    .string()
    .min(1, "알림 메시지는 필수입니다.")
    .max(500, "알림 메시지는 500자를 초과할 수 없습니다."),
  targetType: TargetTypeEnum.optional(),
  targetUuid: z.string().uuid().optional(),
  actorUuid: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// 타입 추출
export type GetNotificationsInput = z.infer<typeof getNotificationsSchema>;
export type MarkAsReadInput = z.infer<typeof markAsReadSchema>;
export type DeleteNotificationInput = z.infer<typeof deleteNotificationSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
