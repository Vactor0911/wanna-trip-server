import express from "express";
import { csrfProtection, limiter } from "../utils";
import { authenticateToken } from "../middleware/authenticate";
import { deletePost, getPostByUuid } from "../controllers/postController";

const postRoute = express.Router();

// UUID로 게시글 조회 (로그인 없이도 조회 가능)
postRoute.get("/:postUuid", limiter, getPostByUuid);

// 게시글 삭제
postRoute.delete("/:postUuid", limiter, authenticateToken, csrfProtection, deletePost);

export default postRoute;
