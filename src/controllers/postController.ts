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