import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import CardService from "../services/card.service";
import dayjs from "dayjs";

class CardController {
  /**
   * 카드 생성
   */
  static createCard = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { boardUuid, index, startTime } = req.body;

    // 카드 생성
    const cardUuid = await CardService.createCard(
      userId,
      boardUuid,
      index,
      dayjs(startTime)
    );

    // 응답 반환
    res.status(201).json({
      message: "카드가 성공적으로 생성되었습니다.",
      cardUuid,
    });
  });
}

export default CardController;
