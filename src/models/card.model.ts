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
}

export default CardModel;
