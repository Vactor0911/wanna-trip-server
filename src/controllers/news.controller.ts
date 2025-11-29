import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import NewsService from "../services/news.service";

class NewsController {
  /**
   * 공지사항 목록 조회
   */
  static getNewsList = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await NewsService.getNewsList(page, limit);

    res.status(200).json({
      success: true,
      ...result,
    });
  });

  /**
   * 공지사항 상세 조회
   */
  static getNewsById = asyncHandler(async (req: Request, res: Response) => {
    const newsUuid = req.params.newsUuid;

    const news = await NewsService.getNewsByUuid(newsUuid);

    res.status(200).json({
      success: true,
      news,
    });
  });

  /**
   * 공지사항 생성 (관리자 전용)
   */
  static createNews = asyncHandler(async (req: Request, res: Response) => {
    const userUuid = req.user?.userUuid!;
    const userPermission = req.user?.permission!;

    // 관리자 권한 확인
    NewsService.validateAdminPermission(userPermission);

    const { title, content, category, isImportant } = req.body;

    const result = await NewsService.createNews({
      userUuid,
      title,
      content,
      category,
      isImportant,
    });

    res.status(201).json({
      success: true,
      message: "공지사항이 성공적으로 등록되었습니다.",
      newsUuid: result.newsUuid,
    });
  });

  /**
   * 공지사항 수정 (관리자 전용)
   */
  static updateNews = asyncHandler(async (req: Request, res: Response) => {
    const userPermission = req.user?.permission!;

    // 관리자 권한 확인
    NewsService.validateAdminPermission(userPermission);

    const newsUuid = req.params.newsUuid;
    const { title, content, category, isImportant } = req.body;

    await NewsService.updateNewsByUuid(newsUuid, {
      title,
      content,
      category,
      isImportant,
    });

    res.status(200).json({
      success: true,
      message: "공지사항이 성공적으로 수정되었습니다.",
    });
  });

  /**
   * 공지사항 삭제 (관리자 전용)
   */
  static deleteNews = asyncHandler(async (req: Request, res: Response) => {
    const userPermission = req.user?.permission!;

    // 관리자 권한 확인
    NewsService.validateAdminPermission(userPermission);

    const newsUuid = req.params.newsUuid;

    await NewsService.deleteNewsByUuid(newsUuid);

    res.status(200).json({
      success: true,
      message: "공지사항이 성공적으로 삭제되었습니다.",
    });
  });
}

export default NewsController;
