import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";

// 페이지로 게시글 목록 조회
export const getPostsByPage = async (req: Request, res: Response) => {
  const POSTS_PER_PAGE = 10; // 페이지당 게시글 수

  try {
    const { page = "1", keyword = "" } = req.query;

    // 페이지 오프셋 계산
    const pageNumber = parseInt(page as string, 10);
    const pageOffset = (pageNumber - 1) * POSTS_PER_PAGE;

    // post 테이블에서 페이지에 맞는 게시글들 가져오기
    const posts = await dbPool.query(
      `
      SELECT 
        p.post_uuid, p.title, p.tag, p.shares, p.content, p.template_uuid,
        COALESCE(l.like_count, 0) AS like_count,
        IF(l2.user_uuid IS NULL, 0, 1) AS liked,
        COALESCE(c.comments, 0) AS comments,
        /* 템플릿 썸네일 (게시글 내용에 이미지가 없을 때 사용) */
        (
          SELECT loc.thumbnail_url
          FROM template t
          JOIN board b ON t.template_id = b.template_id
          JOIN card ca ON b.board_id = ca.board_id
          JOIN location loc ON ca.card_id = loc.card_id
          WHERE t.template_uuid COLLATE utf8mb4_unicode_ci = p.template_uuid COLLATE utf8mb4_unicode_ci
            AND loc.thumbnail_url IS NOT NULL
          ORDER BY b.day_number ASC, ca.order_index ASC
          LIMIT 1
        ) AS template_thumbnail
      FROM post AS p

      /* 좋아요 수 */
      LEFT JOIN (
        SELECT target_uuid, COUNT(*) AS like_count
        FROM likes
        WHERE target_type = 'post'
        GROUP BY target_uuid
      ) AS l ON p.post_uuid COLLATE utf8mb4_unicode_ci = l.target_uuid COLLATE utf8mb4_unicode_ci

      /* 좋아요 여부 */
      LEFT JOIN likes AS l2
        ON l2.target_type = 'post'
        AND l2.target_uuid COLLATE utf8mb4_unicode_ci = p.post_uuid COLLATE utf8mb4_unicode_ci
        AND l2.user_uuid = ? COLLATE utf8mb4_unicode_ci

      /* 댓글 수 */
      LEFT JOIN (
        SELECT post_uuid, COUNT(*) AS comments
        FROM post_comment
        GROUP BY post_uuid
      ) AS c ON c.post_uuid COLLATE utf8mb4_unicode_ci = p.post_uuid COLLATE utf8mb4_unicode_ci

      WHERE (p.title LIKE CONCAT('%', ?, '%')
        OR p.content LIKE CONCAT('%', ?, '%')
        OR p.tag LIKE CONCAT('%', ?, '%'))
      ORDER BY p.created_at DESC
      LIMIT ?
      OFFSET ?;
      `,
      [
        req.user?.userUuid,
        keyword,
        keyword,
        keyword,
        POSTS_PER_PAGE,
        pageOffset,
      ]
    );

    // 게시글 없음
    if (posts.length === 0) {
      res.status(404).json({
        success: false,
        message: "게시글을 찾을 수 없습니다.",
      });
      return;
    }

    // 게시글 내용에서 첫 번째 이미지 URL 추출
    const extractFirstImageUrl = (htmlContent?: string): string | null => {
      if (!htmlContent) return null;
      const imgRegex = /<img[^>]+src="([^">]+)"/;
      const match = htmlContent.match(imgRegex);
      return match ? match[1] : null;
    };

    // 응답 데이터 가공
    const response = posts.map((post: any) => {
      // 게시글 내용에서 이미지 추출, 없으면 템플릿 썸네일 사용
      const contentImage = extractFirstImageUrl(post.content);
      const thumbnail = contentImage || post.template_thumbnail || null;

      return {
        uuid: post.post_uuid,
        title: post.title,
        tags: post.tag ? post.tag.split(",") : [],
        liked: req.user ? !!post.liked : false,
        likes: Number(post.like_count || 0),
        shares: Number(post.shares || 0),
        content: post.content,
        comments: Number(post.comments || 0),
        thumbnail, // 썸네일 (내용 이미지 > 템플릿 썸네일)
      };
    });
    
    // 검색 결과 반환
    res.status(200).json({
      success: true,
      post: response,
    });
  } catch (err) {
    console.error("게시글 목록 조회 오류:", err);
    res.status(500).json({
      success: false,
      message: "게시글 목록을 불러오는 중 오류가 발생했습니다.",
    });
  }
};

