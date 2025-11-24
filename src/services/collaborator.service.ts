import { dbPool } from "../config/db";
import { ForbiddenError, NotFoundError } from "../errors/CustomErrors";
import AuthModel from "../models/auth.model";
import CollaboratorModel from "../models/collaborator.model";
import TemplateModel from "../models/template.model";
import TransactionHandler from "../utils/transactionHandler";
import TemplateService from "./template.service";

class CollaboratorService {
  /**
   * 템플릿 uuid로 공동 작업자 목록 조회
   * @param userId 사용자 id
   * @param templateUuid 템플릿 uuid
   * @returns 조회된 공동 작업자 목록
   */
  static async getCollaboratorsByTemplateUuid(
    userId: number,
    templateUuid: string
  ) {
    // 템플릿 조회
    const template = await TemplateModel.findByUuid(templateUuid, dbPool);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    }

    // 공동 작업자 목록 조회
    const collaborators = await CollaboratorModel.findAllByTemplateId(
      template.template_id,
      dbPool
    );

    // 공동 작업자의 요청이 아닌 경우 권한 오류
    const isCollaborator = collaborators.some(
      (collaborator: { user_id: number }) => collaborator.user_id === userId
    );
    if (template.user_id !== userId && !isCollaborator) {
      throw new ForbiddenError("공동 작업자 권한이 없습니다.");
    }

    // 공동 작업자 목록 반환
    return collaborators;
  }

  /**
   * 공동 작업자 추가
   * @param userId 사용자 id
   * @param templateUuid 템플릿 uuid
   * @param collaboratorUuid 추가할 공동 작업자 uuid
   */
  static async addCollaborator(
    userId: string,
    templateUuid: string,
    collaboratorUuid: string
  ) {
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

        // 템플릿 소유자 권한 확인
        await TemplateService.validateOwnerById(userId, template.template_id);

        // 사용자 조회
        const collaborator = await AuthModel.findByUuid(
          collaboratorUuid,
          connection
        );
        if (!collaborator) {
          throw new NotFoundError(
            "공동 작업자로 추가할 사용자를 찾을 수 없습니다."
          );
        }

        // 공동 작업자 추가
        await CollaboratorModel.create(
          template.template_id,
          collaborator.user_id,
          connection
        );
      }
    );
  }

  /**
   * 공동 작업자 제거
   * @param userId 사용자 id
   * @param templateUuid 템플릿 uuid
   * @param collaboratorUuid 공동 작업자 uuid
   */
  static async removeCollaborator(
    userId: string,
    templateUuid: string,
    collaboratorUuid: string
  ) {
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

        // 템플릿 소유자 권한 확인
        await TemplateService.validateOwnerById(userId, template.template_id);

        // 사용자 조회
        const collaborator = await AuthModel.findByUuid(
          collaboratorUuid,
          connection
        );
        if (!collaborator) {
          throw new NotFoundError(
            "공동 작업자에서 제거할 사용자를 찾을 수 없습니다."
          );
        }

        // 공동 작업자 제거
        await CollaboratorModel.deleteByTemplateIdAndUserId(
          template.template_id,
          collaborator.user_id,
          connection
        );
      }
    );
  }
}

export default CollaboratorService;
