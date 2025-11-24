import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import TemplateService from "../services/template.service";

class TemplateController {
  /**
   * 템플릿 생성
   */
  static createTemplate = asyncHandler(async (req: Request, res: Response) => {
    const userId = req?.user?.userId!;
    const { title } = req.body;

    // 템플릿 생성
    const templateUuid = await TemplateService.createTemplate(userId, title);

    // 응답 반환
    res.status(201).json({
      success: true,
      message: "템플릿이 성공적으로 생성되었습니다.",
      templateUuid,
    });
  });

  /**
   * 템플릿 삭제
   */
  static deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
    const userId = req?.user?.userId!;
    const { templateUuid } = req.params;

    // 템플릿 삭제
    await TemplateService.deleteTemplate(userId, templateUuid);

    // 응답 반환
    res.status(200).json({
      success: true,
      message: "템플릿이 성공적으로 삭제되었습니다.",
    });
  });

  /**
   * 템플릿 목록 조회
   */
  static getTemplates = asyncHandler(async (req: Request, res: Response) => {
    const userId = req?.user?.userId!;

    // 템플릿 목록 조회
    const templates = await TemplateService.getTemplatesByUserId(userId);

    // 응답 반환
    res.status(200).json({
      success: true,
      message: "템플릿 목록이 성공적으로 조회되었습니다.",
      templates,
    });
  });

  /**
   * 템플릿 조회
   */
  static getTemplate = asyncHandler(async (req: Request, res: Response) => {
    const userId = req?.user?.userId!;
    const { templateUuid } = req.params;

    // 템플릿 조회
    const template = await TemplateService.getTemplateByUuid(
      userId,
      templateUuid
    );

    // 템플릿 편집 권한 확인
    let hasPermission = false;
    try {
      await TemplateService.validateEditPermissionByUuid(userId, templateUuid);
      hasPermission = true;
    } catch (error) {
      hasPermission = false;
    }

    // 응답 반환
    res.status(200).json({
      success: true,
      message: "템플릿이 성공적으로 조회되었습니다.",
      template,
      hasPermission,
    });
  });

  /**
   * 템플릿 수정
   */
  static updateTemplate = asyncHandler(async (req: Request, res: Response) => {
    const userId = req?.user?.userId!;
    const { templateUuid } = req.params;
    const { title } = req.body;

    // 템플릿 수정
    await TemplateService.updateTemplateByUuid(userId, templateUuid, title);

    // 응답 반환
    res.status(200).json({
      success: true,
      message: "템플릿이 성공적으로 수정되었습니다.",
    });
  });

  /**
   * 인기 템플릿 조회
   */
  static getPopularTemplates = asyncHandler(
    async (req: Request, res: Response) => {
      // 인기 템플릿 조회
      const popularTemplates = await TemplateService.getPopularTemplates();

      // 응답 반환
      res.status(200).json({
        success: true,
        message: "인기 템플릿이 성공적으로 조회되었습니다.",
        popularTemplates,
      });
    }
  );

  /**
   * 템플릿 내 모든 보드의 카드 정렬
   */
  static sortCards = asyncHandler(async (req: Request, res: Response) => {
    const userId = req?.user?.userId!;
    const { templateUuid } = req.params;

    // 템플릿 내 모든 보드의 카드 정렬
    await TemplateService.sortCards(userId, templateUuid);

    // 응답 반환
    res.status(200).json({
      success: true,
      message: "템플릿 내 모든 보드의 카드가 성공적으로 정렬되었습니다.",
    });
  });

  /**
   * 템플릿 권한 설정 변경
   */
  static updateTemplatePrivacy = asyncHandler(
    async (req: Request, res: Response) => {
      const userId = req?.user?.userId!;
      const { templateUuid } = req.params;
      const { privacy } = req.body;

      // 템플릿 권한 설정 변경
      await TemplateService.updateTemplatePrivacy(
        userId,
        templateUuid,
        privacy
      );

      // 응답 반환
      res.status(200).json({
        success: true,
        message: "템플릿의 권한 설정이 성공적으로 변경되었습니다.",
      });
    }
  );

  /**
   * 템플릿 공개 설정 조회
   */
  static getTemplatePrivacy = asyncHandler(
    async (req: Request, res: Response) => {
      const userId = req?.user?.userId!;
      const { templateUuid } = req.params;

      // 템플릿 공개 설정 조회
      const privacy = await TemplateService.getTemplatePrivacy(
        userId,
        templateUuid
      );

      // 응답 반환
      res.status(200).json({
        success: true,
        message: "템플릿의 공개 설정이 성공적으로 조회되었습니다.",
        privacy,
      });
    }
  );
}

export default TemplateController;