// 인기 게시글 목록 조회
export const getPopularPosts = async (req: Request, res: Response) => {
  const RESULT_LENGTH = 10; // 조회할 인기 게시글 수
  try {
    // 좋아요 수가 많은 게시글 조회
    const posts = await dbPool.query(
      `
      SELECT 
        p.post_uuid, p.title, p.content, p.shares, p.template_uuid,
        u.name AS author_name, 
        u.profile_image AS author_profile_image,
        COALESCE(l.like_count, 0) AS like_count,
        COALESCE(l2.liked, 0) AS liked,
        COALESCE(c.comments, 0) AS comments,
        /* 템플릿 썸네일 (게시글 내용에 이미지가 없을 때 사용) */
        (
          SELECT loc.thumbnail_url
          FROM template t
          JOIN board b ON t.template_id = b.template_id
          JOIN card ca ON b.board_id = ca.board_id
          JOIN location loc ON ca.card_id = loc.card_id
          WHERE t.template_uuid COLLATE utf8mb4_unicode_ci = p.template_uuid COLLATE utf8mb4_unicode_ci
            AND loc.thumbnail_url IS NOT NULL
          ORDER BY b.day_number ASC, ca.order_index ASC
          LIMIT 1
        ) AS template_thumbnail
      FROM post AS p

      /* 작성자 */
      LEFT JOIN user AS u
        ON p.user_uuid COLLATE utf8mb4_unicode_ci = u.user_uuid COLLATE utf8mb4_unicode_ci

      /* 좋아요 수 */
      LEFT JOIN (
        SELECT target_uuid, COUNT(*) AS like_count
        FROM likes
        WHERE target_type = 'post'
        GROUP BY target_uuid
      ) AS l ON p.post_uuid COLLATE utf8mb4_unicode_ci = l.target_uuid COLLATE utf8mb4_unicode_ci

      /* 좋아요 여부 */
      LEFT JOIN (
        SELECT target_uuid, user_uuid, 1 AS liked
        FROM likes
        WHERE target_type = 'post'
      ) AS l2 ON l2.target_uuid COLLATE utf8mb4_unicode_ci = p.post_uuid AND l2.user_uuid = ? COLLATE utf8mb4_unicode_ci

      /* 댓글 수 */
      LEFT JOIN (
        SELECT post_uuid, COUNT(*) AS comments
        FROM post_comment
        GROUP BY post_uuid
      ) AS c ON c.post_uuid COLLATE utf8mb4_unicode_ci = p.post_uuid COLLATE utf8mb4_unicode_ci

      ORDER BY like_count DESC
      LIMIT ?;
      `,
      [req.user?.userUuid, RESULT_LENGTH]
    );

    // 인기 게시글이 없는 경우
    if (posts.length === 0) {
      res.status(404).json({
        success: false,
        message: "인기 게시글을 찾을 수 없습니다.",
      });
      return;
    }

    // 게시글 내용에서 첫 번째 이미지 URL 추출
    const extractFirstImageUrl = (htmlContent?: string): string | null => {
      if (!htmlContent) return null;
      const imgRegex = /<img[^>]+src="([^">]+)"/;
      const match = htmlContent.match(imgRegex);
      return match ? match[1] : null;
    };

    // 응답 데이터 가공
    const response = posts.map((post: any) => {
      // 게시글 내용에서 이미지 추출, 없으면 템플릿 썸네일 사용
      const contentImage = extractFirstImageUrl(post.content);
      const thumbnail = contentImage || post.template_thumbnail || null;

      return {
        uuid: post.post_uuid,
        title: post.title,
        authorName: post.author_name,
        authorProfileImage: post.author_profile_image,
        content: post.content,
        liked: req.user ? !!post.liked : false,
        likes: Number(post.like_count || 0),
        shares: Number(post.shares || 0),
        comments: Number(post.comments || 0),
        thumbnail, // 썸네일 (내용 이미지 > 템플릿 썸네일)
      };
    });

    // 검색 결과 반환
    res.status(200).json({
      success: true,
      post: response,
    });
  } catch (err) {
    console.error("인기 게시글 조회 오류:", err);
    res.status(500).json({
      success: false,
      message: "인기 게시글을 불러오는 중 오류가 발생했습니다.",
    });
  }
};

