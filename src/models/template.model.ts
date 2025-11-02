import { Pool, PoolConnection } from "mariadb";
import { dbPool } from "../config/db";

type CreateTemplateParams = {
  userId: string;
  title: string;
  templateUuid: string;
};

class TemplateModel {
  static async findTemplateByUserId(userId: string) {
    const templates = await dbPool.execute(
      `
        SELECT * FROM template
        WHERE user_id = ?
        ORDER BY created_at DESC
      `,
      [userId]
    );
    return templates;
  }

  static async create(
    params: CreateTemplateParams,
    connection: PoolConnection | Pool = dbPool
  ) {
    const { userId, title, templateUuid } = params;

    const result = await connection.execute(
      `INSERT INTO template (user_id, title, template_uuid) VALUES (?, ?, ?)`,
      [userId, title, templateUuid]
    );
    return result;
  }
}

export default TemplateModel;
