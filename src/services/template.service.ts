import { dbPool } from "../config/db";
import { ForbiddenError, NotFoundError } from "../errors/CustomErrors";
import BoardModel from "../models/board.model";
import CardModel from "../models/card.model";
import CollaboratorModel from "../models/collaborator.model";
import LocationModel from "../models/location.model";
import TemplateModel from "../models/template.model";
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

    // 템플릿 공개 설정 확인
    if (template.privacy === "private" && template.user_id !== userId) {
      throw new ForbiddenError("템플릿 조회 권한이 없습니다.");
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

    // 공동 작업자 조회
    const collaborators = await CollaboratorModel.findAllByTemplateId(
      template.template_id,
      dbPool
    );
    const isCollaborator = collaborators.some(
      (collaborator: any) => collaborator.user_id === userId
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
}

export default TemplateService;
