import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import CardService from "../services/card.service";

class CardController {
  /**
   * 카드 생성
   */
  static createBoard = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { boardUuid, index } = req.body;

    // 카드 생성
    const cardUuid = await CardService.createCard(
      userId,
      boardUuid,
      index
    );

    // 응답 반환
    res.status(201).json({
      message: "카드가 성공적으로 생성되었습니다.",
      cardUuid,
    });
  });
}

export default CardController;
