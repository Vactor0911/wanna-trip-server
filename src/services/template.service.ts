import { PoolConnection } from "mariadb";
import { dbPool } from "../config/db";

type CreateTemplateParams = {
  userId: string;
  title: string;
  templateUuid: string;
};

export const TemplateSerice = {
  /**
   * 사용자 uuid로 템플릿 목록 조회
   * @param userId 사용자 uuid
   * @returns 사용자의 템플릿 목록
   */
  getTemplateByUserId: async (userId: string) => {
    const templates = await dbPool.execute(
      `
    SELECT * FROM template
    WHERE user_id = ?
    ORDER BY created_at DESC
    `,
      [userId]
    );
    return templates;
  },

  /**
   * 새 템플릿 생성
   * @param params 사용자 ID, 템플릿 제목, 템플릿 uuid
   * @param connection 데이터베이스 커넥션
   */
  createTemplate: async (
    params: CreateTemplateParams,
    connection: PoolConnection
  ) => {
    const { userId, title, templateUuid } = params;

    const result = await connection.execute(
      `INSERT INTO template (user_id, title, template_uuid) VALUES (?, ?, ?)`,
      [userId, title, templateUuid]
    );
    return result;
  },
};
