import { PoolConnection, Pool } from "mariadb";
import { v4 as uuidv4 } from "uuid";
import TransactionHandler from "../utils/transactionHandler";
import { dbPool } from "../config/db";

/**
 * 여행 계획 JSON 인터페이스
 */
interface LocationData {
  title: string;
  address?: string;
  category?: string;
  thumbnail_url?: string;
  latitude?: number;
  longitude?: number;
}

interface CardData {
  location?: LocationData;
  content: string;
  start_time: string;
  end_time: string;
  order_index: number;
}

interface BoardData {
  day_number: number;
  cards: CardData[];
}

interface TravelPlanJSON {
  boards: BoardData[];
}

class TravelPlanService {
  /**
   * AI 생성 여행 계획 JSON을 DB에 저장
   * @param userId 사용자 ID
   * @param templateName 템플릿 이름
   * @param planJSON 여행 계획 JSON
   * @returns 생성된 template_uuid
   */
  static async saveTravelPlanToDB(
    userId: number,
    templateName: string,
    planJSON: TravelPlanJSON
  ): Promise<string> {
    return await TransactionHandler.executeInTransaction(dbPool, async (connection: PoolConnection) => {
      // 1. Template 생성
      const templateUuid = uuidv4();
      
      await connection.execute(
        `INSERT INTO template (template_uuid, user_id, title, privacy)
         VALUES (?, ?, ?, 'private')`,
        [templateUuid, userId, templateName]
      );

      // template_id 조회
      const [templateRow]: any = await connection.query(
        `SELECT template_id FROM template WHERE template_uuid = ?`,
        [templateUuid]
      );
      const templateId = templateRow.template_id;

      // 2. 각 일차(Board) 생성
      for (const board of planJSON.boards) {
        const boardUuid = uuidv4();
        
        await connection.execute(
          `INSERT INTO board (board_uuid, template_id, day_number)
           VALUES (?, ?, ?)`,
          [boardUuid, templateId, board.day_number]
        );

        // board_id 조회
        const [boardRow]: any = await connection.query(
          `SELECT board_id FROM board WHERE board_uuid = ?`,
          [boardUuid]
        );
        const boardId = boardRow.board_id;

        // 3. 각 카드(Card) 생성
        for (const card of board.cards) {
          const cardUuid = uuidv4();
          
          await connection.execute(
            `INSERT INTO card (card_uuid, board_id, content, start_time, end_time, order_index, locked)
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [
              cardUuid,
              boardId,
              card.content,
              card.start_time,
              card.end_time,
              card.order_index,
            ]
          );

          // 4. Location 정보 저장 (있는 경우)
          if (card.location) {
            // card_id 조회
            const [cardRow]: any = await connection.query(
              `SELECT card_id FROM card WHERE card_uuid = ?`,
              [cardUuid]
            );
            const cardId = cardRow.card_id;

            await connection.execute(
              `INSERT INTO location (card_id, title, address, latitude, longitude, category, thumbnail_url)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                cardId,
                card.location.title,
                card.location.address || null,
                card.location.latitude || null,
                card.location.longitude || null,
                card.location.category || null,
                card.location.thumbnail_url || null,
              ]
            );
          }
        }
      }

      return templateUuid;
    });
  }

  /**
   * 여행 계획 JSON 유효성 검증
   * @param planJSON 검증할 JSON
   * @returns 검증 결과
   */
  static validatePlanJSON(planJSON: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!planJSON.boards || !Array.isArray(planJSON.boards)) {
      errors.push("boards 배열이 필요합니다");
      return { isValid: false, errors };
    }

    if (planJSON.boards.length === 0) {
      errors.push("최소 1일 이상의 일정이 필요합니다");
    }

    planJSON.boards.forEach((board: any, boardIndex: number) => {
      if (typeof board.day_number !== "number" || board.day_number < 1) {
        errors.push(`Board ${boardIndex + 1}: 유효한 day_number가 필요합니다`);
      }

      if (!board.cards || !Array.isArray(board.cards) || board.cards.length === 0) {
        errors.push(`Board ${boardIndex + 1}: 최소 1개의 카드가 필요합니다`);
        return;
      }

      board.cards.forEach((card: any, cardIndex: number) => {
        if (!card.content) {
          errors.push(`Day ${board.day_number}, Card ${cardIndex + 1}: content가 필요합니다`);
        }

        const timeRegex = /^\d{2}:\d{2}:\d{2}$/;
        if (!card.start_time || !timeRegex.test(card.start_time)) {
          errors.push(`Day ${board.day_number}, Card ${cardIndex + 1}: 유효한 start_time이 필요합니다 (HH:MM:SS)`);
        }

        if (!card.end_time || !timeRegex.test(card.end_time)) {
          errors.push(`Day ${board.day_number}, Card ${cardIndex + 1}: 유효한 end_time이 필요합니다 (HH:MM:SS)`);
        }

        if (typeof card.order_index !== "number" || card.order_index < 1) {
          errors.push(`Day ${board.day_number}, Card ${cardIndex + 1}: 유효한 order_index가 필요합니다`);
        }
      });
    });

    return { isValid: errors.length === 0, errors };
  }
}

export default TravelPlanService;