// UUID로 게시글 조회
export const getPostByUuid = async (req: Request, res: Response) => {
  try {
    const { postUuid } = req.params;

    // post 테이블에서 해당 UUID의 게시글 정보 가져오기
    const posts = await dbPool.query(
      `
      SELECT 
        p.*, 
        u.name AS author_name, 
        u.profile_image AS author_profile,
        (SELECT COUNT(*) FROM likes WHERE target_type = 'post' AND target_uuid = p.post_uuid COLLATE utf8mb4_unicode_ci) AS likes_count,
        (SELECT EXISTS(SELECT 1 FROM likes WHERE target_type = 'post' AND target_uuid = p.post_uuid COLLATE utf8mb4_unicode_ci AND user_uuid = ? COLLATE utf8mb4_unicode_ci)) AS user_liked
      FROM post p
      LEFT JOIN user u ON p.user_uuid COLLATE utf8mb4_unicode_ci = u.user_uuid
      WHERE p.post_uuid = ?
      `,
      [req.user?.userUuid || null, postUuid] // 로그인한 사용자가 좋아요했는지 확인
    );

    if (posts.length === 0) {
      res.status(404).json({
        success: false,
        message: "게시글을 찾을 수 없습니다.",
      });
      return;
    }

    const post = posts[0];

    res.status(200).json({
      success: true,
      post: {
        id: Number(post.post_id),
        uuid: post.post_uuid,
        templateUuid: post.template_uuid,
        title: post.title,
        content: post.content,
        tags: post.tag ? post.tag.split(",") : [],
        authorUuid: post.user_uuid,
        authorName: post.author_name,
        authorProfile: post.author_profile,
        createdAt: post.created_at,
        likes: Number(post.likes_count || 0),
        liked: req.user ? !!post.user_liked : false, // 명시적으로 로그인 유무 확인
        shares: Number(post.shares || 0),
        views: Number(post.views || 0),
      },
    });
  } catch (err) {
    console.error("게시글 조회 오류:", err);
    res.status(500).json({
      success: false,
      message: "게시글 정보를 불러오는 중 오류가 발생했습니다.",
    });
  }
};

// 게시글 작성
export const addPost = async (req: Request, res: Response) => {
  try {
    const userUuid = req.user?.userUuid;
    const { title, content, tags, templateUuid } = req.body;

    // 사용자 인증 실패
    if (!userUuid) {
      res.status(401).json({
        success: false,
        message: "로그인이 필요합니다.",
      });
      return;
    }

    // 필수 정보 누락
    if (!title || !content) {
      res.status(400).json({
        success: false,
        message: "제목과 내용을 입력해주세요.",
      });
      return;
    }

    // 트랜잭션 시작
    const connection = await dbPool.getConnection();
    await connection.beginTransaction();

    try {
      // 게시글 작성
      const response = await connection.query(
        `
        INSERT INTO post (user_uuid, title, content, tag, template_uuid)
        VALUES (?, ?, ?, ?, ?)
        `,
        [userUuid, title, content, tags ? tags.join(",") : null, templateUuid]
      );

      // 작성된 게시글 UUID 조회
      const postUuid = await connection.query(
        `SELECT post_uuid FROM post WHERE post_id = ?`,
        [response.insertId]
      );

      // 게시글 UUID가 없으면 오류 처리
      if (!postUuid.length || !postUuid[0].post_uuid) {
        res.status(500).json({
          success: false,
          message: "게시글 작성에 실패했습니다.",
        });
        throw new Error("게시글 작성 실패");
      }

      // 트랜잭션 커밋
      await connection.commit();

      // 작성 결과 반환
      res.status(201).json({
        success: true,
        message: "게시글이 성공적으로 작성되었습니다.",
        post: {
          uuid: postUuid[0].post_uuid,
          title,
          content,
          authorUuid: userUuid,
          tags: tags || [],
          templateUuid,
        },
      });
    } catch (error) {
      // 오류 발생 시 롤백
      await connection.rollback();
    }
  } catch (err) {
    console.error("게시글 작성 오류:", err);
    res.status(500).json({
      success: false,
      message: "게시글 작성 중 오류가 발생했습니다.",
    });
  }
};

