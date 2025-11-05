import { Request, Response } from "express";
import z from "zod";
import { dbPool } from "../config/db";
import TemplateService from "../services/template.service";
import BoardService from "../services/board.service";
import { v4 as uuidv4 } from "uuid";
import { asyncHandler } from "../utils/asyncHandler";
import TransactionHandler from "../utils/transactionHandler";

class TemplateController {
  /**
   * 템플릿 생성
   */
  static async createTemplate(req: Request, res: Response) {
    const userId = req?.user?.userId!;

    // 요청 데이터 검증
    const createTemplateSchema = z.object({
      title: z
        .string()
        .min(1, "제목은 최소 1자 이상이어야 합니다.")
        .max(100, "제목은 최대 100자 이하여야 합니다."),
    });
    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.message,
      });
      return;
    }

    // 데이터 추출
    const { title } = parsed.data;

    // 트랜잭션 실행
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 템플릿 생성
        const templateUuid = uuidv4();
        const result = await TemplateService.createTemplate(
          templateUuid,
          userId,
          title,
          connection
        );

        // 1일차 보드 생성
        const templateId = result.insertId.toString();
        const boardUuid = uuidv4();
        await BoardService.createBoard(boardUuid, templateId, 1, connection);

        // 응답 전송
        res.status(201).json({
          success: true,
          message: "템플릿이 성공적으로 생성되었습니다.",
          data: {
            templateUuid,
          },
        });
      }
    );
  }

  /**
   * 템플릿 삭제
   */
  static deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
    const userId = req?.user?.userId!;

    // 요청 데이터 검증
    const deleteTemplateSchema = z.object({
      templateUuid: z.uuid({
        version: "v4",
        message: "템플릿 UUID가 유효하지 않습니다.",
      }),
    });
    const parsed = deleteTemplateSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.message,
      });
      return;
    }

    // 데이터 추출
    const { templateUuid } = parsed.data;

    // 트랜잭션 실행
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        await TemplateService.deleteTemplateByUuid(
          userId,
          templateUuid,
          connection
        );
      }
    );

    // 응답 전송
    res.status(200).json({
      success: true,
      message: "템플릿이 성공적으로 삭제되었습니다.",
    });
  });

  static async getTemplates(req: Request, res: Response) {
    const userId = req?.user?.userId!;

    // 템플릿 전체 검색
    const templates = await TemplateService.getTemplatesByUserId(userId);

    // 응답 데이터 생성
    const data = templates.map((template: any) => ({
      templateUuid: template.template_uuid,
      title: template.title,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
      sharedCount: template.shared_count,
    }));

    // 응답 전송
    res.status(200).json({
      success: true,
      message: "템플릿 목록을 성공적으로 가져왔습니다.",
      data,
    });
  }
}

export default TemplateController;
