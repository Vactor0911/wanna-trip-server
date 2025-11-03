import { Pool, PoolConnection } from "mariadb";
import { dbPool } from "../config/db";

// 카드 생성 파라미터 타입
type CreateCardParams = {
  cardUuid: string;
  boardId: string;
  content?: string;
  startTime: string;
  endTime: string;
  orderIndex: number;
};

// 카드 수정 파라미터 타입
type UpdateCardParams = {
  content?: string;
  startTime?: string;
  endTime?: string;
  orderIndex?: number;
};

class CardModel {
  /**
   * 카드 id로 카드 조회
   * @param cardId 카드 id
   * @returns 조회된 카드
   */
  static async findById(cardId: string) {
    const cards = await dbPool.execute(
      `
        SELECT *
        FROM card
        WHERE card_id = ?
      `,
      [cardId]
    );
    return cards && cards.length > 0 ? cards[0] : null;
  }

  /**
   * 카드 uuid로 카드 조회
   * @param cardUuid 카드 uuid
   * @returns 조회된 카드
   */
  static async findByUuid(cardUuid: string) {
    const cards = await dbPool.execute(
      `
        SELECT *
        FROM card
        WHERE card_uuid = ?
      `,
      [cardUuid]
    );
    return cards && cards.length > 0 ? cards[0] : null;
  }

  /**
   * 카드 생성
   * @param params 카드 생성 파라미터
   * @param connection 데이터베이스 연결 객체
   * @returns 생성 결과
   */
  static async create(
    params: CreateCardParams,
    connection: PoolConnection | Pool = dbPool
  ) {
    const {
      cardUuid,
      boardId,
      content = null,
      startTime,
      endTime,
      orderIndex,
    } = params;

    const duration = ""; // TODO: duration 계산 로직 추가 필요
    const result = await connection.execute(
      `
        INSERT INTO card 
        (card_uuid, board_id, content, time_start, time_end, duration, order_index) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [cardUuid, boardId, content, startTime, endTime, duration, orderIndex]
    );
    return result;
  }

  /**
   * 카드 id로 카드 수정
   * @param params 카드 수정 파라미터
   * @param cardId 카드 id
   * @param connection 데이터베이스 연결 객체
   * @returns 수정 결과
   */
  static async updateById(
    params: UpdateCardParams,
    cardId: string,
    connection: PoolConnection | Pool = dbPool
  ) {
    const { content, startTime, endTime, orderIndex } = params;

    const duration = ""; // TODO: duration 계산 로직 추가 필요
    const result = await connection.execute(
      `
        UPDATE card
        SET content = ?, start_time = ?, end_time = ?, duration = ?, order_index = ?, updated_at = NOW()
        WHERE card_id = ?
      `,
      [content, startTime, endTime, duration, orderIndex, cardId]
    );
    return result;
  }

  /**
   * 카드 id로 카드 삭제
   * @param cardId 카드 id
   * @param connection 데이터베이스 연결 객체
   * @returns 삭제 결과
   */
  static async deleteById(
    cardId: string,
    connection: PoolConnection | Pool = dbPool
  ) {
    const result = await connection.execute(
      `
        DELETE FROM card
        WHERE card_id = ?
      `,
      [cardId]
    );
    return result;
  }

  /**
   * 카드 uuid로 카드 삭제
   * @param cardUuid 카드 uuid
   * @param connection 데이터베이스 연결 객체
   * @returns 삭제 결과
   */
  static async deleteByUuid(
    cardUuid: string,
    connection: PoolConnection | Pool = dbPool
  ) {
    const result = await connection.execute(
      `
        DELETE FROM card
        WHERE card_uuid = ?
      `,
      [cardUuid]
    );
    return result;
  }

  /**
   * 카드 순서 이동
   * @param orderIndex 카드 배치 순서
   * @param cardId 카드 id
   * @param connection 데이터베이스 연결 객체
   * @returns 순서 이동 결과
   */
  static async moveCard(
    orderIndex: number,
    cardId: string,
    connection: PoolConnection | Pool = dbPool
  ) {
    const result = await connection.execute(
      `
        UPDATE card
        SET order_index = ?
        WHERE card_id = ?
        `,
      [orderIndex, cardId]
    );
    return result;
  }

  /**
   * 범위 내 카드 순서 이동
   * @param fromIndex 시작 인덱스
   * @param toIndex 끝 인덱스
   * @param shiftBy 이동 방향
   * @param boardId 보드 id
   * @param connection 데이터베이스 연결 객체
   * @returns 보드 이동 결과
   */
  static async shiftCards(
    fromIndex: number,
    toIndex: number,
    shiftBy: "up" | "down",
    boardId: string,
    connection: PoolConnection | Pool = dbPool
  ) {
    const direction = shiftBy === "down" ? 1 : -1;
    const result = await connection.execute(
      `
        UPDATE card
        SET order_index = order_index + ?
        WHERE order_index BETWEEN ? AND ? AND board_id = ?
      `,
      [direction, fromIndex, toIndex, boardId]
    );
    return result;
  }
}

export default CardModel;
