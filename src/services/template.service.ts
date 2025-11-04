import { PoolConnection } from "mariadb";
import TemplateModel from "../models/template.model";

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
      throw new Error("템플릿을 찾을 수 없습니다.", { cause: "NOT_FOUND" });
    } else if (template.user_id !== userId) {
      throw new Error("템플릿에 대한 권한이 없습니다.", { cause: "FORBIDDEN" });
    }
    return template;
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
   * @param templateId 템플릿 id
   * @param connection 데이터베이스 연결 객체
   * @returns 삭제 결과
   */
  static async deleteTemplateById(
    userId: string,
    templateId: string,
    connection: PoolConnection
  ) {
    // 템플릿 소유권 확인
    const template = await TemplateModel.findById(templateId);
    if (!template) {
      throw new Error("템플릿을 찾을 수 없습니다.", { cause: "NOT_FOUND" });
    } else if (template.user_id !== userId) {
      throw new Error("템플릿에 대한 권한이 없습니다.", { cause: "FORBIDDEN" });
    }

    // 템플릿 삭제
    try {
      const result = await TemplateModel.deleteById(templateId, connection);
      return result;
    } catch (error) {
      throw error;
    }
  }
}

export default TemplateService;
