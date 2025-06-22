import express from "express";
import { csrfProtection, limiter } from "../utils";
import {
  authenticateToken,
  optionalAuthenticate,
} from "../middleware/authenticate";
import {
  addPost,
  createComment,
  deleteComment,
  deletePost,
  editComment,
  editPost,
  getCommentsByPostUuid,
  getPopularPosts,
  getPopularTags,
  getPostByUuid,
  getPostsByPage,
  toggleLike,
} from "../controllers/postController";

const postRoute = express.Router();

// 페이지로 게시글 목록 조회 - 비로그인용
postRoute.get("/page", limiter, optionalAuthenticate, getPostsByPage);

// 페이지로 게시글 목록 조회 - 로그인용
postRoute.get("/auth/page", limiter, authenticateToken, getPostsByPage);

// 인기 게시글 목록 조회 - 비로그인용
postRoute.get("/popular", limiter, optionalAuthenticate, getPopularPosts);

// 인기 게시글 목록 조회 - 로그인용
postRoute.get("/auth/popular", limiter, authenticateToken, getPopularPosts);

// UUID로 게시글 조회 (로그인 없이도 조회 가능)
postRoute.get("/:postUuid", limiter, optionalAuthenticate, getPostByUuid);

// 게시글 작성
postRoute.post("/add", limiter, authenticateToken, csrfProtection, addPost);

// 게시글 수정
postRoute.put(
  "/:postUuid",
  limiter,
  authenticateToken,
  csrfProtection,
  editPost
);

// 게시글 삭제
postRoute.delete(
  "/:postUuid",
  limiter,
  authenticateToken,
  csrfProtection,
  deletePost
);

// 게시글의 댓글 목록 조회 (로그인 없이도 조회 가능)
postRoute.get(
  "/comments/:postUuid",
  limiter,
  optionalAuthenticate,
  getCommentsByPostUuid
);

// 댓글 작성
postRoute.post(
  "/comments/:postUuid",
  limiter,
  authenticateToken,
  csrfProtection,
  createComment
);

// 댓글 수정
postRoute.put(
  "/comments/:commentUuid",
  limiter,
  authenticateToken,
  csrfProtection,
  editComment
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

// 인기 태그 조회
postRoute.get("/tags/popular", limiter, optionalAuthenticate, getPopularTags);

export default postRoute;