// 게시글 수정
export const editPost = async (req: Request, res: Response) => {
  try {
    const { postUuid } = req.params;
    const userUuid = req.user?.userUuid;
    const { title, content, tags, templateUuid } = req.body;

    if (!userUuid) {
      res.status(401).json({
        success: false,
        message: "로그인이 필요합니다.",
      });
      return;
    }

    // 게시글 존재 여부 확인
    const posts = await dbPool.query(
      `SELECT user_uuid FROM post WHERE post_uuid = ?`,
      [postUuid]
    );

    // 게시글이 존재하지 않는 경우
    if (posts.length === 0) {
      res.status(404).json({
        success: false,
        message: "게시글을 찾을 수 없습니다.",
      });
      return;
    }

    // 작성자가 맞는지 확인
    if (posts[0].user_uuid !== userUuid) {
      res.status(403).json({
        success: false,
        message: "이 게시글을 수정할 권한이 없습니다.",
      });
      return;
    }

    // 트랜잭션 시작
    const connection = await dbPool.getConnection();
    await connection.beginTransaction();

    try {
      // 게시글 수정
      await connection.query(
        `
        UPDATE post 
        SET title = ?, content = ?, tag = ?, template_uuid = ?
        WHERE post_uuid = ?
        `,
        [title, content, tags ? tags.join(",") : null, templateUuid, postUuid]
      );

      // 트랜잭션 커밋
      await connection.commit();

      res.status(200).json({
        success: true,
        message: "게시글이 성공적으로 수정되었습니다.",
        post: {
          uuid: postUuid,
          title,
          content,
          authorUuid: userUuid,
          tags: tags || [],
          templateUuid,
        },
      });
    } catch (error) {
      // 오류 발생 시 롤백
      await connection.rollback();
      console.error("게시글 수정 중 오류 발생:", error);
    } finally {
      // 연결 해제
      connection.release();
    }
  } catch (err) {
    console.error("게시글 수정 오류:", err);
    res.status(500).json({
      success: false,
      message: "게시글 수정 중 오류가 발생했습니다.",
    });
  }
};

// 게시글 삭제
export const deletePost = async (req: Request, res: Response) => {
  try {
    const { postUuid } = req.params;
    const userUuid = req.user?.userUuid;

    if (!userUuid) {
      res.status(401).json({
        success: false,
        message: "로그인이 필요합니다.",
      });
      return;
    }

    // 게시글 작성자 확인
    const posts = await dbPool.query(
      `SELECT user_uuid FROM post WHERE post_uuid = ?`,
      [postUuid]
    );

    if (posts.length === 0) {
      res.status(404).json({
        success: false,
        message: "게시글을 찾을 수 없습니다.",
      });
      return;
    }

    const post = posts[0];

    // 작성자가 맞는지 확인
    if (post.user_uuid !== userUuid) {
      res.status(403).json({
        success: false,
        message: "이 게시글을 삭제할 권한이 없습니다.",
      });
      return;
    }

    // 트랜잭션 시작
    const connection = await dbPool.getConnection();
    await connection.beginTransaction();

    try {
      // 게시글에 달린 좋아요 먼저 삭제
      await connection.query(
        `DELETE FROM likes WHERE target_type = 'post' AND target_uuid = ?`,
        [postUuid]
      );

      // 게시글의 댓글에 달린 좋아요 삭제
      await connection.query(
        `DELETE FROM likes WHERE target_type = 'comment' AND target_uuid IN 
     (SELECT comment_uuid FROM post_comment WHERE post_uuid = ?)`,
        [postUuid]
      );

      // 게시글과 관련된 댓글 삭제
      await connection.query(`DELETE FROM post_comment WHERE post_uuid = ?`, [
        postUuid,
      ]);

      // 게시글 삭제
      await connection.query(`DELETE FROM post WHERE post_uuid = ?`, [
        postUuid,
      ]);

      // 트랜잭션 커밋
      await connection.commit();

      res.status(200).json({
        success: true,
        message: "게시글이 성공적으로 삭제되었습니다.",
      });
    } catch (error) {
      // 오류 발생 시 롤백
      await connection.rollback();
      console.error("게시글 삭제 중 오류 발생:", error);
    } finally {
      // 연결 해제
      connection.release();
    }
  } catch (err) {
    console.error("게시글 삭제 오류:", err);
    res.status(500).json({
      success: false,
      message: "게시글 삭제 중 오류가 발생했습니다.",
    });
    return;
  }
};

// 게시글의 댓글 목록 조회
export const getCommentsByPostUuid = async (req: Request, res: Response) => {
  try {
    const { postUuid } = req.params;

    // 게시글 존재 여부 확인
    const postExists = await dbPool.query(
      "SELECT post_id FROM post WHERE post_uuid = ?",
      [postUuid]
    );

    if (postExists.length === 0) {
      res.status(404).json({
        success: false,
        message: "게시글을 찾을 수 없습니다.",
      });
      return;
    }

    const comments = await dbPool.query(
      `
      SELECT 
        c.*,
        u.name AS author_name, 
        u.profile_image AS author_profile,
        (SELECT COUNT(*) FROM likes WHERE target_type = 'comment' AND target_uuid = c.comment_uuid COLLATE utf8mb4_unicode_ci) AS likes_count,
        IF(? IS NOT NULL, 
          (SELECT EXISTS(SELECT 1 FROM likes 
          WHERE target_type = 'comment' 
          AND target_uuid = c.comment_uuid COLLATE utf8mb4_unicode_ci 
          AND user_uuid = ? COLLATE utf8mb4_unicode_ci)), 
          0) AS user_liked
      FROM post_comment c
      LEFT JOIN user u ON c.user_uuid = u.user_uuid
      WHERE c.post_uuid = ?
      ORDER BY c.created_at ASC
      `,
      [req.user?.userUuid || null, req.user?.userUuid || null, postUuid] // 파라미터 두 번 전달
    );

    // 응답용 댓글 데이터 가공 부분도 업데이트
    const formattedComments = comments.map((comment: any) => {
      return {
        id: Number(comment.comment_id),
        uuid: comment.comment_uuid,
        content: comment.content,
        authorUuid: comment.user_uuid,
        authorName: comment.author_name,
        authorProfile: comment.author_profile,
        parentUuid: comment.parent_comment_uuid,
        createdAt: comment.created_at,
        likes: Number(comment.likes_count || 0),
        liked: req.user ? comment.user_liked === 1 : false, // 명시적으로 로그인 유무 확인
      };
    });

    res.status(200).json({
      success: true,
      comments: formattedComments,
    });
  } catch (err) {
    console.error("댓글 조회 오류:", err);
    res.status(500).json({
      success: false,
      message: "댓글을 불러오는 중 오류가 발생했습니다.",
    });
  }
};

