import express from "express";
import { csrfProtection, limiter, refreshTokenLimiter } from "../utils";
import { authenticateToken } from "../middleware/authenticate";
import { getPostByUuid } from "../controllers/postController";

const postRoute = express.Router();

// UUID로 게시글 조회 (로그인 없이도 조회 가능)
postRoute.get("/:postUuid", limiter, getPostByUuid);




export default postRoute;