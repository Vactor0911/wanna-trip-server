import { Pool, PoolConnection } from "mariadb";
import { dbPool } from "../config/db";

type CreateTemplateParams = {
  userId: string;
  title: string;
  templateUuid: string;
};

class TemplateModel {
  /**
   * 템플릿 id로 템플릿 조회
   * @param templateId 템플릿 id
   * @returns 조회된 템플릿
   */
  static async findById(templateId: string) {
    const templates = await dbPool.execute(
      `
        SELECT * FROM template
        WHERE template_id = ?
        LIMIT 1
      `,
      [templateId]
    );
    return templates && templates.length > 0 ? templates[0] : null;
  }

  /**
   * 템플릿 uuid로 템플릿 조회
   * @param templateUuid 템플릿 uuid
   * @returns 조회된 템플릿
   */
  static async findByUuid(templateUuid: string) {
    const templates = await dbPool.execute(
      `
        SELECT * FROM template
        WHERE template_uuid = ?
        LIMIT 1
      `,
      [templateUuid]
    );
    return templates && templates.length > 0 ? templates[0] : null;
  }

  /**
   * 사용자 id로 템플릿 전체 조회
   * @param userId 사용자 id
   * @returns 조회된 템플릿 목록
   */
  static async findAllByUserId(userId: string) {
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

  /**
   * 사용자 uuid로 템플릿 전체 조회
   * @param userUuid 사용자 uuid
   * @returns 조회된 템플릿 목록
   */
  static async findAllByUserUuid(userUuid: string) {
    const templates = await dbPool.execute(
      `
        SELECT * FROM template
        WHERE user_uuid = ?
        ORDER BY created_at DESC
      `,
      [userUuid]
    );
    return templates;
  }

  /**
   * 템플릿 생성
   * @param params 템플릿 생성 파라미터
   * @param connection 데이터베이스 연결 객체
   * @returns 생성 결과
   */
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

  /**
   * 템플릿 id로 템플릿 삭제
   * @param templateId 템플릿 id
   * @param connection 데이터베이스 연결 객체
   * @return 삭제 결과
   */
  static async deleteById(
    templateId: string,
    connection: PoolConnection | Pool = dbPool
  ) {
    const result = await connection.execute(
      `
        DELETE FROM template
        WHERE template_id = ?
      `,
      [templateId]
    );
    return result;
  }

  /**
   * 템플릿 uuid로 템플릿 삭제
   * @param templateUuid 템플릿 uuid
   * @param connection 데이터베이스 연결 객체
   * @return 삭제 결과
   */
  static async deleteByUuid(
    templateUuid: string,
    connection: PoolConnection | Pool = dbPool
  ) {
    const result = await connection.execute(
      `
        DELETE FROM template
        WHERE template_uuid = ?
      `,
      [templateUuid]
    );
    return result;
  }

  /**
   * 템플릿 id로 제목 수정
   * @param templateId 템플릿 id
   * @param title 새 제목
   * @param connection 데이터베이스 연결 객체
   */
  static async updateTitleById(
    templateId: string,
    title: string,
    connection: PoolConnection | Pool = dbPool
  ) {
    await connection.execute(
      `
        UPDATE template
        SET title = ?
        WHERE template_id = ?
      `,
      [title, templateId]
    );
  }

  /**
   * 인기 템플릿 조회
   * @param limit 조회할 결과 개수
   * @returns 인기 템플릿 목록
   */
  static async findPopularTemplates(limit: number = 3) {
    const templates = await dbPool.execute(
      `
        SELECT t.template_id, t.template_uuid, t.title, t.shared_count, u.name AS username
        FROM template t
        JOIN user u ON t.user_id = u.user_id
        ORDER BY t.shared_count DESC
        LIMIT ?
      `,
      [limit]
    );
    return templates;
  }
}

export default TemplateModel;