// 댓글 작성 (새 댓글 또는 대댓글)
export const createComment = async (req: Request, res: Response) => {
  try {
    const { postUuid } = req.params;
    const { content, parentCommentUuid } = req.body;
    const userUuid = req.user?.userUuid;

    if (!userUuid) {
      res.status(401).json({
        success: false,
        message: "로그인이 필요합니다.",
      });
      return;
    }

    if (!content || content.trim() === "") {
      res.status(400).json({
        success: false,
        message: "댓글 내용을 입력해주세요.",
      });
      return;
    }

    // 게시글 존재 여부 확인
    const postExists = await dbPool.query(
      "SELECT post_id FROM post WHERE post_uuid = ?",
      [postUuid]
    );

    if (postExists.length === 0) {
      res.status(404).json({
        success: false,
        message: "게시글을 찾을 수 없습니다.",
      });
      return;
    }

    // 대댓글인 경우 확인 사항
    if (parentCommentUuid) {
      // 부모 댓글 존재 여부 확인
      const parentComment = await dbPool.query(
        "SELECT parent_comment_uuid FROM post_comment WHERE comment_uuid = ?",
        [parentCommentUuid]
      );

      if (parentComment.length === 0) {
        res.status(404).json({
          success: false,
          message: "부모 댓글을 찾을 수 없습니다.",
        });
        return;
      }

      // 대댓글 수준 제한 (부모 댓글이 이미 대댓글이면 작성 불가)
      if (parentComment[0].parent_comment_uuid) {
        res.status(400).json({
          success: false,
          message: "대댓글에는 더 이상 답글을 작성할 수 없습니다.",
        });
        return;
      }
    }

    // 새 댓글 UUID 생성
    const commentUuid = uuidv4();

    // 댓글 저장
    await dbPool.query(
      `
      INSERT INTO post_comment 
      (comment_uuid, parent_comment_uuid, post_uuid, user_uuid, content, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
      `,
      [commentUuid, parentCommentUuid || null, postUuid, userUuid, content]
    );

    // 작성한 댓글 정보 조회
    const newComment = await dbPool.query(
      `
      SELECT c.*, u.name AS author_name, u.profile_image AS author_profile
      FROM post_comment c
      LEFT JOIN user u ON c.user_uuid = u.user_uuid
      WHERE c.comment_uuid = ?
      `,
      [commentUuid]
    );

    if (newComment.length === 0) {
      res.status(500).json({
        success: false,
        message: "댓글 작성 후 정보를 불러오는데 실패했습니다.",
      });
      return;
    }

    const comment = newComment[0];

    res.status(201).json({
      success: true,
      message: "댓글이 작성되었습니다.",
      comment: {
        id: comment.comment_id,
        uuid: comment.comment_uuid,
        content: comment.content,
        authorUuid: comment.user_uuid,
        authorName: comment.author_name,
        authorProfile: comment.author_profile,
        parentUuid: comment.parent_comment_uuid,
        createdAt: comment.created_at,
        likes: 0,
      },
    });
  } catch (err) {
    console.error("댓글 작성 오류:", err);
    res.status(500).json({
      success: false,
      message: "댓글 작성 중 오류가 발생했습니다.",
    });
  }
};

