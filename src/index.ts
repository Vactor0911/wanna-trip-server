import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv"; // 환경 변수 사용한 민감한 정보 관리
import cookieParser from "cookie-parser"; // 쿠키 파싱 미들웨어 추가
import bodyParser from "body-parser"; // 바디 파서 미들웨어 추가
import authRoute from "./routes/authRoute";
import csrfRoute from "./routes/csrfRoute";
import templateRoute from "./routes/templateRoute";
import boardRoute from "./routes/boardRoute";
import cardRoute from "./routes/cardRoute";
import helmet from 'helmet'; // 보안 관련 HTTP 헤더 설정을 위한 미들웨어
import { csrfTokenMiddleware } from "./utils";
import path from 'path';

// .env 파일 로드
dotenv.config();
// 환경변수가 하나라도 없으면 서버 실행 불가
[
  "DB_HOST",
  "DB_PORT",
  "DB_USERNAME",
  "DB_PASSWORD",
  "DB_DATABASE",
  "SESSION_SECRET",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "NODEMAILER_USER",
  "NODEMAILER_PASS",
  "KAKAO_CLIENT_ID",
].forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`해당 환경변수가 존재하지 않습니다.: ${key}`);
  }
});

const PORT = 3000; // 서버가 실행될 포트 번호
const FRONT_PORT = 4000; // 프론트 서버 포트 번호

const app = express();
app.use(
  cors({
    origin: `http://localhost:${FRONT_PORT}`,
    credentials: true,
  })
); // CORS 설정, credentials는 프론트와 백엔드의 쿠키 공유를 위해 필요

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      // 필요시 추가 설정
    }
  },
  // 개발 환경에서는 일부 설정 완화
  crossOriginResourcePolicy: { 
    policy: process.env.NODE_ENV === 'production' ? "same-site" : "cross-origin" 
  },
}));


app.use(express.json()); // JSON 요청을 처리하기 위한 미들웨어
app.use(cookieParser(process.env.SESSION_SECRET)); // 쿠키 파싱 미들웨어 등록
app.use(bodyParser.json()); // JSON 파싱 미들웨어 등록

// 정적 파일 서비스 설정
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// CSRF 토큰 미들웨어 추가
app.use(csrfTokenMiddleware);
// (모든 요청에 req.csrfToken() 함수를 추가)
// 토큰을 생성하고 쿠키에 저장
// /csrf/csrfToken 엔드포인트에서 이 함수를 호출할 수 있게 함
// 검증 기능은 포함하지 않음

// 기본 라우트 설정
app.get("/", (req, res) => {
  res.send("Wanna Trip Web Server!");
});

// 서버 시작
app.listen(PORT, "0.0.0.0", () => {
  console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});

// *** 라우트 정의 시작 ***

// 사용자 계정 관련
app.use("/auth", authRoute); // 사용자 계정 관련 라우트
app.use("/csrf", csrfRoute); // CSRF 토큰 요청 라우트

// 템플릿 관련
app.use("/template", templateRoute); // 템플릿 관련 라우트

// 보드 관련
app.use("/board", boardRoute); // 보드 관련 라우트

// 카드 관련
app.use("/card", cardRoute); // 카드 관련 라우트

// *** 라우트 정의 끝 ***
