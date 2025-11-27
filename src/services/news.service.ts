import { dbPool } from "../config/db";
import NewsModel, { CreateNewsInput, UpdateNewsInput } from "../models/news.model";
import UserModel from "../models/user.model";
import NotificationService from "./notification.service";
import { ForbiddenError, NotFoundError } from "../errors/CustomErrors";

class NewsService {
  /**
   * 관리자 권한 확인
   * @param userPermission 사용자 권한
   * @throws ForbiddenError 관리자가 아닌 경우
   */
  static validateAdminPermission(userPermission: string) {
    if (userPermission !== "admin" && userPermission !== "superadmin") {
      throw new ForbiddenError("관리자만 접근할 수 있습니다.");
    }
  }

  /**
   * 공지사항 생성 및 모든 사용자에게 알림 전송
   * @param input 공지사항 생성 입력
   * @returns 생성된 공지사항 정보
   */
  static async createNews(input: CreateNewsInput) {
    const connection = await dbPool.getConnection();

    try {
      await connection.beginTransaction();

      // 공지사항 생성
      const result = await NewsModel.create(input, connection);

      // 모든 활성 사용자 UUID 조회
      const userUuids = await UserModel.findAllActiveUserUuids(connection);

      await connection.commit();

      // 모든 사용자에게 알림 전송 (비동기로 처리, 실패해도 공지사항 생성은 성공)
      this.sendNotificationsToAllUsers(userUuids, result.newsUuid, input.title);

      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 모든 사용자에게 공지사항 알림 전송 (비동기)
   * @param userUuids 사용자 UUID 목록
   * @param newsUuid 공지사항 UUID
   * @param newsTitle 공지사항 제목
   */
  private static async sendNotificationsToAllUsers(
    userUuids: string[],
    newsUuid: string,
    newsTitle: string
  ) {
    // 병렬로 알림 전송 (배치 처리)
    const batchSize = 50;
    for (let i = 0; i < userUuids.length; i += batchSize) {
      const batch = userUuids.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map((userUuid) =>
          NotificationService.createNotification({
            userUuid,
            type: "system",
            title: "새 공지사항",
            message: `새 공지사항이 등록되었습니다: ${newsTitle}`,
            targetType: "news",
            targetUuid: newsUuid,
          })
        )
      );
    }
  }

  /**
   * 공지사항 목록 조회
   * @param page 페이지 번호
   * @param limit 페이지당 항목 수
   * @returns 공지사항 목록 및 메타 정보
   */
  static async getNewsList(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const [news, total] = await Promise.all([
      NewsModel.findAll(dbPool, { limit, offset }),
      NewsModel.count(dbPool),
    ]);

    return {
      news: news.map((n: any) => ({
        uuid: n.news_uuid,
        title: n.title,
        category: n.category,
        isImportant: !!n.is_important,
        authorName: n.author_name,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 공지사항 상세 조회 (ID)
   * @param newsId 공지사항 ID
   * @returns 공지사항 상세 정보
   */
  static async getNewsById(newsId: number) {
    const news = await NewsModel.findById(newsId, dbPool);

    if (!news) {
      throw new NotFoundError("공지사항을 찾을 수 없습니다.");
    }

    return {
      id: news.news_id,
      uuid: news.news_uuid,
      title: news.title,
      content: news.content,
      category: news.category,
      isImportant: !!news.is_important,
      authorName: (news as any).author_name,
      createdAt: news.created_at,
      updatedAt: news.updated_at,
    };
  }

  /**
   * 공지사항 상세 조회 (UUID)
   * @param newsUuid 공지사항 UUID
   * @returns 공지사항 상세 정보
   */
  static async getNewsByUuid(newsUuid: string) {
    const news = await NewsModel.findByUuid(newsUuid, dbPool);

    if (!news) {
      throw new NotFoundError("공지사항을 찾을 수 없습니다.");
    }

    return {
      uuid: news.news_uuid,
      title: news.title,
      content: news.content,
      category: news.category,
      isImportant: !!news.is_important,
      authorName: (news as any).author_name,
      createdAt: news.created_at,
      updatedAt: news.updated_at,
    };
  }

  /**
   * UUID로 공지사항 ID 조회
   * @param newsUuid 공지사항 UUID
   * @returns 공지사항 ID
   */
  static async getNewsIdByUuid(newsUuid: string): Promise<number> {
    const news = await NewsModel.findByUuid(newsUuid, dbPool);

    if (!news) {
      throw new NotFoundError("공지사항을 찾을 수 없습니다.");
    }

    return news.news_id!;
  }

  /**
   * 공지사항 수정
   * @param newsId 공지사항 ID
   * @param input 수정할 데이터
   * @returns 수정 결과
   */
  static async updateNews(newsId: number, input: UpdateNewsInput) {
    const news = await NewsModel.findById(newsId, dbPool);

    if (!news) {
      throw new NotFoundError("공지사항을 찾을 수 없습니다.");
    }

    const affectedRows = await NewsModel.update(newsId, input, dbPool);

    if (affectedRows === 0) {
      throw new Error("공지사항 수정에 실패했습니다.");
    }

    return { success: true };
  }

  /**
   * 공지사항 수정 (UUID)
   * @param newsUuid 공지사항 UUID
   * @param input 수정할 데이터
   * @returns 수정 결과
   */
  static async updateNewsByUuid(newsUuid: string, input: UpdateNewsInput) {
    const news = await NewsModel.findByUuid(newsUuid, dbPool);

    if (!news) {
      throw new NotFoundError("공지사항을 찾을 수 없습니다.");
    }

    const affectedRows = await NewsModel.update(news.news_id!, input, dbPool);

    if (affectedRows === 0) {
      throw new Error("공지사항 수정에 실패했습니다.");
    }

    return { success: true };
  }

  /**
   * 공지사항 삭제 (UUID)
   * @param newsUuid 공지사항 UUID
   * @returns 삭제 결과
   */
  static async deleteNewsByUuid(newsUuid: string) {
    const news = await NewsModel.findByUuid(newsUuid, dbPool);

    if (!news) {
      throw new NotFoundError("공지사항을 찾을 수 없습니다.");
    }

    const affectedRows = await NewsModel.delete(news.news_id!, dbPool);

    if (affectedRows === 0) {
      throw new Error("공지사항 삭제에 실패했습니다.");
    }

    return { success: true };
  }
}

export default NewsService;
