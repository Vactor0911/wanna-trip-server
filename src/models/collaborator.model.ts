import { Pool, PoolConnection } from "mariadb";

class CollaboratorModel {
  /**
   * 공동 작업자 추가
   * @param templateId 템플릿 id
   * @param userId 사용자 id
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
        SELECT u.user_uuid, u.email, u.name
        FROM collaborator c
        JOIN user u ON c.user_id = u.user_id
        WHERE template_id = ?
      `,
      [templateId]
    );
    return collaborators;
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
}

export default CollaboratorModel;
