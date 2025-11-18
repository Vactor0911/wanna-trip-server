import dayjs, { Dayjs } from "dayjs";
import { Pool, PoolConnection } from "mariadb";
import { v4 as uuidv4 } from "uuid";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

class CardModel {
  /**
   * 카드 생성
   * @param boardId 보드 id
   * @param startTime 시작 시간
   * @param orderIndex 인덱스
   * @param connection 데이터베이스 연결 객체
   * @return 생성된 카드 uuid
   */
  static async create(
    boardId: string,
    startTime: Dayjs,
    orderIndex: number,
    connection: PoolConnection | Pool
  ) {
    // 기존 카드 인덱스 조정
    await connection.execute(
      `
        UPDATE card
        SET order_index = order_index + 1
        WHERE board_id = ? AND order_index >= ?
      `,
      [boardId, orderIndex]
    );

    // 카드 생성
    const cardUuid = uuidv4();
    const endTime = startTime.add(10, "minute");
    await connection.execute(
      `
      INSERT INTO card (card_uuid, board_id, content, start_time, end_time, order_index)
      VALUES (?, ?, '', ?, ?, ?)
      `,
      [
        cardUuid,
        boardId,
        startTime.format("HH:mm"),
        endTime.format("HH:mm"),
        orderIndex,
      ]
    );

    // 생성된 카드 uuid 반환
    return cardUuid;
  }

  /**
   * 카드 복제
   * @param cardId 카드 id
   * @param connection 데이터베이스 연결 객체
   * @return 생성된 카드 uuid
   */
  static async copy(cardId: string, connection: PoolConnection | Pool) {
    // 기존 카드 정보 조회
    const [card] = await connection.execute(
      `
        SELECT *
        FROM card
        WHERE card_id = ?;
      `,
      [cardId]
    );

    // 기존 카드 인덱스 조정
    await connection.execute(
      `
        UPDATE card
        SET order_index = order_index + 1
        WHERE board_id = ? AND order_index > ?
      `,
      [card.board_id, card.order_index]
    );

    // 카드 생성
    const cardUuid = uuidv4();
    const startTime = card.end_time;
    const endTime = dayjs(startTime, "HH:mm:ss").add(10, "minute");
    const result = await connection.execute(
      `
      INSERT INTO card (card_uuid, board_id, content, start_time, end_time, order_index)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        cardUuid,
        card.board_id,
        card.content,
        startTime,
        endTime.format("HH:mm"),
        card.order_index + 1,
      ]
    );

    // 위치 정보 복사
    await connection.execute(
      `
        INSERT INTO location (card_id, title, address, latitude, longitude, category, thumbnail_url)
        SELECT ?, title, address, latitude, longitude, category, thumbnail_url
        FROM location
        WHERE card_id = ?;
      `,
      [result.insertId, card.card_id]
    );

    // 생성된 카드 uuid 반환
    return cardUuid;
  }

  /**
   * 카드 uuid로 카드 조회
   * @param cardUuid 카드 uuid
   * @param connection 데이터베이스 연결 객체
   * @returns 조회된 카드
   */
  static async findByUuid(cardUuid: string, connection: PoolConnection | Pool) {
    const [card] = await connection.execute(
      `
        SELECT *
        FROM card
        WHERE card_uuid = ?
      `,
      [cardUuid]
    );
    return card;
  }

  /**
   * 보드 id로 모든 카드 조회
   * @param boardId 보드 id
   * @param connection 데이터베이스 연결 객체
   * @returns
   */
  static async findAllByBoardId(
    boardId: string,
    connection: PoolConnection | Pool
  ) {
    const cards = await connection.execute(
      `
        SELECT *
        FROM card
        WHERE board_id = ?
      `,
      [boardId]
    );
    return cards;
  }

  /**
   * 카드 id로 템플릿 조회
   * @param cardId 카드 id
   * @param connection 데이터베이스 연결 객체
   * @returns 조회된 템플릿
   */
  static async findTemplateByCardId(
    cardId: string,
    connection: PoolConnection | Pool
  ) {
    const [template] = await connection.execute(
      `
        SELECT t.*
        FROM template t
        JOIN board b ON t.template_id = b.template_id
        JOIN card c ON b.board_id = c.board_id
        WHERE c.card_id = ?
      `,
      [cardId]
    );
    return template;
  }

  /**
   * 카드 uuid로 카드 삭제
   * @param cardUuid 카드 uuid
   * @param connection 데이터베이스 연결 객체
   */
  static async deleteByUuid(
    cardUuid: string,
    connection: PoolConnection | Pool
  ) {
    // 카드 삭제
    await connection.execute(
      `
        DELETE FROM card
        WHERE card_uuid = ?;
      `,
      [cardUuid]
    );
  }

  /**
   * 카드 수정
   * @param cardId 카드 id
   * @param data 수정할 데이터
   * @param connection 데이터베이스 연결 객체
   */
  static async update(
    cardId: string,
    data: {
      content: string;
      startTime: Dayjs;
      endTime: Dayjs;
      orderIndex: number;
      locked: boolean;
    },
    connection: PoolConnection | Pool
  ) {
    await connection.execute(
      `
        UPDATE card
        SET content = ?, start_time = ?, end_time = ?, order_index = ?, locked = ?
        WHERE card_id = ?;
      `,
      [
        data.content,
        data.startTime.format("HH:mm:ss"),
        data.endTime.format("HH:mm:ss"),
        data.orderIndex,
        data.locked,
        cardId,
      ]
    );
  }

  /**
   * 카드 이동
   * @param cardId 카드 id
   * @param boardId 보드 id
   * @param orderIndex 카드 인덱스
   * @param connection 데이터베이스 연결 객체
   */
  static async moveCard(
    cardId: string,
    boardId: string,
    orderIndex: number,
    connection: PoolConnection | Pool
  ) {
    // 기존 카드 정보 조회
    const [card] = await connection.execute(
      `
        SELECT board_id, order_index
        FROM card
        WHERE card_id = ?;
      `,
      [cardId]
    );

    // 카드 인덱스 조정
    if (card.board_id === boardId) {
      // 같은 보드 내 이동
      if (card.order_index < orderIndex) {
        // 아래로 이동
        await connection.execute(
          `
            UPDATE card
            SET order_index = order_index - 1
            WHERE board_id = ? AND order_index > ? AND order_index <= ?;
          `,
          [boardId, card.order_index, orderIndex]
        );
      } else {
        // 위로 이동
        await connection.execute(
          `
            UPDATE card
            SET order_index = order_index + 1
            WHERE board_id = ? AND order_index >= ? AND order_index < ?;
          `,
          [boardId, orderIndex, card.order_index]
        );
      }
    } else {
      // 다른 보드로 이동
      await connection.execute(
        `
          UPDATE card
          SET order_index = order_index + 1
          WHERE board_id = ? AND order_index >= ?;
        `,
        [boardId, orderIndex]
      );
      await connection.execute(
        `
          UPDATE card
          SET order_index = order_index - 1
          WHERE board_id = ? AND order_index > ?;
        `,
        [card.board_id, card.order_index]
      );
    }

    // 카드 이동
    await connection.execute(
      `
        UPDATE card
        SET board_id = ?, order_index = ?
        WHERE card_id = ?;
      `,
      [boardId, orderIndex, cardId]
    );
  }
}

export default CardModel;
