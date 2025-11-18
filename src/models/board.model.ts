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

  static async copy(boardId: string, connection: PoolConnection | Pool) {
    // 기존 보드 정보 조회
    const [board] = await connection.execute(
      `
        SELECT *
        FROM board
        WHERE board_id = ?;
      `,
      [boardId]
    );

    // 보드 일차 조정
    await connection.execute(
      `
        UPDATE board
        SET day_number = day_number + 1
        WHERE day_number > ? AND template_id = ?;
      `,
      [board.day_number, board.template_id]
    );

    // 보드 생성
    const boardUuid = uuidv4();
    await connection.execute(
      `
        INSERT INTO board (board_uuid, template_id, day_number)
        VALUES (?, ?, ?);
      `,
      [boardUuid, board.template_id, board.day_number + 1]
    );

    // 카드 복제
    // 기존 카드 조회
    const cards = await connection.execute(
      `
      SELECT content, start_time, end_time, order_index
      FROM card
      WHERE board_id = ?;
      `,
      [boardId]
    );

    // 새 보드 ID 조회
    const [newBoard] = await connection.execute(
      `
      SELECT board_id
      FROM board
      WHERE board_uuid = ?;
      `,
      [boardUuid]
    );

    // 카드 복제
    for (const card of cards) {
      await connection.execute(
        `
        INSERT INTO card (card_uuid, board_id, content, start_time, end_time, order_index)
        VALUES (?, ?, ?, ?, ?, ?);
      `,
        [
          uuidv4(),
          newBoard.board_id,
          card.content,
          card.start_time,
          card.end_time,
          card.order_index,
        ]
      );
    }

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
    const [board] = await connection.execute(
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
   * 템플릿 id로 모든 보드 조회
   * @param templateId 템플릿 id
   * @param connection 데이터베이스 연결 객체
   * @returns
   */
  static async findAllByTemplateId(
    templateId: string,
    connection: PoolConnection | Pool
  ) {
    const boards = await connection.execute(
      `
        SELECT *
        FROM board
        WHERE template_id = ?
        ORDER BY day_number ASC;
      `,
      [templateId]
    );
    return boards;
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

  /**
   * 보드 초기화
   * @param boardId 보드 id
   * @param connection 데이터베이스 연결 객체
   */
  static async clear(boardId: string, connection: PoolConnection | Pool) {
    // 보드 내 카드 삭제
    await connection.execute(
      `
        DELETE FROM card
        WHERE board_id = ?
      `,
      [boardId]
    );
  }

  /**
   * 보드 이동
   * @param boardUuid 보드 uuid
   * @param dayNumber 이동할 일차
   * @param connection 데이터베이스 연결 객체
   */
  static async move(
    boardUuid: string,
    dayNumber: number,
    connection: PoolConnection | Pool
  ) {
    // 보드 현재 일차 조회
    const board = await connection.execute(
      `
        SELECT day_number
        FROM board
        WHERE board_uuid = ?;
      `,
      [boardUuid]
    );

    // 보드 일차 조정
    if (board[0].day_number < dayNumber) {
      // 오른쪽으로 이동할 때
      await connection.execute(
        `
          UPDATE board
          SET day_number = day_number - 1
          WHERE day_number <= ? AND day_number > ? AND template_id = (
            SELECT template_id
            FROM board
            WHERE board_uuid = ?
          )
        `,
        [dayNumber, board[0].day_number, boardUuid]
      );
    } else if (board[0].day_number > dayNumber) {
      // 왼쪽으로 이동할 때
      await connection.execute(
        `
          UPDATE board
          SET day_number = day_number + 1
          WHERE day_number >= ? AND day_number < ? AND template_id = (
            SELECT template_id
            FROM board
            WHERE board_uuid = ?
          )
        `,
        [dayNumber, board[0].day_number, boardUuid]
      );
    }

    // 보드 이동
    await connection.execute(
      `
        UPDATE board
        SET day_number = ?
        WHERE board_uuid = ?;
      `,
      [dayNumber, boardUuid]
    );
  }

  /**
   * 보드 내 카드 정렬
   * @param boardId 보드 id
   * @param connection 데이터베이스 연결 객체
   */
  static async sortCards(boardId: string, connection: PoolConnection | Pool) {
    // 카드 인덱스 정렬
    const cards = await connection.execute(
      `
        SELECT card_id
        FROM card WHERE board_id = ?
        ORDER BY start_time ASC
      `,
      [boardId]
    );

    let orderIndex = 1;
    for (const card of cards) {
      await connection.execute(
        `
        UPDATE card
        SET order_index = ?
        WHERE card_id = ?;
      `,
        [orderIndex++, card.card_id]
      );
    }
  }

  /**
   * 보드 일차 재정렬
   * @param templateId 템플릿 id
   * @param connection 데이터베이스 연결 객체
   */
  static async reorderBoards(
    templateId: string,
    connection: PoolConnection | Pool
  ) {
    // 전체 보드 일차 재정렬
    const boards = await connection.execute(
      `
        SELECT board_id
        FROM board
        WHERE template_id = ?
        ORDER BY day_number ASC;
      `,
      [templateId]
    );

    let dayNumberCounter = 1;
    for (const board of boards) {
      await connection.execute(
        `
          UPDATE board
          SET day_number = ?
          WHERE board_id = ?;
        `,
        [dayNumberCounter++, board.board_id]
      );
    }
  }
}

export default BoardModel;
