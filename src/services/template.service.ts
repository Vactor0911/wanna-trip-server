import { dbPool } from "../config/db";
import { ForbiddenError, NotFoundError } from "../errors/CustomErrors";
import BoardModel from "../models/board.model";
import CardModel from "../models/card.model";
import CollaboratorModel from "../models/collaborator.model";
import LocationModel from "../models/location.model";
import TemplateModel from "../models/template.model";
import UserModel from "../models/user.model";
import TransactionHandler from "../utils/transactionHandler";

class TemplateService {
  /**
   * 템플릿 생성
   * @param userId 사용자 id
   * @param title 제목
   */
  static async createTemplate(userId: string, title: string) {
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 템플릿 생성
        const templateUuid = await TemplateModel.create(
          userId,
          title,
          connection
        );

        // 템플릿 조회
        const template = await TemplateModel.findByUuid(
          templateUuid,
          connection
        );

        // 기본 보드 생성
        const boardUuid = await BoardModel.create(
          template.template_id,
          1,
          connection
        );
        return templateUuid;
      }
    );
  }

  /**
   * 템플릿 삭제
   * @param userId 사용자 id
   * @param templateUuid 템플릿 uuid
   */
  static async deleteTemplate(userId: string, templateUuid: string) {
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 템플릿 수정 권한 확인
        await this.validateEditPermissionByUuid(userId, templateUuid);

        // 템플릿 삭제
        await TemplateModel.deleteByUuid(templateUuid, connection);
      }
    );
  }

  /**
   * 템플릿 일괄 삭제
   * @param userId 사용자 id
   * @param templateUuids 삭제할 템플릿 uuid 배열
   * @returns 삭제 결과 (성공/실패 개수)
   */
  static async bulkDeleteTemplates(userId: string, templateUuids: string[]) {
    let successCount = 0;
    let failCount = 0;
    const failedUuids: string[] = [];

    for (const templateUuid of templateUuids) {
      try {
        await TransactionHandler.executeInTransaction(
          dbPool,
          async (connection) => {
            // 템플릿 수정 권한 확인
            await this.validateEditPermissionByUuid(userId, templateUuid);

            // 템플릿 삭제
            await TemplateModel.deleteByUuid(templateUuid, connection);
          }
        );
        successCount++;
      } catch (error) {
        failCount++;
        failedUuids.push(templateUuid);
        console.error(`템플릿 삭제 실패 (${templateUuid}):`, error);
      }
    }

    return { successCount, failCount, failedUuids };
  }

  /**
   * 사용자 id로 템플릿 목록 조회
   * @param userId 사용자 id
   * @returns 템플릿 목록
   */
  static async getTemplatesByUserId(userId: string) {
    // 템플릿 조회
    const templates = await TemplateModel.findAllByUserId(userId, dbPool);

    // 템플릿 반환
    const formattedTemplates = templates.map((template: any) =>
      this.formatTemplate(template)
    );
    return formattedTemplates;
  }

  /**
   * 템플릿 uuid로 템플릿 조회
   * @param userId 사용자 id
   * @param templateUuid 템플릿 uuid
   * @returns 조회된 템플릿
   */
  static async getTemplateByUuid(userId: string, templateUuid: string) {
    // 템플릿 조회 권한 확인
    await this.validateReadPermissionByUuid(userId, templateUuid);

    // 템플릿 조회
    const template = await TemplateModel.findByUuid(templateUuid, dbPool);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    }

    // 보드 조회
    const boards = await BoardModel.findAllByTemplateId(
      template.template_id,
      dbPool
    );
    template.boards = boards;

    // 각 보드의 카드 조회
    for (const board of boards as any[]) {
      const cards = await CardModel.findAllByBoardId(board.board_id, dbPool);
      board.cards = cards;
    }

    // 각 카드의 위치 정보 조회
    for (const board of boards as any[]) {
      for (const card of board.cards as any[]) {
        const location = await LocationModel.findByCardId(card.card_id, dbPool);
        card.location = location;
      }
    }

    // 템플릿 반환
    const formattedTemplates = this.formatTemplate(template);
    return formattedTemplates;
  }

  /**
   * 템플릿 uuid로 템플릿 수정
   * @param userId 사용자 id
   * @param templateUuid 템플릿 uuid
   * @param title 템플릿 제목
   */
  static async updateTemplateByUuid(
    userId: string,
    templateUuid: string,
    title: string
  ) {
    // 템플릿 수정 권한 확인
    await this.validateEditPermissionByUuid(userId, templateUuid);

    // 템플릿 수정
    await TemplateModel.updateByUuid(templateUuid, title, dbPool);
  }

  /**
   * 인기 템플릿 조회
   * @returns 인기 템플릿 목록
   */
  static async getPopularTemplates() {
    // 인기 템플릿 조회
    const templates = await TemplateModel.findPopularTemplates(dbPool);

    // 템플릿 반환
    const formattedTemplates = templates.map((template: any) =>
      this.formatPopularTemplate(template)
    );
    return formattedTemplates;
  }

  /**
   * 템플릿 id로 소유자 검증
   * @param userId 사용자 id
   * @param templateId 템플릿 id
   */
  static async validateOwnerById(userId: string, templateId: string) {
    // 템플릿 조회
    const template = await TemplateModel.findById(templateId, dbPool);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    }

    // 소유자 검증
    if (template.user_id !== userId) {
      throw new ForbiddenError("템플릿 소유자 권한이 없습니다.");
    }
  }

  /**
   * 템플릿 uuid로 소유자 검증
   * @param userId 사용자 id
   * @param templateUuid 템플릿 uuid
   */
  static async validateOwnerByUuid(userId: string, templateUuid: string) {
    // 템플릿 조회
    const template = await TemplateModel.findByUuid(templateUuid, dbPool);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    }

    // 템플릿 id로 소유자 검증
    await this.validateOwnerById(userId, template.template_id);
  }

  /**
   * 템플릿 id로 조회 권한 검증
   * @param userId 사용자 id
   * @param templateId 템플릿 id
   */
  static async validateReadPermissionById(userId: string, templateId: string) {
    // 템플릿 조회
    const template = await TemplateModel.findById(templateId, dbPool);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    }

    // 사용자 조회
    const user = await UserModel.findById(userId, dbPool);

    // 공동 작업자 조회
    const collaborators = await CollaboratorModel.findAllByTemplateId(
      template.template_id,
      dbPool
    );
    const isCollaborator = collaborators.some(
      (collaborator: any) => collaborator.user_uuid === user?.user_uuid
    );

    // 템플릿 공개 설정 확인
    if (template.privacy === "private") {
      if (!isCollaborator && template.user_id !== userId) {
        throw new ForbiddenError("템플릿 조회 권한이 없습니다.");
      }
    }
  }

  /**
   * 템플릿 uuid로 조회 권한 검증
   * @param userId 사용자 id
   * @param templateUuid 템플릿 uuid
   */
  static async validateReadPermissionByUuid(
    userId: string,
    templateUuid: string
  ) {
    // 템플릿 조회
    const template = await TemplateModel.findByUuid(templateUuid, dbPool);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    }

    // 템플릿 id로 권한 검증
    await this.validateReadPermissionById(userId, template.template_id);
  }

  /**
   * 템플릿 id로 수정 권한 검증
   * @param userId 사용자 id
   * @param templateId 템플릿 id
   */
  static async validateEditPermissionById(userId: string, templateId: string) {
    // 템플릿 조회
    const template = await TemplateModel.findById(templateId, dbPool);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    }

    // 사용자 조회
    const user = await UserModel.findById(userId, dbPool);
    if (!user) {
      throw new NotFoundError("사용자를 찾을 수 없습니다.");
    }

    // 공동 작업자 조회
    const collaborators = await CollaboratorModel.findAllByTemplateId(
      template.template_id,
      dbPool
    );
    const isCollaborator = collaborators.some(
      (collaborator: any) => collaborator.user_uuid === user.user_uuid
    );

    // 권한 검증
    if (template.user_id !== userId && !isCollaborator) {
      throw new ForbiddenError("템플릿 수정 권한이 없습니다.");
    }
  }

  /**
   * 템플릿 uuid로 수정 권한 검증
   * @param userId 사용자 id
   * @param templateUuid 템플릿 uuid
   */
  static async validateEditPermissionByUuid(
    userId: string,
    templateUuid: string
  ) {
    // 템플릿 조회
    const template = await TemplateModel.findByUuid(templateUuid, dbPool);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    }

    // 템플릿 id로 권한 검증
    await this.validateEditPermissionById(userId, template.template_id);
  }

  /**
   * 템플릿 권한 설정 변경
   * @param userId 사용자 id
   * @param templateUuid 템플릿 uuid
   * @param privacy 템플릿 공개 설정
   */
  static async updateTemplatePrivacy(
    userId: string,
    templateUuid: string,
    privacy: string
  ) {
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 템플릿 소유자 확인
        await this.validateOwnerByUuid(userId, templateUuid);

        // 템플릿 권한 설정 변경
        await TemplateModel.updatePrivacyByUuid(
          templateUuid,
          privacy,
          connection
        );
      }
    );
  }

  /**
   * 템플릿 공개 설정 조회
   * @param userId 사용자 id
   * @param templateUuid 템플릿 uuid
   * @returns 템플릿 공개 설정
   */
  static async getTemplatePrivacy(userId: string, templateUuid: string) {
    // 템플릿 소유자 확인
    await this.validateOwnerByUuid(userId, templateUuid);

    // 템플릿 조회
    const template = await TemplateModel.findByUuid(templateUuid, dbPool);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    }

    return template.privacy;
  }

  /**
   * 템플릿 객체 포맷팅
   * @param template 템플릿 객체
   * @returns 포맷팅된 템플릿 객체
   */
  static formatTemplate(template: any) {
    return {
      uuid: template.template_uuid,
      title: template.title,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
      sharedCount: template.shared_count,
      thumbnailUrl: template.thumbnail_url,
      boardCount: template.board_count ? Number(template.board_count) : undefined,
      boards: template.boards?.map((board: any) => ({
        uuid: board.board_uuid,
        dayNumber: board.day_number,
        cards: board.cards?.map((card: any) => ({
          uuid: card.card_uuid,
          content: card.content,
          startTime: card.start_time,
          endTime: card.end_time,
          orderIndex: card.order_index,
          locked: card.locked,
          location: card.location
            ? {
                title: card.location.title,
                address: card.location.address,
                latitude: card.location.latitude,
                longitude: card.location.longitude,
                category: card.location.category,
                thumbnailUrl: card.location.thumbnail_url,
              }
            : null,
        })),
      })),
    };
  }

  /**
   * 인기 템플릿 객체 포맷팅
   * @param template 템플릿 객체
   * @returns 포맷팅된 템플릿 객체
   */
  static formatPopularTemplate(template: any) {
    return {
      uuid: template.template_uuid,
      title: template.title,
      createdAt: template.created_at,
      sharedCount: template.shared_count,
      ownerName: template.owner_name,
      ownerProfileImage: template.owner_profile_image,
      thumbnailUrl: template.thumbnail_url,
    };
  }

  /**
   * 계정 연동 시 템플릿 병합
   * @param sourceUserId 소스 사용자 id
   * @param targetUserId 타겟 사용자 id
   * @returns 병합 결과
   */
  static async mergeTemplates(sourceUserId: number, targetUserId: number) {
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 소스 사용자의 템플릿을 타겟 사용자로 이전
        await connection.query(
          "UPDATE template SET user_id = ? WHERE user_id = ?",
          [targetUserId, sourceUserId]
        );

        return true;
      }
    );
  }

  /**
   * 템플릿 내 모든 보드의 카드 정렬
   * @param userId 사용자 id
   * @param templateUuid 템플릿 uuid
   */
  static async sortCards(userId: string, templateUuid: string) {
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 템플릿 조회
        const template = await TemplateModel.findByUuid(
          templateUuid,
          connection
        );
        if (!template) {
          throw new NotFoundError("템플릿을 찾을 수 없습니다.");
        }

        // 템플릿 수정 권한 확인
        await this.validateEditPermissionById(userId, template.template_id);

        // 템플릿 내 모든 보드 조회
        const boards = await BoardModel.findAllByTemplateId(
          template.template_id,
          connection
        );

        // 각 보드의 카드 정렬
        for (const board of boards as any[]) {
          await BoardModel.sortCards(board.board_id, connection);
        }
      }
    );
  }

  /**
   * 카드 복사 (다른 사람의 공개 템플릿에서 내 템플릿으로)
   * @param userId 사용자 id
   * @param sourceCardUuid 원본 카드 uuid
   * @param targetBoardUuid 대상 보드 uuid
   * @returns 복사된 카드 id
   */
  static async copyCard(
    userId: string,
    sourceCardUuid: string,
    targetBoardUuid: string
  ): Promise<number> {
    return await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 원본 카드 조회
        const sourceCard = await CardModel.findByUuid(sourceCardUuid, connection);
        if (!sourceCard) {
          throw new NotFoundError("원본 카드를 찾을 수 없습니다.");
        }

        // 원본 보드 조회
        const sourceBoard = await BoardModel.findById(sourceCard.board_id, connection);
        if (!sourceBoard) {
          throw new NotFoundError("원본 보드를 찾을 수 없습니다.");
        }

        // 원본 템플릿 조회
        const sourceTemplate = await TemplateModel.findById(sourceBoard.template_id, connection);
        if (!sourceTemplate) {
          throw new NotFoundError("원본 템플릿을 찾을 수 없습니다.");
        }

        // 원본 템플릿이 public인지 확인 (본인 템플릿이 아닌 경우)
        if (sourceTemplate.user_id !== parseInt(userId) && sourceTemplate.privacy !== "public") {
          throw new ForbiddenError("비공개 템플릿의 카드는 복사할 수 없습니다.");
        }

        // 대상 보드 조회
        const targetBoard = await BoardModel.findByUuid(targetBoardUuid, connection);
        if (!targetBoard) {
          throw new NotFoundError("대상 보드를 찾을 수 없습니다.");
        }

        // 대상 템플릿 수정 권한 확인
        await this.validateEditPermissionById(userId, targetBoard.template_id);

        // 카드 복사 (copyToBoard 메서드 사용)
        const newCardId = await CardModel.copyToBoard(
          sourceCard.card_id,
          targetBoard.board_id,
          connection
        );

        // 원본 템플릿의 shared_count 증가 (본인 템플릿이 아닌 경우에만)
        if (sourceTemplate.user_id !== parseInt(userId)) {
          await TemplateModel.incrementSharedCount(sourceTemplate.template_id, connection);
        }

        return newCardId;
      }
    );
  }

  /**
   * 보드 복사 (다른 사람의 공개 템플릿에서 내 템플릿으로)
   * @param userId 사용자 id
   * @param sourceBoardUuid 원본 보드 uuid
   * @param targetTemplateUuid 대상 템플릿 uuid
   * @returns 복사된 보드 uuid
   */
  static async copyBoard(
    userId: string,
    sourceBoardUuid: string,
    targetTemplateUuid: string
  ): Promise<string> {
    return await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 원본 보드 조회
        const sourceBoard = await BoardModel.findByUuid(sourceBoardUuid, connection);
        if (!sourceBoard) {
          throw new NotFoundError("원본 보드를 찾을 수 없습니다.");
        }

        // 원본 템플릿 조회
        const sourceTemplate = await TemplateModel.findById(sourceBoard.template_id, connection);
        if (!sourceTemplate) {
          throw new NotFoundError("원본 템플릿을 찾을 수 없습니다.");
        }

        // 원본 템플릿이 public인지 확인 (본인 템플릿이 아닌 경우)
        if (sourceTemplate.user_id !== parseInt(userId) && sourceTemplate.privacy !== "public") {
          throw new ForbiddenError("비공개 템플릿의 보드는 복사할 수 없습니다.");
        }

        // 대상 템플릿 조회
        const targetTemplate = await TemplateModel.findByUuid(targetTemplateUuid, connection);
        if (!targetTemplate) {
          throw new NotFoundError("대상 템플릿을 찾을 수 없습니다.");
        }

        // 대상 템플릿 수정 권한 확인
        await this.validateEditPermissionById(userId, targetTemplate.template_id);

        // 대상 템플릿의 마지막 day_number 조회
        const lastDayNumber = await BoardModel.getLastDayNumber(targetTemplate.template_id, connection);

        // 15일차 제한 확인
        if (lastDayNumber >= 15) {
          throw new ForbiddenError("해당 템플릿은 최대 15일차까지 등록할 수 있습니다. 기존 일정을 정리한 후 다시 시도해주세요.");
        }

        // 보드 복사
        const newBoardUuid = await BoardModel.create(
          targetTemplate.template_id,
          lastDayNumber + 1,
          connection
        );

        // 새 보드 조회
        const newBoard = await BoardModel.findByUuid(newBoardUuid, connection);

        // 원본 보드의 카드들 조회
        const sourceCards = await CardModel.findAllByBoardId(sourceBoard.board_id, connection);

        // 각 카드 복사 (copyToBoard 메서드 사용)
        for (const sourceCard of sourceCards as any[]) {
          await CardModel.copyToBoard(
            sourceCard.card_id,
            newBoard.board_id,
            connection
          );
        }

        // 원본 템플릿의 shared_count 증가 (본인 템플릿이 아닌 경우에만)
        if (sourceTemplate.user_id !== parseInt(userId)) {
          await TemplateModel.incrementSharedCount(sourceTemplate.template_id, connection);
        }

        return newBoardUuid;
      }
    );
  }

  /**
   * 템플릿 전체 복사 (다른 사람의 공개 템플릿을 내 템플릿으로)
   * @param userId 사용자 id
   * @param sourceTemplateUuid 원본 템플릿 uuid
   * @param newTitle 새 템플릿 제목 (선택)
   * @returns 복사된 템플릿 uuid
   */
  static async copyTemplate(
    userId: string,
    sourceTemplateUuid: string,
    newTitle?: string
  ): Promise<string> {
    return await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 원본 템플릿 조회
        const sourceTemplate = await TemplateModel.findByUuid(sourceTemplateUuid, connection);
        if (!sourceTemplate) {
          throw new NotFoundError("원본 템플릿을 찾을 수 없습니다.");
        }

        // 원본 템플릿이 public인지 확인 (본인 템플릿이 아닌 경우)
        if (sourceTemplate.user_id !== parseInt(userId) && sourceTemplate.privacy !== "public") {
          throw new ForbiddenError("비공개 템플릿은 복사할 수 없습니다.");
        }

        // 새 템플릿 생성
        const title = newTitle || `${sourceTemplate.title} (복사본)`;
        const newTemplateUuid = await TemplateModel.create(userId, title, connection);
        const newTemplate = await TemplateModel.findByUuid(newTemplateUuid, connection);

        // 기본 보드 삭제 (create 시 자동 생성된 보드)
        const defaultBoards = await BoardModel.findAllByTemplateId(newTemplate.template_id, connection);
        for (const board of defaultBoards as any[]) {
          await BoardModel.deleteById(board.board_id, connection);
        }

        // 원본 템플릿의 보드들 조회
        const sourceBoards = await BoardModel.findAllByTemplateId(sourceTemplate.template_id, connection);

        // 각 보드 복사
        for (const sourceBoard of sourceBoards as any[]) {
          const newBoardUuid = await BoardModel.create(
            newTemplate.template_id,
            sourceBoard.day_number,
            connection
          );
          const newBoard = await BoardModel.findByUuid(newBoardUuid, connection);

          // 원본 보드의 카드들 조회
          const sourceCards = await CardModel.findAllByBoardId(sourceBoard.board_id, connection);

          // 각 카드 복사 (copyToBoard 메서드 사용)
          for (const sourceCard of sourceCards as any[]) {
            await CardModel.copyToBoard(
              sourceCard.card_id,
              newBoard.board_id,
              connection
            );
          }
        }

        // 원본 템플릿의 shared_count 증가 (본인 템플릿이 아닌 경우에만)
        if (sourceTemplate.user_id !== parseInt(userId)) {
          await TemplateModel.incrementSharedCount(sourceTemplate.template_id, connection);
        }

        return newTemplateUuid;
      }
    );
  }

  /**
   * 인기 공개 템플릿 조회 (퍼가기 횟수 기준)
   * @param limit 조회 개수
   * @returns 인기 공개 템플릿 목록
   */
  static async getPopularPublicTemplates(limit: number = 5) {
    const templates = await TemplateModel.findPopularPublicTemplates(limit, dbPool);
    return templates.map((template: any) => this.formatPopularTemplate(template));
  }

  /**
   * 공개 템플릿 uuid로 템플릿 조회 (비로그인 사용자용)
   * @param templateUuid 템플릿 uuid
   * @returns 조회된 템플릿
   */
  static async getPublicTemplateByUuid(templateUuid: string) {
    // 템플릿 조회
    const template = await TemplateModel.findByUuid(templateUuid, dbPool);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    }

    // 공개 템플릿인지 확인
    if (template.privacy !== "public") {
      throw new ForbiddenError("비공개 템플릿은 조회할 수 없습니다.");
    }

    // 보드 조회
    const boards = await BoardModel.findAllByTemplateId(
      template.template_id,
      dbPool
    );
    template.boards = boards;

    // 각 보드의 카드 조회
    for (const board of boards as any[]) {
      const cards = await CardModel.findAllByBoardId(board.board_id, dbPool);
      board.cards = cards;
    }

    // 각 카드의 위치 정보 조회
    for (const board of boards as any[]) {
      for (const card of board.cards as any[]) {
        const location = await LocationModel.findByCardId(card.card_id, dbPool);
        card.location = location;
      }
    }

    // 템플릿 반환
    const formattedTemplates = this.formatTemplate(template);
    return formattedTemplates;
  }

  /**
   * 공유 받은 템플릿 목록 조회 (공동 작업자로 추가된 템플릿)
   * @param userId 사용자 id
   * @returns 공유 받은 템플릿 목록
   */
  static async getSharedTemplatesByUserId(userId: string) {
    // 공유 받은 템플릿 조회
    const templates = await CollaboratorModel.findAllTemplatesByUserId(userId, dbPool);

    // 템플릿 반환
    const formattedTemplates = (templates as any[]).map((template: any) =>
      this.formatSharedTemplate(template)
    );
    return formattedTemplates;
  }

  /**
   * 공유 받은 템플릿 객체 포맷팅
   * @param template 템플릿 객체
   * @returns 포맷팅된 템플릿 객체
   */
  static formatSharedTemplate(template: any) {
    return {
      uuid: template.template_uuid,
      title: template.title,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
      sharedCount: template.shared_count,
      thumbnailUrl: template.thumbnail_url,
      ownerName: template.owner_name,
      ownerProfileImage: template.owner_profile_image,
      boardCount: template.board_count ? Number(template.board_count) : undefined,
    };
  }
}

export default TemplateService;
