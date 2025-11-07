import { Pool, PoolConnection } from "mariadb";
import { v4 as uuidv4 } from "uuid";

class BoardModel {
  /**
   * 보드 생성
   * @param templateId 템플릿 ID
   * @param dayNumber 보드 일차
   * @param connection 데이터베이스 연결 객체
   * @returns 생성된 보드 UUID
   */
  static async create(
    templateId: string,
    dayNumber: number,
    connection: PoolConnection | Pool
  ) {
    const boardUuid = uuidv4();

    // 보드 일차 조정
    await connection.execute(
      `
        UPDATE board
        SET day_number = day_number + 1
        WHERE template_id = ? AND day_number >= ?;
      `,
      [templateId, dayNumber]
    );

    // 보드 생성
    await connection.execute(
      `
        INSERT INTO board (board_uuid, template_id, day_number)
        VALUES (?, ?, ?);
      `,
      [boardUuid, templateId, dayNumber]
    );

    // 생성된 보드 UUID 반환
    return boardUuid;
  }

  /**
   * 보드 uuid로 보드 조회
   * @param boardUuid 보드 uuid
   * @param connection 데이터베이스 연결 객체
   * @returns 조회된 보드
   */
  static async findByUuid(
    boardUuid: string,
    connection: PoolConnection | Pool
  ) {
    const [board] = await connection.query(
      `
        SELECT *
        FROM board
        WHERE board_uuid = ?;
      `,
      [boardUuid]
    );
    return board;
  }

  /**
   * 보드 삭제
   * @param boardUuid 보드 uuid
   * @param connection 데이터베이스 연결 객체
   */
  static async delete(boardUuid: string, connection: PoolConnection | Pool) {
    // 보드 삭제
    await connection.execute(
      `
        DELETE FROM board
        WHERE board_uuid = ?;
      `,
      [boardUuid]
    );
  }
}

export default BoardModel;
