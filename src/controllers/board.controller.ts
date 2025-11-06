import z from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { Request, Response } from "express";
import { BadRequestError } from "../errors/CustomErrors";
import TransactionHandler from "../utils/transactionHandler";
import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";
import BoardService from "../services/board.service";
import TemplateService from "../services/template.service";

class BoardController {
  /**
   * 마지막 일차에 보드 추가
   */
  static createBoard = asyncHandler(async (req: Request, res: Response) => {
    const userId = req?.user?.userId!;

    // 요청 데이터 검증
    const createBoardSchema = z.object({
      templateUuid: z.uuid({
        version: "v4",
        message: "템플릿 UUID가 유효하지 않습니다.",
      }),
      dayNumber: z.number().optional(),
    });
    const parsed = createBoardSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.message);
    }

    // 데이터 추출
    const { templateUuid, dayNumber = -1 } = parsed.data;

    // 트랜잭션 실행
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 보드 생성
        const boardUuid = uuidv4();

        if (dayNumber !== null) {
          // 특정 일차에 보드 생성
          await BoardService.insertBoard(
            userId,
            boardUuid,
            templateUuid,
            dayNumber,
            connection
          );
        } else {
          // 마지막 일차에 보드 생성
          await BoardService.appendBoard(
            userId,
            boardUuid,
            templateUuid,
            connection
          );
        }

        // 응답 전송
        res.status(201).json({
          success: true,
          message: "보드가 성공적으로 생성되었습니다.",
        });
      }
    );
  });

  /**
   * 보드 삭제
   */
  static deleteBoard = asyncHandler(async (req: Request, res: Response) => {
    const userId = req?.user?.userId!;

    // 요청 데이터 검증
    const deleteBoardSchema = z.object({
      boardUuid: z.uuid({
        version: "v4",
        message: "보드 UUID가 유효하지 않습니다.",
      }),
    });
    const parsed = deleteBoardSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.message);
    }

    // 데이터 추출
    const { boardUuid } = parsed.data;

    // 트랜잭션 실행
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 보드 삭제
        await BoardService.deleteBoard(userId, boardUuid, connection);
      }
    );

    // 응답 전송
    res.status(200).json({
      success: true,
      message: "보드가 성공적으로 삭제되었습니다.",
    });
  });
}

export default BoardController;
