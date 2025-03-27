import express from "express";
import { googleLogin, kakaoLogin, login, logout, register } from "../controllers/authController";

const authRoute = express.Router();

authRoute.post("/login", login);
authRoute.post("/login/kakao", kakaoLogin);
authRoute.post("/login/google", googleLogin);
authRoute.post("/register", register);
authRoute.post("/logout", logout);
export default authRoute;
