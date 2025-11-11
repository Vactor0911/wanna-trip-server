import { Pool, PoolConnection } from "mariadb";
import { v4 as uuidv4 } from "uuid";

class CardModel {
  static async create(
    boardId: string,
    index: number,
    connection: PoolConnection | Pool
  ) {
    const cardUuid = uuidv4();
    await connection.execute(
      `
        INSERT INTO card (card_uuid, board_id, content, order_index)
        VALUES (?, ?, '', ?)
      `,
      [cardUuid, boardId, index]
    );
  }
}

export default CardModel;
