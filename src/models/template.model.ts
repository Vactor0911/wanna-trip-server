import { Pool, PoolConnection } from "mariadb";
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

  /**
   * 사용자 id로 모든 템플릿 조회
   * @param userId 사용자 id
   * @param connection 데이터베이스 연결 객체
   * @returns
   */
  static async findAllByUserId(
    userId: string,
    connection: PoolConnection | Pool
  ) {
    const templates = await connection.execute(
      `
        SELECT 
          t.*,
          (
            SELECT l.thumbnail_url
            FROM board b
            JOIN card c ON b.board_id = c.board_id
            JOIN location l ON c.card_id = l.card_id
            WHERE b.template_id = t.template_id
              AND l.thumbnail_url IS NOT NULL
            ORDER BY b.day_number ASC, c.order_index ASC
            LIMIT 1
          ) AS thumbnail_url
        FROM template t
        WHERE t.user_id = ?
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
        SELECT 
          t.template_uuid, 
          t.title, 
          t.created_at, 
          t.shared_count, 
          u.name AS owner_name,
          (
            SELECT l.thumbnail_url
            FROM board b
            JOIN card c ON b.board_id = c.board_id
            JOIN location l ON c.card_id = l.card_id
            WHERE b.template_id = t.template_id
              AND l.thumbnail_url IS NOT NULL
            ORDER BY b.day_number ASC, c.order_index ASC
            LIMIT 1
          ) AS thumbnail_url
        FROM template t
        JOIN user u ON t.user_id = u.user_id
        ORDER BY shared_count DESC
        LIMIT 10
      `
    );
    return templates;
  }
}

export default TemplateModel;
