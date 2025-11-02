import { PoolConnection } from "mariadb";

type CreateBoardParams = {
  templateId: string;
  dayNumber: number;
};

class BoardModel {
  static async create(params: CreateBoardParams, connection: PoolConnection) {
    const { templateId, dayNumber } = params;

    const result = await connection.execute(
      `INSERT INTO board (template_id, day_number) VALUES (?, ?)`,
      [templateId, dayNumber]
    );
    return result;
  }
}

export default BoardModel;
