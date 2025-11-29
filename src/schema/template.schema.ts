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
 * 템플릿 일괄 삭제 스키마
 */
export const bulkDeleteTemplatesSchema = z.object({
  templateUuids: z
    .array(z.uuid("템플릿 UUID 형식이 올바르지 않습니다."))
    .min(1, "삭제할 템플릿을 1개 이상 선택해주세요.")
    .max(100, "한 번에 최대 100개까지 삭제할 수 있습니다."),
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

/**
 * 템플릿 복사 스키마
 */
export const copyTemplateParamsSchema = z.object({
  sourceTemplateUuid: z.uuid("원본 템플릿 UUID 형식이 올바르지 않습니다."),
});
export const copyTemplateBodySchema = z.object({
  title: z
    .string("템플릿 제목은 문자열이어야 합니다.")
    .min(1, "템플릿 제목은 최소 1자 이상이어야 합니다.")
    .max(100, "템플릿 제목은 최대 100자 이하여야 합니다.")
    .optional(),
});

/**
 * 보드 복사 스키마
 */
export const copyBoardParamsSchema = z.object({
  sourceBoardUuid: z.uuid("원본 보드 UUID 형식이 올바르지 않습니다."),
});
export const copyBoardBodySchema = z.object({
  targetTemplateUuid: z.uuid("대상 템플릿 UUID 형식이 올바르지 않습니다."),
});

/**
 * 카드 복사 스키마
 */
export const copyCardParamsSchema = z.object({
  sourceCardUuid: z.uuid("원본 카드 UUID 형식이 올바르지 않습니다."),
});
export const copyCardBodySchema = z.object({
  targetBoardUuid: z.uuid("대상 보드 UUID 형식이 올바르지 않습니다."),
});
