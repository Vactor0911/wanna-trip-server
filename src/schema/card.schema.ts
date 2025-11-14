import z from "zod";

/**
 * 카드 생성 스키마
 */
export const createCardSchema = z.object({
  boardUuid: z.uuid("보드 UUID 형식이 올바르지 않습니다."),
  orderIndex: z
    .number("인덱스는 숫자여야 합니다.")
    .min(1, "인덱스는 최소 1 이상이어야 합니다.")
    .optional(),
  startTime: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "유효한 날짜 형식이어야 합니다.",
  }),
});

/**
 * 카드 조회 스키마
 */
export const getCardSchema = z.object({
  cardUuid: z.uuid("카드 UUID 형식이 올바르지 않습니다."),
});

/**
 * 카드 삭제 스키마
 */
export const deleteCardSchema = z.object({
  cardUuid: z.uuid("카드 UUID 형식이 올바르지 않습니다."),
});

/**
 * 카드 수정 스키마
 */
export const updateCardParamsSchema = z.object({
  cardUuid: z.uuid("카드 UUID 형식이 올바르지 않습니다."),
});
export const updateCardBodySchema = z.object({
  content: z.string("카드 내용은 문자열이어야 합니다."),
  startTime: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "유효한 날짜 형식이어야 합니다.",
  }),
  endTime: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "유효한 날짜 형식이어야 합니다.",
  }),
  orderIndex: z
    .number("순서 인덱스는 숫자여야 합니다.")
    .min(1, "순서 인덱스는 최소 1 이상이어야 합니다."),
  locked: z.boolean("잠금 상태는 boolean값이어야 합니다."),
});

/**
 * 카드 이동 스키마
 */
export const moveCardSchema = z.object({
  cardUuid: z.uuid("카드 UUID 형식이 올바르지 않습니다."),
  boardUuid: z.uuid("보드 UUID 형식이 올바르지 않습니다."),
  orderIndex: z
    .number("순서 인덱스는 숫자여야 합니다.")
    .min(1, "순서 인덱스는 최소 1 이상이어야 합니다."),
});

/**
 * 카드 복제 스키마
 */
export const copyCardSchema = z.object({
  cardUuid: z.uuid("카드 UUID 형식이 올바르지 않습니다."),
});

/**
 * 카드 위치 정보 조회 스키마
 */
export const getLocationSchema = z.object({
  cardUuid: z.uuid("카드 UUID 형식이 올바르지 않습니다."),
});