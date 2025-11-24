import z from "zod";

/**
 * 공동 작업자 조회 스키마
 */
export const getCollaboratorsSchema = z.object({
  templateUuid: z.uuid("템플릿 UUID 형식이 올바르지 않습니다."),
});

/**
 * 공동 작업자 추가 스키마
 */
export const addCollaboratorSchema = z.object({
  templateUuid: z.uuid("템플릿 UUID 형식이 올바르지 않습니다."),
  collaboratorUuid: z.uuid("공동 작업자 UUID 형식이 올바르지 않습니다."),
});

/**
 * 공동 작업자 제거 스키마
 */
export const removeCollaboratorSchema = z.object({
  templateUuid: z.uuid("템플릿 UUID 형식이 올바르지 않습니다."),
  collaboratorUuid: z.uuid("공동 작업자 UUID 형식이 올바르지 않습니다."),
});