// 댓글 수정
export const editComment = async (req: Request, res: Response) => {
  try {
    const { commentUuid } = req.params;
    const userUuid = req.user?.userUuid;
    const { content } = req.body;

    // 사용자 인증 실패
    if (!userUuid) {
      res.status(401).json({
        success: false,
        message: "로그인이 필요합니다.",
      });
      return;
    }

    // 댓글 내용이 비어있는 경우
    if (!content || content.trim() === "") {
      res.status(400).json({
        success: false,
        message: "댓글 내용을 입력해주세요.",
      });
      return;
    }

    // 댓글 정보 조회
    const comments = await dbPool.query(
      "SELECT user_uuid FROM post_comment WHERE comment_uuid = ?",
      [commentUuid]
    );

    // 댓글이 존재하지 않는 경우
    if (comments.length === 0) {
      res.status(404).json({
        success: false,
        message: "댓글을 찾을 수 없습니다.",
      });
      return;
    }

    // 작성자 권한 없음
    if (comments[0].user_uuid !== userUuid) {
      res.status(403).json({
        success: false,
        message: "이 댓글을 수정할 권한이 없습니다.",
      });
      return;
    }

    // 댓글 수정
    const connection = await dbPool.getConnection();

    try {
      // 트랜잭션 시작
      await connection.beginTransaction();

      // 댓글 수정
      await connection.query(
        "UPDATE post_comment SET content = ?, created_at = NOW() WHERE comment_uuid = ?",
        [content, commentUuid]
      );

      // 수정된 댓글 조회
      const comments = await connection.query(
        `
        SELECT c.*, u.name AS author_name, u.profile_image AS author_profile
        FROM post_comment c
        LEFT JOIN user u ON c.user_uuid = u.user_uuid
        WHERE c.comment_uuid = ?
        `,
        [commentUuid]
      );

      // 트랜잭션 커밋
      await connection.commit();

      // 결과 반환
      const comment = comments[0];
      res.status(200).json({
        success: true,
        message: "댓글이 수정되었습니다.",
        comment: {
          id: comment.comment_id,
          uuid: comment.comment_uuid,
          content: comment.content,
          authorUuid: comment.user_uuid,
          authorName: comment.author_name,
          authorProfile: comment.author_profile,
          parentUuid: comment.parent_comment_uuid,
          createdAt: comment.created_at,
          likes: 0,
        },
      });
    } catch (error) {
      await connection.rollback(); // 오류 발생 시 롤백

      console.error("댓글 수정 중 오류 발생:", error);
      res.status(500).json({
        success: false,
        message: "댓글 수정 중 오류가 발생했습니다.",
      });
    } finally {
      connection.release(); // 연결 해제
    }
  } catch (err) {
    console.error("댓글 수정 오류:", err);
    res.status(500).json({
      success: false,
      message: "댓글 수정 중 오류가 발생했습니다.",
    });
  }
};

