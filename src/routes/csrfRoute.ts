import express from "express";
import { csrfToken } from "../controllers/csrfController";
import { csrfProtection } from "../utils";

const csrfRoute = express.Router();

// csrfProtection 미들웨어를 적용하여 CSRF 토큰 생성 가능하게 함
csrfRoute.get("/csrfToken", csrfProtection, csrfToken);

export default csrfRoute;
