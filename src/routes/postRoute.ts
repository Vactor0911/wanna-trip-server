import express from "express";
import { csrfProtection, limiter, refreshTokenLimiter } from "../utils";
import { authenticateToken } from "../middleware/authenticate";

const postRoute = express.Router();






export default postRoute;