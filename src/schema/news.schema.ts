import { z } from "zod";

// 공지사항 생성 스키마
export const createNewsSchema = z.object({
  title: z
    .string()
    .min(1, "제목을 입력해주세요.")
    .max(200, "제목은 200자 이내로 입력해주세요."),
  content: z.string().min(1, "내용을 입력해주세요."),
  category: z.string().optional().default("일반"),
  isImportant: z.boolean().optional().default(false),
});

// 공지사항 수정 스키마
export const updateNewsSchema = z.object({
  title: z
    .string()
    .min(1, "제목을 입력해주세요.")
    .max(200, "제목은 200자 이내로 입력해주세요.")
    .optional(),
  content: z.string().min(1, "내용을 입력해주세요.").optional(),
  category: z.string().optional(),
  isImportant: z.boolean().optional(),
});

// 공지사항 UUID 파라미터 스키마
export const newsUuidParamSchema = z.object({
  newsUuid: z.string().uuid("유효한 공지사항 UUID가 아닙니다."),
});

// 페이지네이션 쿼리 스키마
export const newsListQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default("1"),
  limit: z.string().regex(/^\d+$/).optional().default("20"),
});
