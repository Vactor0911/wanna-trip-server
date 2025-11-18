import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import CardService from "../services/card.service";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

class CardController {
  /**
   * 카드 생성
   */
  static createCard = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { boardUuid, orderIndex, startTime, location } = req.body;

    // 카드 생성
    const cardUuid = await CardService.createCard(
      userId,
      boardUuid,
      orderIndex,
      dayjs(startTime, "HH:mm:ss"),
      location
    );

    // 응답 반환
    res.status(201).json({
      success: true,
      message: "카드가 성공적으로 생성되었습니다.",
      cardUuid,
    });
  });

  /**
   * 카드 조회
   */
  static getCard = asyncHandler(async (req: Request, res: Response) => {
    const { cardUuid } = req.params;

    // 카드 조회
    const card = await CardService.getCardByUuid(cardUuid);

    // 응답 반환
    res.status(200).json({
      success: true,
      message: "카드가 성공적으로 조회되었습니다.",
      card,
    });
  });

  /**
   * 카드 삭제
   */
  static deleteCard = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { cardUuid } = req.params;

    // 카드 삭제
    await CardService.deleteCard(userId, cardUuid);

    // 응답 반환
    res.status(200).json({
      success: true,
      message: "카드가 성공적으로 삭제되었습니다.",
    });
  });

  /**
   * 카드 수정
   */
  static updateCard = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { cardUuid } = req.params;
    const { content, startTime, endTime, orderIndex, locked, location } =
      req.body;

    // 카드 수정
    await CardService.updateCard(userId, cardUuid, {
      content,
      startTime: dayjs(startTime, "HH:mm:ss"),
      endTime: dayjs(endTime, "HH:mm:ss"),
      orderIndex,
      locked,
      location,
    });

    // 응답 반환
    res.status(200).json({
      success: true,
      message: "카드가 성공적으로 수정되었습니다.",
    });
  });

  /**
   * 카드 이동
   */
  static moveCard = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { cardUuid, boardUuid, orderIndex } = req.body;

    // 카드 이동
    await CardService.moveCard(userId, cardUuid, boardUuid, orderIndex);

    // 응답 반환
    res.status(200).json({
      success: true,
      message: "카드가 성공적으로 이동되었습니다.",
    });
  });

  /**
   * 카드 복제
   */
  static copyCard = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { cardUuid } = req.params;

    // 카드 복제
    const newCardUuid = await CardService.copyCard(userId, cardUuid);

    // 응답 반환
    res.status(201).json({
      success: true,
      message: "카드가 성공적으로 복제되었습니다.",
      cardUuid: newCardUuid,
    });
  });

  /**
   * 카드 위치 정보 조회
   */
  static getLocation = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { cardUuid } = req.params;

    // 카드 위치 정보 조회
    const location = await CardService.getLocation(userId, cardUuid);

    // 응답 반환
    if (location) {
      res.status(200).json({
        success: true,
        message: "카드 위치 정보가 성공적으로 조회되었습니다.",
        location,
      });
    } else {
      res.status(204).send();
    }
  });
}

export default CardController;
