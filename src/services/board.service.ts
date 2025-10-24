import { PoolConnection } from "mariadb";
import { dbPool } from "../config/db";

type CreateBoardParams = {
  templateId: string;
  dayNumber: number;
};

export const BoardService = {
    /**
     * 새 보드 생성
     * @param params 템플릿 ID, 여행 일차
     * @param connection 데이터베이스 커넥션
     * @returns 삽입 결과
     */
  createBoard: async (
    params: CreateBoardParams,
    connection: PoolConnection
  ) => {
    const { templateId, dayNumber } = params;

    const result = await connection.execute(
      `INSERT INTO board (template_id, day_number) VALUES (?, ?)`,
      [templateId, dayNumber]
    );
    return result;
  },
};
