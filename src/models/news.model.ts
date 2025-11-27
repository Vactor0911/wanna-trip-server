import { Pool, PoolConnection } from "mariadb";

// 공지사항 인터페이스
export interface News {
  news_id?: number;
  news_uuid?: string;
  author_uuid: string;
  title: string;
  content: string;
  category?: string;
  is_important?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

// 공지사항 생성 입력 인터페이스
export interface CreateNewsInput {
  userUuid: string;
  title: string;
  content: string;
  category?: string;
  isImportant?: boolean;
}

// 공지사항 수정 입력 인터페이스
export interface UpdateNewsInput {
  title?: string;
  content?: string;
  category?: string;
  isImportant?: boolean;
}

class NewsModel {
  /**
   * 공지사항 생성
   * @param input 공지사항 생성 입력
   * @param connection 데이터베이스 연결 객체
   * @returns 생성된 공지사항 ID 및 UUID
   */
  static async create(
    input: CreateNewsInput,
    connection: PoolConnection | Pool
  ): Promise<{ insertId: number; newsUuid: string }> {
    const result = await connection.query(
      `
      INSERT INTO news (author_uuid, title, content, category, is_important)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        input.userUuid,
        input.title,
        input.content,
        input.category || "공지",
        input.isImportant || false,
      ]
    );

    // 생성된 공지사항의 UUID 조회
    const [news] = await connection.query(
      `SELECT news_uuid FROM news WHERE news_id = ?`,
      [result.insertId]
    );

    return {
      insertId: result.insertId,
      newsUuid: news.news_uuid,
    };
  }

  /**
   * 공지사항 목록 조회 (페이징)
   * @param connection 데이터베이스 연결 객체
   * @param options 조회 옵션 (limit, offset)
   * @returns 공지사항 목록
   */
  static async findAll(
    connection: PoolConnection | Pool,
    options: { limit?: number; offset?: number } = {}
  ): Promise<News[]> {
    const { limit = 20, offset = 0 } = options;

    const news = await connection.query(
      `
      SELECT 
        n.news_id,
        n.news_uuid,
        n.author_uuid,
        n.title,
        n.category,
        n.is_important,
        n.created_at,
        n.updated_at,
        u.name AS author_name
      FROM news n
      LEFT JOIN user u ON n.author_uuid = u.user_uuid
      ORDER BY n.is_important DESC, n.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [limit, offset]
    );

    return news;
  }

  /**
   * 공지사항 총 개수 조회
   * @param connection 데이터베이스 연결 객체
   * @returns 공지사항 총 개수
   */
  static async count(connection: PoolConnection | Pool): Promise<number> {
    const [result] = await connection.query(
      `SELECT COUNT(*) AS count FROM news`
    );
    return Number(result.count);
  }

  /**
   * 공지사항 ID로 조회
   * @param newsId 공지사항 ID
   * @param connection 데이터베이스 연결 객체
   * @returns 공지사항 정보
   */
  static async findById(
    newsId: number,
    connection: PoolConnection | Pool
  ): Promise<News | null> {
    const [news] = await connection.query(
      `
      SELECT 
        n.*,
        u.name AS author_name
      FROM news n
      LEFT JOIN user u ON n.author_uuid = u.user_uuid
      WHERE n.news_id = ?
      `,
      [newsId]
    );

    return news || null;
  }

  /**
   * 공지사항 UUID로 조회
   * @param newsUuid 공지사항 UUID
   * @param connection 데이터베이스 연결 객체
   * @returns 공지사항 정보
   */
  static async findByUuid(
    newsUuid: string,
    connection: PoolConnection | Pool
  ): Promise<News | null> {
    const [news] = await connection.query(
      `
      SELECT 
        n.*,
        u.name AS author_name
      FROM news n
      LEFT JOIN user u ON n.author_uuid = u.user_uuid
      WHERE n.news_uuid = ?
      `,
      [newsUuid]
    );

    return news || null;
  }

  /**
   * 공지사항 수정
   * @param newsId 공지사항 ID
   * @param input 수정할 데이터
   * @param connection 데이터베이스 연결 객체
   * @returns 수정된 행 수
   */
  static async update(
    newsId: number,
    input: UpdateNewsInput,
    connection: PoolConnection | Pool
  ): Promise<number> {
    const fields: string[] = [];
    const values: any[] = [];

    if (input.title !== undefined) {
      fields.push("title = ?");
      values.push(input.title);
    }
    if (input.content !== undefined) {
      fields.push("content = ?");
      values.push(input.content);
    }
    if (input.category !== undefined) {
      fields.push("category = ?");
      values.push(input.category);
    }
    if (input.isImportant !== undefined) {
      fields.push("is_important = ?");
      values.push(input.isImportant);
    }

    if (fields.length === 0) {
      return 0;
    }

    fields.push("updated_at = NOW()");
    values.push(newsId);

    const result = await connection.query(
      `UPDATE news SET ${fields.join(", ")} WHERE news_id = ?`,
      values
    );

    return result.affectedRows;
  }

  /**
   * 공지사항 삭제
   * @param newsId 공지사항 ID
   * @param connection 데이터베이스 연결 객체
   * @returns 삭제된 행 수
   */
  static async delete(
    newsId: number,
    connection: PoolConnection | Pool
  ): Promise<number> {
    const result = await connection.query(
      `DELETE FROM news WHERE news_id = ?`,
      [newsId]
    );

    return result.affectedRows;
  }
}

export default NewsModel;
