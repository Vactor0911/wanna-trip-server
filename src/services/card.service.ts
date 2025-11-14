import { Dayjs, isDayjs } from "dayjs";
import { dbPool } from "../config/db";
import { NotFoundError } from "../errors/CustomErrors";
import BoardModel from "../models/board.model";
import CardModel from "../models/card.model";
import TransactionHandler from "../utils/transactionHandler";
import TemplateService from "./template.service";
import LocationModel from "../models/location.model";

class CardService {
  /**
   * 카드 생성
   * @param userId 사용자 id
   * @param boardUuid 보드 uuid
   * @param orderIndex 카드 인덱스
   * @param startTime 시작 시간
   * @return 생성된 카드 uuid
   */
  static async createCard(
    userId: string,
    boardUuid: string,
    orderIndex: number,
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
          startTime,
          orderIndex,
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

  /**
   * 카드 이동
   * @param userId 사용자 id
   * @param cardUuid 카드 uuid
   * @param boardUuid 보드 uuid
   * @param orderIndex 카드 인덱스
   */
  static async moveCard(
    userId: string,
    cardUuid: string,
    boardUuid: string,
    orderIndex: number
  ) {
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 카드 조회
        const card = await CardModel.findByUuid(cardUuid, connection);
        if (!card) {
          throw new NotFoundError("카드를 찾을 수 없습니다.");
        }

        // 보드 조회
        const board = await BoardModel.findByUuid(boardUuid, connection);
        if (!board) {
          throw new NotFoundError("보드를 찾을 수 없습니다.");
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

        // 카드 이동
        await CardModel.moveCard(
          card.card_id,
          board.board_id,
          orderIndex,
          connection
        );
      }
    );
  }

  /**
   * 카드 복제
   * @param userId 사용자 id
   * @param cardUuid 카드 uuid
   */
  static async copyCard(userId: string, cardUuid: string) {
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

        // 카드 복제
        const newCardUuid = await CardModel.copy(card.card_id, connection);
        return newCardUuid;
      }
    );
  }

  /**
   * 카드 위치 정보 조회
   * @param userId 사용자 id
   * @param cardUuid 카드 uuid
   * @returns 카드 위치 정보
   */
  static async getLocation(userId: string, cardUuid: string) {
    return await TransactionHandler.executeInTransaction(
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

        // 템플릿 조회 권한 확인
        await TemplateService.validateTemplatePermissionById(
          userId,
          template.template_id
        );

        // 카드 위치 정보 조회
        const location = await LocationModel.findByCardId(
          card.card_id,
          connection
        );
        if (!location) {
          throw new NotFoundError("카드 위치 정보를 찾을 수 없습니다.");
        }

        // 위치 정보 반환
        return location;
      }
    );
  }
}

export default CardService;
