import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";

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
        (SELECT COUNT(*) FROM likes WHERE target_type = 'post' AND target_uuid = p.post_uuid) AS likes_count
      FROM post p
      LEFT JOIN user u ON p.user_uuid = u.user_uuid
      WHERE p.post_uuid = ?
      `,
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

    res.status(200).json({
      success: true,
      post: {
        id: post.post_id,
        uuid: post.post_uuid,
        templateUuid: post.template_uuid,
        title: post.title,
        content: post.content,
        authorUuid: post.user_uuid,
        authorName: post.author_name,
        authorProfile: post.author_profile,
        createdAt: post.created_at,
        likes: post.likes_count || 0,
        shares: post.shares || 0,
        views: post.views || 0,
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

    // 댓글 조회 (사용자 정보 포함)
    const comments = await dbPool.query(
      `
      SELECT 
        c.*,
        u.name AS author_name, 
        u.profile_image AS author_profile,
        (SELECT COUNT(*) FROM likes WHERE target_type = 'comment' AND target_uuid = c.comment_uuid) AS likes_count,
        (SELECT EXISTS(SELECT 1 FROM likes WHERE target_type = 'comment' AND target_uuid = c.comment_uuid AND user_uuid = ?)) AS user_liked
      FROM post_comment c
      LEFT JOIN user u ON c.user_uuid = u.user_uuid
      WHERE c.post_uuid = ?
      ORDER BY c.created_at ASC
      `,
      [req.user?.userUuid || null, postUuid] // 로그인한 사용자가 좋아요했는지 확인
    );

    // 응답용 댓글 데이터 가공
    const formattedComments = comments.map((comment: any) => ({
      id: comment.comment_id,
      uuid: comment.comment_uuid,
      content: comment.content,
      authorUuid: comment.user_uuid,
      authorName: comment.author_name,
      authorProfile: comment.author_profile,
      parentUuid: comment.parent_comment_uuid,
      createdAt: comment.created_at,
      likes: comment.likes_count || 0,
      liked: !!comment.user_liked,
    }));

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
