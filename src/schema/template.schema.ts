import z from "zod";

/**
 * 템플릿 생성 스키마
 */
export const createTemplateSchema = z.object({
  title: z
    .string("템플릿 제목은 문자열이어야 합니다.")
    .min(1, "템플릿 제목은 최소 1자 이상이어야 합니다.")
    .max(100, "템플릿 제목은 최대 100자 이하여야 합니다."),
});

/**
 * 템플릿 삭제 스키마
 */
export const deleteTemplateSchema = z.object({
  templateUuid: z.uuid("템플릿 UUID 형식이 올바르지 않습니다."),
});

/**
 * 템플릿 조회 스키마
 */
export const getTemplateSchema = z.object({
  templateUuid: z.uuid("템플릿 UUID 형식이 올바르지 않습니다."),
});

/**
 * 템플릿 수정 스키마
 */
export const updateTemplateParamsSchema = z.object({
  templateUuid: z.uuid("템플릿 UUID 형식이 올바르지 않습니다."),
});
export const updateTemplateBodySchema = z.object({
  title: z
    .string("템플릿 제목은 문자열이어야 합니다.")
    .min(1, "템플릿 제목은 최소 1자 이상이어야 합니다.")
    .max(100, "템플릿 제목은 최대 100자 이하여야 합니다."),
});

/**
 * 카드 정렬 스키마
 */
export const sortCardsSchema = z.object({
  templateUuid: z.uuid("템플릿 UUID 형식이 올바르지 않습니다."),
});

/**
 * 템플릿 권한 설정 변경 스키마
 */
export const updateTemplatePrivacyParamsSchema = z.object({
  templateUuid: z.uuid("템플릿 UUID 형식이 올바르지 않습니다."),
});
export const updateTemplatePrivacyBodySchema = z.object({
  privacy: z.enum(["private", "public", "link"], {
    message: "템플릿 권한 설정이 올바르지 않습니다.",
  }),
});

/**
 * 템플릿 공개 설정 조회 스키마
 */
export const getTemplatePrivacySchema = z.object({
  templateUuid: z.uuid("템플릿 UUID 형식이 올바르지 않습니다."),
});
