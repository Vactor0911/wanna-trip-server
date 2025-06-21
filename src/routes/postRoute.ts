import express from "express";
import { csrfProtection, limiter } from "../utils";
import { authenticateToken } from "../middleware/authenticate";
import {
  createComment,
  deleteComment,
  deletePost,
  getCommentsByPostUuid,
  getPostByUuid,
  toggleLike,
} from "../controllers/postController";

const postRoute = express.Router();

// UUID로 게시글 조회 (로그인 없이도 조회 가능)
postRoute.get("/:postUuid", limiter, getPostByUuid);

// 게시글 삭제
postRoute.delete(
  "/:postUuid",
  limiter,
  authenticateToken,
  csrfProtection,
  deletePost
);

// 게시글의 댓글 목록 조회 (로그인 없이도 조회 가능)
postRoute.get("/comments/:postUuid", limiter, getCommentsByPostUuid);

// 댓글 작성
postRoute.post(
  "/comments/:postUuid",
  limiter,
  authenticateToken,
  csrfProtection,
  createComment
);

// 댓글 삭제 (본인 댓글 또는 게시글 작성자가 삭제 가능)
postRoute.delete(
  "/comments/:commentUuid",
  limiter,
  authenticateToken,
  csrfProtection,
  deleteComment
);

// 게시글 / 댓글 좋아요 토글
postRoute.post(
  "/likes/:targetType/:targetUuid",
  limiter,
  authenticateToken,
  csrfProtection,
  toggleLike
);

export default postRoute;
