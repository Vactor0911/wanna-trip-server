import { Dayjs, isDayjs } from "dayjs";
import { dbPool } from "../config/db";
import { NotFoundError } from "../errors/CustomErrors";
import BoardModel from "../models/board.model";
import CardModel from "../models/card.model";
import TransactionHandler from "../utils/transactionHandler";
import TemplateService from "./template.service";

class CardService {
  /**
   * 카드 생성
   * @param userId 사용자 id
   * @param boardUuid 보드 uuid
   * @param index 카드 인덱스
   * @param startTime 시작 시간
   * @return 생성된 카드 uuid
   */
  static async createCard(
    userId: string,
    boardUuid: string,
    index: number,
    startTime: Dayjs
  ) {
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 보드 조회
        const board = await BoardModel.findByUuid(boardUuid, connection);
        if (!board) {
          throw new NotFoundError("보드를 찾을 수 없습니다.");
        }

        // 템플릿 수정 권한 확인
        await TemplateService.validateTemplatePermissionById(
          userId,
          board.template_id
        );

        // 카드 생성
        const cardUuid = await CardModel.create(
          board.board_id,
          index,
          startTime,
          connection
        );
        return cardUuid;
      }
    );
  }

  /**
   * 카드 삭제
   * @param userId 사용자 id
   * @param cardUuid 카드 uuid
   */
  static async deleteCard(userId: string, cardUuid: string) {
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 카드 조회
        const card = await CardModel.findByUuid(cardUuid, connection);
        if (!card) {
          throw new NotFoundError("카드를 찾을 수 없습니다.");
        }

        // 템플릿 조회
        const template = await CardModel.findTemplateByCardId(
          card.card_id,
          connection
        );
        if (!template) {
          throw new NotFoundError("템플릿을 찾을 수 없습니다.");
        }

        // 템플릿 수정 권한 확인
        await TemplateService.validateTemplatePermissionById(
          userId,
          template.template_id
        );

        // 카드 삭제
        await CardModel.deleteByUuid(cardUuid, connection);
      }
    );
  }

  /**
   * 카드 수정
   * @param userId 사용자 id
   * @param cardUuid 카드 uuid
   * @param data 수정할 데이터
   */
  static async updateCard(
    userId: string,
    cardUuid: string,
    data: {
      content: string;
      startTime: Dayjs;
      endTime: Dayjs;
      orderIndex: number;
      locked: boolean;
    }
  ) {
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 카드 조회
        const card = await CardModel.findByUuid(cardUuid, connection);
        if (!card) {
          throw new NotFoundError("카드를 찾을 수 없습니다.");
        }

        // 템플릿 조회
        const template = await CardModel.findTemplateByCardId(
          card.card_id,
          connection
        );
        if (!template) {
          throw new NotFoundError("템플릿을 찾을 수 없습니다.");
        }

        // 템플릿 수정 권한 확인
        await TemplateService.validateTemplatePermissionById(
          userId,
          template.template_id
        );

        // 카드 수정
        await CardModel.update(card.card_id, data, connection);
      }
    );
  }
}

export default CardService;
