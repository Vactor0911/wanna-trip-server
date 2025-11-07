import { Pool, PoolConnection } from "mariadb";
import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";

class TemplateModel {
  /**
   * 템플릿 생성
   * @param userId 사용자 id
   * @param title 템플릿 제목
   * @param connection 데이터베이스 연결 객체
   * @returns 생성된 템플릿 uuid
   */
  static async create(
    userId: string,
    title: string,
    connection: PoolConnection | Pool
  ) {
    const templateUuid = uuidv4();

    // 템플릿 생성
    await connection.execute(
      `
        INSERT INTO template (template_uuid, user_id, title)
        VALUES (?, ?, ?)
      `,
      [templateUuid, userId, title]
    );

    // 생성된 템플릿 uuid 반환
    return templateUuid;
  }

  /**
   * 템플릿 id로 템플릿 조회
   * @param templateId 템플릿 id
   * @param connection 데이터베이스 연결 객체
   * @returns 조회된 템플릿
   */
  static async findById(templateId: string, connection: PoolConnection | Pool) {
    const [template] = await connection.execute(
      `
        SELECT *
        FROM template
        WHERE template_id = ?
      `,
      [templateId]
    );
    return template;
  }

  /**
   * 템플릿 uuid로 템플릿 조회
   * @param templateUuid 템플릿 uuid
   * @param connection 데이터베이스 연결 객체
   * @returns 조회된 템플릿
   */
  static async findByUuid(
    templateUuid: string,
    connection: PoolConnection | Pool
  ) {
    const [template] = await connection.execute(
      `
        SELECT *
        FROM template
        WHERE template_uuid = ?
      `,
      [templateUuid]
    );
    return template;
  }

  static async findAllByUserId(
    userId: string,
    connection: PoolConnection | Pool
  ) {
    const templates = await connection.execute(
      `
        SELECT *
        FROM template
        WHERE user_id = ?
      `,
      [userId]
    );
    return templates;
  }

  /**
   * 템플릿 uuid로 템플릿 삭제
   * @param templateUuid 템플릿 uuid
   * @param connection 데이터베이스 연결 객체
   * @returns 삭제 결과
   */
  static async deleteByUuid(
    templateUuid: string,
    connection: PoolConnection | Pool
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
   * 템플릿 uuid로 템플릿 수정
   * @param templateUuid 템플릿 uuid
   * @param title 템플릿 제목
   * @param connection 데이터베이스 연결 객체
   * @returns 수정 결과
   */
  static async updateByUuid(
    templateUuid: string,
    title: string,
    connection: PoolConnection | Pool
  ) {
    const result = await connection.execute(
      `
        UPDATE template
        SET title = ?
        WHERE template_uuid = ?
      `,
      [title, templateUuid]
    );
    return result;
  }

  /**
   * 인기 템플릿 조회
   * @param connection 데이터베이스 연결 객체
   * @returns 인기 템플릿 목록
   */
  static async findPopularTemplates(connection: PoolConnection | Pool) {
    // TODO: LIMIT 값 조정 및 페이지네이션 기능 구현 필요
    const templates = await connection.execute(
      `
        SELECT *
        FROM template
        ORDER BY shared_count DESC
        LIMIT 10
      `
    );
    return templates;
  }
}

export default TemplateModel;
