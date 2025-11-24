import z from "zod";

/**
 * 사용자 검색 스키마
 */
export const searchUsersSchema = z.object({
  keyword: z
    .string("검색어 형식이 올바르지 않습니다.")
    .min(1, "검색어는 최소 1자 이상이어야 합니다."),
});
