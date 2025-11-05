import { Request, Response } from "express";
import z from "zod";
import { dbPool } from "../config/db";
import TemplateService from "../services/template.service";
import BoardService from "../services/board.service";
import { v4 as uuidv4 } from "uuid";

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

    // DB 커넥션 획득
    const connection = await dbPool.getConnection();

    try {
      // 트랜잭션 시작
      await connection.beginTransaction();

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

      // 트랜잭션 커밋
      await connection.commit();

      // 응답 전송
      res.status(201).json({
        success: true,
        message: "템플릿이 성공적으로 생성되었습니다.",
        data: {
          templateUuid,
        },
      });
    } catch (error) {
      // 트랜잭션 롤백
      await connection.rollback();

      // 오류 응답 전송
      console.error("템플릿 생성 오류:", error);
      res.status(500).json({
        success: false,
        message: "템플릿을 생성하는 중 오류가 발생했습니다.",
      });
    } finally {
      // 커넥션 반환
      connection.release();
    }
  }

  /**
   * 템플릿 삭제
   */
  static async deleteTemplate(req: Request, res: Response) {
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

    // DB 커넥션 획득
    const connection = await dbPool.getConnection();

    try {
      // 트랜잭션 시작
      await connection.beginTransaction();

      // 템플릿 삭제
      await TemplateService.deleteTemplateByUuid(
        userId,
        templateUuid,
        connection
      );

      // 트랜잭션 커밋
      await connection.commit();

      // 응답 전송
      res.status(200).json({
        success: true,
        message: "템플릿이 성공적으로 삭제되었습니다.",
      });
    } catch (error) {
      // 트랜잭션 롤백
      await connection.rollback();

      // 오류 응답 전송
      console.error("템플릿 삭제 오류:", error);
      res.status(500).json({
        success: false,
        message: "템플릿을 삭제하는 중 오류가 발생했습니다.",
      });
    } finally {
      // 커넥션 반환
      connection.release();
    }
  }
}

export default TemplateController;
