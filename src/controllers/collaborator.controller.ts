import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import CollaboratorService from "../services/collaborator.service";

class CollaboratorController {
  /**
   * 특정 템플릿의 공동 작업자 목록 조회
   */
  static getCollaborators = asyncHandler(
    async (req: Request, res: Response) => {
      const userId = req?.user?.userId!;
      const { templateUuid } = req.params;

      // 공동 작업자 목록 조회
      const collaborators =
        await CollaboratorService.getCollaboratorsByTemplateUuid(
          userId,
          templateUuid
        );

      // 응답 반환
      res.status(200).json({
        success: true,
        message: "공동 작업자 목록이 성공적으로 조회되었습니다.",
        collaborators,
      });
    }
  );

  /**
   * 공동 작업자 추가
   */
  static addCollaborator = asyncHandler(async (req: Request, res: Response) => {
    const userId = req?.user?.userId!;
    const { templateUuid, collaboratorUuid } = req.body;

    // 공동 작업자 추가
    await CollaboratorService.addCollaborator(userId, templateUuid, collaboratorUuid);

    // 응답 반환
    res.status(201).json({
      success: true,
      message: "공동 작업자가 성공적으로 추가되었습니다.",
    });
  });

  /**
   * 공동 작업자 삭제
   */
  static removeCollaborator = asyncHandler(
    async (req: Request, res: Response) => {
      const userId = req?.user?.userId!;
      const { templateUuid, collaboratorUuid } = req.body;

      // 공동 작업자 삭제
      await CollaboratorService.removeCollaborator(
        userId,
        templateUuid,
        collaboratorUuid
      );

      // 응답 반환
      res.status(200).json({
        success: true,
        message: "공동 작업자가 성공적으로 삭제되었습니다.",
      });
    }
  );
}

export default CollaboratorController;
