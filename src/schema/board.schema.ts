import z from "zod";

/**
 * 보드 생성 스키마
 */
export const createBoardSchema = z.object({
  templateUuid: z.uuid("템플릿 UUID 형식이 올바르지 않습니다."),
  dayNumber: z
    .number("일차는 숫자여야 합니다.")
    .min(1, "일차는 최소 1 이상이어야 합니다.")
    .max(15, "일차는 최대 15 이하이어야 합니다."),
});

/**
 * 보드 삭제 스키마
 */
export const deleteBoardSchema = z.object({
  boardUuid: z.uuid("보드 UUID 형식이 올바르지 않습니다."),
});
