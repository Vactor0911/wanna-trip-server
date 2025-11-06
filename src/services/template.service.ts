import { PoolConnection } from "mariadb";
import TemplateModel from "../models/template.model";
import { ForbiddenError, NotFoundError } from "../errors/CustomErrors";

class TemplateService {
  /**
   * 템플릿 id로 템플릿 조회
   * @param userId 사용자 id
   * @param templateId 템플릿 id
   * @returns 조회된 템플릿
   */
  static async getTemplateById(userId: string, templateId: string) {
    const template = await TemplateModel.findById(templateId);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    } else if (template.user_id !== userId) {
      throw new ForbiddenError("템플릿에 대한 권한이 없습니다.");
    }
    return template;
  }

  /**
   * 템플릿 uuid로 템플릿 조회
   * @param userId 사용자 id
   * @param templateUuid 템플릿 id
   * @returns 조회된 템플릿
   */
  static async getTemplateByUuid(userId: string, templateUuid: string) {
    const template = await TemplateModel.findByUuid(templateUuid);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    } else if (template.user_id !== userId) {
      throw new ForbiddenError("템플릿에 대한 권한이 없습니다.");
    }
    return template;
  }

  static async getTemplatesByUserId(userId: string) {
    const templates = await TemplateModel.findAllByUserId(userId);
    if (!templates) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    }
    return templates;
  }

  /**
   * 템플릿 생성
   * @param templateUuid 템플릿 uuid
   * @param userId 사용자 id
   * @param title 제목
   * @param connection 데이터베이스 연결 객체
   * @returns 생성 결과
   */
  static async createTemplate(
    templateUuid: string,
    userId: string,
    title: string,
    connection: PoolConnection
  ) {
    // 템플릿 생성
    try {
      const params = {
        templateUuid,
        userId,
        title,
      };
      const result = await TemplateModel.create(params, connection);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 템플릿 삭제
   * @param userId 사용자 id
   * @param templateUuid 템플릿 uuid
   * @param connection 데이터베이스 연결 객체
   * @returns 삭제 결과
   */
  static async deleteTemplateByUuid(
    userId: string,
    templateUuid: string,
    connection: PoolConnection
  ) {
    // 템플릿 소유권 확인
    const template = await TemplateModel.findByUuid(templateUuid);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    } else if (template.user_id !== userId) {
      throw new ForbiddenError("템플릿에 대한 권한이 없습니다.");
    }

    // 템플릿 삭제
    try {
      const result = await TemplateModel.deleteByUuid(templateUuid, connection);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 템플릿 수정
   * @param userId 사용자 id
   * @param templateUuid 템플릿 uuid
   * @param title 제목
   * @param connection 데이터베이스 연결 객체
   * @returns 수정 결과
   */
  static async updateTemplateByUuid(
    userId: string,
    templateUuid: string,
    title: string,
    connection: PoolConnection
  ) {
    // 템플릿 소유권 확인
    const template = await TemplateModel.findByUuid(templateUuid);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    } else if (template.user_id !== userId) {
      throw new ForbiddenError("템플릿에 대한 권한이 없습니다.");
    }

    // 템플릿 수정
    try {
      const result = await TemplateModel.updateTitleById(
        template.template_id.toString(),
        title,
        connection
      );
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 인기 템플릿 조회
   * @returns 인기 템플릿 목록
   */
  static async getPopularTemplates() {
    const templates = await TemplateModel.findPopularTemplates();
    return templates;
  }

  /**
   * 사용자의 템플릿 권한 소지 여부 확인
   * @param userId 사용자 id
   * @param templateId 템플릿 id
   */
  static async checkPermissionById(userId: string, templateId: string) {
    const template = await TemplateModel.findById(templateId);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    } else if (template.user_id !== userId) {
      throw new ForbiddenError("템플릿에 대한 권한이 없습니다.");
    }
  }

  /**
   * 사용자의 템플릿 권한 소지 여부 확인
   * @param userId 사용자 id
   * @param templateId 템플릿 idㄴ
   */
  static async checkPermissionByUuid(userId: string, templateUuid: string) {
    const template = await TemplateModel.findByUuid(templateUuid);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    } else if (template.user_id !== userId) {
      throw new ForbiddenError("템플릿에 대한 권한이 없습니다.");
    }
  }
}

export default TemplateService;
