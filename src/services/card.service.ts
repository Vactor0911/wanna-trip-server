import { dbPool } from "../config/db";
import { NotFoundError } from "../errors/CustomErrors";
import BoardModel from "../models/board.model";
import CardModel from "../models/card.model";
import TransactionHandler from "../utils/transactionHandler";
import TemplateService from "./template.service";

class CardService {
  static async createCard(userId: string, boardUuid: string, index: number) {
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

        // 보드 조회

        // 카드 생성
        const cardUuid = await CardModel.create(
          templateUuid,
          boardUuid,
          index,
          connection
        );
      }
    );
  }
}

export default CardService;
