import { dbPool } from "../config/db";
import { ForbiddenError } from "../errors/CustomErrors";
import BoardModel from "../models/board.model";
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
        await this.validateTemplatePermissionByUuid(userId, templateUuid);

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
    // 템플릿 수정 권한 확인
    await this.validateTemplatePermissionByUuid(userId, templateUuid);

    // 템플릿 조회
    const template = await TemplateModel.findByUuid(templateUuid, dbPool);

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
    await this.validateTemplatePermissionByUuid(userId, templateUuid);

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
      this.formatTemplate(template)
    );
    return formattedTemplates;
  }

  /**
   * 템플릿 id로 수정 권한 검증
   * @param userId 사용자 id
   * @param templateId 템플릿 id
   */
  static async validateTemplatePermissionById(
    userId: string,
    templateId: string
  ) {
    const template = await TemplateModel.findById(templateId, dbPool);
    if (!template || template.user_id !== userId) {
      throw new ForbiddenError("템플릿 수정 권한이 없습니다.");
    }
  }

  /**
   * 템플릿 uuid로 수정 권한 검증
   * @param userId 사용자 id
   * @param templateUuid 템플릿 uuid
   */
  static async validateTemplatePermissionByUuid(
    userId: string,
    templateUuid: string
  ) {
    const template = await TemplateModel.findByUuid(templateUuid, dbPool);
    if (!template || template.user_id !== userId) {
      throw new ForbiddenError("템플릿 수정 권한이 없습니다.");
    }
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
}

export default TemplateService;
