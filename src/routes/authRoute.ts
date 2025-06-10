import express from "express";
import {
  checkAccountLink,
  deleteAccount,
  getUserInfo,
  googleLogin,
  kakaoLogin,
  linkAccount,
  login,
  logout,
  refreshToken,
  register,
  resetPassword,
  sendVerifyEmail,
  updateNickname,
  updatePassword,
  uploadProfileImage,
  verifyEmailCode,
} from "../controllers/authController";
import { csrfProtection, limiter, refreshTokenLimiter } from "../utils";
import { authenticateToken } from "../middleware/authenticate";

const authRoute = express.Router();

// 일반 로그인
authRoute.post("/login", csrfProtection, login);

// 카카오 간편 로그인
authRoute.post("/login/kakao", kakaoLogin);

// 구글 간편 로그인
authRoute.post("/login/google", googleLogin);

// 계정 연동
authRoute.post("/link/account", linkAccount);

// 계정 연동 상태 확인
authRoute.post("/check/account/link", checkAccountLink);

// 회원가입
authRoute.post("/register", register);

// 이메일 인증 요청
authRoute.post("/sendVerifyEmail", sendVerifyEmail);

// 이메일 인증 코드 확인
authRoute.post("/verifyEmailCode", verifyEmailCode);

// 로그아웃
authRoute.post("/logout", csrfProtection, logout);

// 엑세스 토큰 재발급
authRoute.post("/token/refresh", csrfProtection, refreshTokenLimiter, refreshToken);

// 사용자 정보 조회
authRoute.get("/me", csrfProtection, authenticateToken, limiter, getUserInfo);

// 닉네임 변경
authRoute.patch("/me/nickname", csrfProtection, authenticateToken, limiter, updateNickname);

// 비밀번호 변경
authRoute.patch("/me/password", csrfProtection, authenticateToken, limiter, updatePassword);

// 계정 탈퇴
authRoute.post("/me/delete", csrfProtection, authenticateToken, limiter, deleteAccount);

// 프로필 이미지 업로드
authRoute.post("/me/profile-image", csrfProtection, authenticateToken, limiter, uploadProfileImage);

// 비밀번호 재설정 관련 ( 로그인 안한 상태) - 미연동
authRoute.patch("/resetPassword", csrfProtection, resetPassword);





export default authRoute;
