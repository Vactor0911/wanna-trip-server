import { Dayjs, isDayjs } from "dayjs";
import { dbPool } from "../config/db";
import { NotFoundError } from "../errors/CustomErrors";
import BoardModel from "../models/board.model";
import CardModel from "../models/card.model";
import TransactionHandler from "../utils/transactionHandler";
import TemplateService from "./template.service";

class CardService {
  /**
   *
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
}

export default CardService;
