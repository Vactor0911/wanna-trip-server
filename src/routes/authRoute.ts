import express from "express";
import { googleLogin, kakaoLogin, login, logout, refreshToken, register, resetPassword, sendVerifyEmail, verifyEmailCode } from "../controllers/authController";
import { csrfProtection, limiter } from "../utils";

const authRoute = express.Router();

authRoute.post("/login", csrfProtection, login); // 완
authRoute.post("/login/kakao", kakaoLogin);
authRoute.post("/login/google", googleLogin);
authRoute.post("/register", register);  // 완
authRoute.post("/logout", csrfProtection, logout); // 일반 로그아웃까지는 끝

// 비밀번호 재설정 관련
authRoute.patch("/resetPassword", csrfProtection, resetPassword);

// 이메일 인증 관련
authRoute.post("/sendVerifyEmail", sendVerifyEmail);
authRoute.post("/verifyEmailCode", verifyEmailCode);

// 리프레쉬 토큰
authRoute.post("/token/refresh", csrfProtection, limiter, refreshToken); // 테스트 안해봄

export default authRoute;
