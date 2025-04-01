import express from "express";
import { googleLogin, kakaoLogin, login, logout, register, resetPassword, sendVerifyEmail, verifyEmailCode } from "../controllers/authController";
import { csrfProtection } from "../utils";

const authRoute = express.Router();

authRoute.post("/login", login);
authRoute.post("/login/kakao", kakaoLogin);
authRoute.post("/login/google", googleLogin);
authRoute.post("/register", register);
authRoute.post("/logout", logout);

// 비밀번호 재설정 관련
authRoute.patch("/resetPassword", csrfProtection, resetPassword);

// 이메일 인증 관련
authRoute.post("/sendVerifyEmail", sendVerifyEmail);
authRoute.post("/verifyEmailCode", verifyEmailCode);

export default authRoute;
