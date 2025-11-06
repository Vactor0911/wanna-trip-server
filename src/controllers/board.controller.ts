import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import BoardService from "../services/board.service";

class BoardController {
  static createBoard = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { templateUuid, dayNumber } = req.body;

    // 보드 생성
    const boardUuid = await BoardService.createBoard(
      userId,
      templateUuid,
      dayNumber
    );

    // 응답 반환
    res.status(201).json({
      message: "보드가 성공적으로 생성되었습니다.",
      boardUuid,
    });
  });
}

export default BoardController;
