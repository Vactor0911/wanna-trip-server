import dayjs, { Dayjs, isDayjs } from "dayjs";
import { dbPool } from "../config/db";
import { NotFoundError } from "../errors/CustomErrors";
import BoardModel from "../models/board.model";
import CardModel from "../models/card.model";
import TransactionHandler from "../utils/transactionHandler";
import TemplateService from "./template.service";
import LocationModel from "../models/location.model";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

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
    startTime: Dayjs,
    location: {
      title: string;
      address?: string;
      latitude: number;
      longitude: number;
      category?: string;
      thumbnail_url?: string;
    }
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

        // 위치 정보 생성
        if (location) {
          await LocationModel.create(
            cardUuid,
            location.title,
            location.address || "",
            location.latitude,
            location.longitude,
            location.category || "",
            location.thumbnail_url || "",
            connection
          );
        }

        return cardUuid;
      }
    );
  }

  /**
   * 카드 uuid로 카드 조회
   * @param cardUuid 카드 uuid
   * @returns 조회된 카드
   */
  static async getCardByUuid(cardUuid: string) {
    const card = await CardModel.findByUuid(cardUuid, dbPool);
    if (!card) {
      throw new NotFoundError("카드를 찾을 수 없습니다.");
    }

    // 카드 포맷팅
    const formattedCard = this.formatCard(card);
    return formattedCard;
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
   * @return 수정된 카드
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
      location: {
        title: string;
        address?: string;
        latitude: number;
        longitude: number;
        category?: string;
        thumbnail_url?: string;
      };
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

        // 위치 정보 수정
        const location = data.location;
        if (location) {
          // 위치 정보 객체
          const locationObject = {
            title: location.title,
            address: location.address || "",
            latitude: location.latitude,
            longitude: location.longitude,
            category: location.category || "",
            thumbnail_url: location.thumbnail_url || "",
          };

          // 위치 정보 존재 여부 확인
          const existingLocation = await LocationModel.findByCardId(
            card.card_id,
            connection
          );

          if (!existingLocation) {
            // 위치 정보가 없으면 생성
            await LocationModel.create(
              cardUuid,
              locationObject.title,
              locationObject.address,
              locationObject.latitude,
              locationObject.longitude,
              locationObject.category,
              locationObject.thumbnail_url,
              connection
            );
            return;
          } else {
            await LocationModel.update(
              cardUuid,
              locationObject.title,
              locationObject.address,
              locationObject.latitude,
              locationObject.longitude,
              locationObject.category,
              locationObject.thumbnail_url,
              connection
            );
          }
        } else {
          // 위치 정보가 없으면 삭제
          await LocationModel.deleteByCardId(card.card_id, connection);
        }
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

  /**
   * 템플릿 객체 포맷팅
   * @param template 템플릿 객체
   * @returns 포맷팅된 템플릿 객체
   */
  static formatCard(card: any) {
    return {
      uuid: card.card_uuid,
      content: card.content,
      startTime: dayjs(card.start_time, "HH:mm:ss").format("HH:mm"),
      endTime: dayjs(card.end_time, "HH:mm:ss").format("HH:mm"),
      orderIndex: card.order_index,
      locked: card.locked === 1,
      createdAt: card.created_at,
      updatedAt: card.updated_at,
    };
  }
}

export default CardService;
