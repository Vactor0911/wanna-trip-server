import { Pool, PoolConnection } from "mariadb";

class CollaboratorModel {
  /**
   * 공동 작업자 추가
   * @param templateId 템플릿 id
   * @param userId 공동 작업자 id
   * @param connection 데이터베이스 연결 객체
   */
  static async create(
    templateId: string,
    userId: string,
    connection: PoolConnection | Pool
  ) {
    // 공동 작업자 추가
    await connection.execute(
      `
        INSERT INTO collaborator (template_id, user_id)
        VALUES (?, ?)
      `,
      [templateId, userId]
    );
  }

  /**
   * 템플릿 id로 모든 공동 작업자 조회
   * @param templateId 템플릿 id
   * @param connection 데이터베이스 연결 객체
   * @returns 공동 작업자 목록
   */
  static async findAllByTemplateId(
    templateId: string,
    connection: PoolConnection | Pool
  ) {
    const collaborators = await connection.execute(
      `
        SELECT u.user_uuid, u.email, u.name, u.profile_image
        FROM collaborator c
        JOIN user u ON c.user_id = u.user_id
        WHERE template_id = ?
      `,
      [templateId]
    );
    return collaborators;
  }

  /**
   * 템플릿 id와 사용자 id로 공동 작업자 조회
   * @param templateId 템플릿 id
   * @param userId 사용자 id
   * @param connection 데이터베이스 연결 객체
   * @returns 조회된 공동 작업자
   */
  static async findByTemplateIdAndUserId(
    templateId: string,
    userId: string,
    connection: PoolConnection | Pool
  ) {
    const [collaborator] = await connection.execute(
      `
        SELECT u.user_uuid, u.email, u.name, u.profile_image
        FROM collaborator c
        JOIN user u ON c.user_id = u.user_id
        WHERE c.template_id = ? AND c.user_id = ?
      `,
      [templateId, userId]
    );
    return collaborator;
  }

  /**
   * 템플릿 id로 모든 공동 작업자 삭제
   * @param templateId 템플릿 id
   * @param connection 데이터베이스 연결 객체
   */
  static async deleteByTemplateId(
    templateId: string,
    connection: PoolConnection | Pool
  ) {
    await connection.execute(
      `
        DELETE FROM collaborator
        WHERE template_id = ?
      `,
      [templateId]
    );
  }

  /**
   * 템플릿 id와 사용자 id로 공동 작업자 삭제
   * @param templateId 템플릿 id
   * @param userId 사용자 id
   * @param connection 데이터베이스 연결 객체
   */
  static async deleteByTemplateIdAndUserId(
    templateId: string,
    userId: string,
    connection: PoolConnection | Pool
  ) {
    await connection.execute(
      `
        DELETE FROM collaborator
        WHERE template_id = ? AND user_id = ?
      `,
      [templateId, userId]
    );
  }

  /**
   * 사용자 id로 공유 받은 모든 템플릿 조회
   * @param userId 사용자 id
   * @param connection 데이터베이스 연결 객체
   * @returns 공유 받은 템플릿 목록
   */
  static async findAllTemplatesByUserId(
    userId: string,
    connection: PoolConnection | Pool
  ) {
    const templates = await connection.execute(
      `
        SELECT 
          t.template_uuid,
          t.title,
          t.created_at,
          t.updated_at,
          t.shared_count,
          u.name as owner_name,
          u.profile_image as owner_profile_image,
          (SELECT COUNT(*) FROM board WHERE template_id = t.template_id) as board_count,
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
        FROM collaborator c
        JOIN template t ON c.template_id = t.template_id
        JOIN user u ON t.user_id = u.user_id
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
      `,
      [userId]
    );
    return templates;
  }
}

export default CollaboratorModel;
