import express from "express";
import {
  googleLogin,
  kakaoLogin,
  login,
  logout,
  refreshToken,
  register,
  resetPassword,
  sendVerifyEmail,
  verifyEmailCode,
} from "../controllers/authController";
import { csrfProtection, limiter } from "../utils";

const authRoute = express.Router();

// 일반 로그인
authRoute.post("/login", csrfProtection, login);

// 카카오 간편 로그인
authRoute.post("/login/kakao", kakaoLogin);

// 구글 간편 로그인
authRoute.post("/login/google", googleLogin);

// 회원가입
authRoute.post("/register", register);

// 이메일 인증 요청
authRoute.post("/sendVerifyEmail", sendVerifyEmail);

// 이메일 인증 코드 확인
authRoute.post("/verifyEmailCode", verifyEmailCode);

// 로그아웃
authRoute.post("/logout", csrfProtection, logout);

// 엑세스 토큰 재발급
authRoute.post("/token/refresh", csrfProtection, limiter, refreshToken);

// 비밀번호 재설정 관련 - 미연동
authRoute.patch("/resetPassword", csrfProtection, resetPassword);





export default authRoute;
