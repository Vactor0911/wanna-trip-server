import { Request, Response } from "express";
import { dbPool } from "../config/db";

// UUID로 게시글 조회
export const getPostByUuid = async (req: Request, res: Response) => {
  try {
    const { postUuid } = req.params;

    // post 테이블에서 해당 UUID의 게시글 정보 가져오기
    const posts = await dbPool.query(
      `
      SELECT p.*, u.name AS author_name, u.profile_image AS author_profile 
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
        likes: post.likes || 0,
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
    console.log("삭제하는 유저 ", userUuid);

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
      // 게시글과 관련된 댓글 먼저 삭제
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
