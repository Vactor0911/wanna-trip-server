import { Dayjs } from "dayjs";
import { Pool, PoolConnection } from "mariadb";
import { v4 as uuidv4 } from "uuid";

class CardModel {
  /**
   * 카드 생성
   * @param boardId 보드 id
   * @param index 인덱스
   * @param connection 데이터베이스 연결 객체
   * @return 생성된 카드 uuid
   */
  static async create(
    boardId: string,
    index: number,
    startTime: Dayjs,
    connection: PoolConnection | Pool
  ) {
    // 기존 카드 인덱스 조정
    await connection.execute(
      `
        UPDATE card
        SET order_index = order_index + 1
        WHERE board_id = ? AND order_index >= ?
      `,
      [boardId, index]
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
        index,
      ]
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
        data.startTime.format("HH:mm"),
        data.endTime.format("HH:mm"),
        data.orderIndex,
        data.locked,
        cardId,
      ]
    );
  }
}

export default CardModel;