// 댓글 삭제 (본인 댓글 또는 게시글 작성자가 삭제 가능)
export const deleteComment = async (req: Request, res: Response) => {
  try {
    const { commentUuid } = req.params;
    const userUuid = req.user?.userUuid;

    if (!userUuid) {
      res.status(401).json({
        success: false,
        message: "로그인이 필요합니다.",
      });
      return;
    }

    // 댓글 정보 조회 (게시글 UUID도 함께 가져옴)
    const comments = await dbPool.query(
      "SELECT user_uuid, post_uuid FROM post_comment WHERE comment_uuid = ?",
      [commentUuid]
    );

    if (comments.length === 0) {
      res.status(404).json({
        success: false,
        message: "댓글을 찾을 수 없습니다.",
      });
      return;
    }

    const comment = comments[0];

    // 게시글 작성자 확인
    const posts = await dbPool.query(
      "SELECT user_uuid FROM post WHERE post_uuid = ?",
      [comment.post_uuid]
    );

    if (posts.length === 0) {
      res.status(404).json({
        success: false,
        message: "게시글을 찾을 수 없습니다.",
      });
      return;
    }

    const post = posts[0];
    const isPostAuthor = post.user_uuid === userUuid;
    const isCommentAuthor = comment.user_uuid === userUuid;

    // 권한 확인 (본인 댓글이거나 게시글 작성자인 경우 삭제 가능)
    if (!isCommentAuthor && !isPostAuthor) {
      res.status(403).json({
        success: false,
        message: "이 댓글을 삭제할 권한이 없습니다.",
      });
      return;
    }

    const connection = await dbPool.getConnection();
    await connection.beginTransaction();

    try {
      // 해당 댓글의 좋아요 먼저 삭제
      await connection.query(
        "DELETE FROM likes WHERE target_type = 'comment' AND target_uuid = ?",
        [commentUuid]
      );

      // 대댓글이 있는 경우, 대댓글의 좋아요도 삭제
      await connection.query(
        `DELETE FROM likes WHERE target_type = 'comment' AND target_uuid IN 
     (SELECT comment_uuid FROM post_comment WHERE parent_comment_uuid = ?)`,
        [commentUuid]
      );

      // 대댓글 삭제
      await connection.query(
        "DELETE FROM post_comment WHERE parent_comment_uuid = ?",
        [commentUuid]
      );

      // 댓글 삭제
      await connection.query(
        "DELETE FROM post_comment WHERE comment_uuid = ?",
        [commentUuid]
      );

      await connection.commit();

      res.status(200).json({
        success: true,
        message: "댓글이 삭제되었습니다.",
      });
      return;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("댓글 삭제 오류:", err);
    res.status(500).json({
      success: false,
      message: "댓글 삭제 중 오류가 발생했습니다.",
    });
  }
};

// 게시글/댓글 좋아요 토글
export const toggleLike = async (req: Request, res: Response) => {
  try {
    const { targetType, targetUuid } = req.params; // post 또는 comment
    const userUuid = req.user?.userUuid;

    if (!userUuid) {
      res.status(401).json({
        success: false,
        message: "로그인이 필요합니다.",
      });
      return;
    }

    // 대상이 실제 존재하는지 확인
    let exists = false;
    if (targetType === "post") {
      const result = await dbPool.query(
        "SELECT post_id FROM post WHERE post_uuid = ?",
        [targetUuid]
      );
      exists = result.length > 0;
    } else if (targetType === "comment") {
      const result = await dbPool.query(
        "SELECT comment_id FROM post_comment WHERE comment_uuid = ?",
        [targetUuid]
      );
      exists = result.length > 0;
    }

    if (!exists) {
      res.status(404).json({
        success: false,
        message: `${
          targetType === "post" ? "게시글" : "댓글"
        }을 찾을 수 없습니다.`,
      });
      return;
    }

    // 좋아요 여부 확인
    const likeExists = await dbPool.query(
      "SELECT * FROM likes WHERE target_type = ? AND target_uuid = ? AND user_uuid = ?",
      [targetType, targetUuid, userUuid]
    );

    // 트랜잭션 시작
    const connection = await dbPool.getConnection();
    await connection.beginTransaction();

    try {
      if (likeExists.length > 0) {
        // 좋아요 취소
        await connection.query(
          "DELETE FROM likes WHERE target_type = ? AND target_uuid = ? AND user_uuid = ?",
          [targetType, targetUuid, userUuid]
        );

        await connection.commit();

        res.status(200).json({
          success: true,
          message: `${
            targetType === "post" ? "게시글" : "댓글"
          } 좋아요가 취소되었습니다.`,
          liked: false,
        });
      } else {
        // 좋아요 추가
        await connection.query(
          "INSERT INTO likes (target_type, target_uuid, user_uuid, created_at) VALUES (?, ?, ?, NOW())",
          [targetType, targetUuid, userUuid]
        );

        await connection.commit();

        res.status(200).json({
          success: true,
          message: `${
            targetType === "post" ? "게시글" : "댓글"
          }에 좋아요를 했습니다.`,
          liked: true,
        });
      }
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("좋아요 처리 오류:", err);
    res.status(500).json({
      success: false,
      message: "좋아요 처리 중 오류가 발생했습니다.",
    });
  }
};

// 좋아요 한 게시글 목록 조회
export const getLikedPosts = async (req: Request, res: Response) => {
  const POSTS_PER_PAGE = 10; // 페이지당 게시글 수

  try {
    const userUuid = req.user?.userUuid;
    const { page = "1" } = req.query;

    // 사용자 인증 실패
    if (!userUuid) {
      res.status(401).json({
        success: false,
        message: "로그인이 필요합니다.",
      });
      return;
    }

    // 페이지 오프셋 계산
    const pageNumber = parseInt(page as string, 10);
    const pageOffset = (pageNumber - 1) * POSTS_PER_PAGE;

    // 좋아요 한 게시글 목록 조회
    const posts = await dbPool.query(
      `
      SELECT 
        p.post_uuid, p.title, p.tag, p.shares, p.content, p.template_uuid,
        u.name AS author_name,
        u.profile_image AS author_profile_image,
        COALESCE(l_count.like_count, 0) AS like_count,
        1 AS liked,
        COALESCE(c.comments, 0) AS comments,
        l.created_at AS liked_at,
        /* 템플릿 썸네일 (게시글 내용에 이미지가 없을 때 사용) */
        (
          SELECT loc.thumbnail_url
          FROM template t
          JOIN board b ON t.template_id = b.template_id
          JOIN card ca ON b.board_id = ca.board_id
          JOIN location loc ON ca.card_id = loc.card_id
          WHERE t.template_uuid COLLATE utf8mb4_unicode_ci = p.template_uuid COLLATE utf8mb4_unicode_ci
            AND loc.thumbnail_url IS NOT NULL
          ORDER BY b.day_number ASC, ca.order_index ASC
          LIMIT 1
        ) AS template_thumbnail
      FROM likes AS l

      /* 게시글 정보 */
      INNER JOIN post AS p 
        ON l.target_uuid COLLATE utf8mb4_unicode_ci = p.post_uuid COLLATE utf8mb4_unicode_ci

      /* 작성자 정보 */
      LEFT JOIN user AS u
        ON p.user_uuid COLLATE utf8mb4_unicode_ci = u.user_uuid COLLATE utf8mb4_unicode_ci

      /* 좋아요 수 */
      LEFT JOIN (
        SELECT target_uuid, COUNT(*) AS like_count
        FROM likes
        WHERE target_type = 'post'
        GROUP BY target_uuid
      ) AS l_count ON p.post_uuid COLLATE utf8mb4_unicode_ci = l_count.target_uuid COLLATE utf8mb4_unicode_ci

      /* 댓글 수 */
      LEFT JOIN (
        SELECT post_uuid, COUNT(*) AS comments
        FROM post_comment
        GROUP BY post_uuid
      ) AS c ON c.post_uuid COLLATE utf8mb4_unicode_ci = p.post_uuid COLLATE utf8mb4_unicode_ci

      WHERE l.user_uuid = ? COLLATE utf8mb4_unicode_ci
        AND l.target_type = 'post'
      ORDER BY l.created_at DESC
      LIMIT ?
      OFFSET ?;
      `,
      [userUuid, POSTS_PER_PAGE, pageOffset]
    );

    // 게시글 내용에서 첫 번째 이미지 URL 추출
    const extractFirstImageUrl = (htmlContent?: string): string | null => {
      if (!htmlContent) return null;
      const imgRegex = /<img[^>]+src="([^">]+)"/;
      const match = htmlContent.match(imgRegex);
      return match ? match[1] : null;
    };

    // 응답 데이터 가공
    const response = posts.map((post: any) => {
      // 게시글 내용에서 이미지 추출, 없으면 템플릿 썸네일 사용
      const contentImage = extractFirstImageUrl(post.content);
      const thumbnail = contentImage || post.template_thumbnail || null;

      return {
        uuid: post.post_uuid,
        title: post.title,
        tags: post.tag ? post.tag.split(",") : [],
        authorName: post.author_name,
        authorProfileImage: post.author_profile_image,
        liked: true,
        likes: Number(post.like_count || 0),
        shares: Number(post.shares || 0),
        content: post.content,
        comments: Number(post.comments || 0),
        thumbnail,
        likedAt: post.liked_at,
      };
    });

    // 검색 결과 반환
    res.status(200).json({
      success: true,
      posts: response,
      hasMore: posts.length === POSTS_PER_PAGE,
    });
  } catch (err) {
    console.error("좋아요 한 게시글 목록 조회 오류:", err);
    res.status(500).json({
      success: false,
      message: "좋아요 한 게시글 목록을 불러오는 중 오류가 발생했습니다.",
    });
  }
};

