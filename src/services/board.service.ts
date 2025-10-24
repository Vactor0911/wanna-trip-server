import { PoolConnection } from "mariadb";
import { dbPool } from "../config/db";

type CreateBoardParams = {
  templateId: string;
  dayNumber: number;
};

export const BoardService = {
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
