import express from "express";
import { csrfToken } from "../controllers/csrfController";
import { csrfProtection } from "../utils";

const csrfRoute = express.Router();

// CSRF 토큰 요청
csrfRoute.get("/csrfToken", csrfProtection, csrfToken);

export default csrfRoute;