// 인기 태그 목록 조회
export const getPopularTags = async (req: Request, res: Response) => {
  const RESULT_LENGTH = 10; // 조회할 인기 태그 수

  try {
    // 태그별 게시글 수 조회
    const tags = await dbPool.query(
      `
      SELECT tag
      FROM post
      WHERE tag IS NOT NULL AND tag != ''
      LIMIT ?;
      `,
      [RESULT_LENGTH]
    );

    // 인기 태그가 없는 경우
    if (tags.length === 0) {
      res.status(404).json({
        success: false,
        message: "인기 태그를 찾을 수 없습니다.",
      });
      return;
    }

    // 응답 데이터 가공
    // 태그별로 카운트하는 딕셔너리 선언
    const tagCounts: { [tag: string]: number } = {};

    tags.forEach((row: { tag: string; }) => {
      if (!row.tag) return;
      const splittedTags = row.tag.split(",").map((t: string) => t.trim());
      splittedTags.forEach((tag: string) => {
        if (tag) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      });
    });

    // 태그를 postCount 기준으로 정렬 후 상위 RESULT_LENGTH개만 추출
    const response = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, RESULT_LENGTH)
      .map(([name, postCount]) => ({
        name,
        postCount,
      }));

    // 인기 태그 목록 반환
    res.status(200).json({
      success: true,
      tags: response,
    });
  } catch (err) {
    console.error("인기 태그 조회 오류:", err);
    res.status(500).json({
      success: false,
      message: "인기 태그를 불러오는 중 오류가 발생했습니다.",
    });
  }
};
