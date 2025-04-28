import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv"; // 환경 변수 사용한 민감한 정보 관리
import jwt from "jsonwebtoken"; //JWT 발급을 위한 라이브러리 설치
import { authenticateToken } from "./middleware/authenticate"; // 인증 미들웨어
import { csrfProtection } from "./utils/index.ts"; // CSRF 미들웨어
import cookieParser from "cookie-parser"; // 쿠키 파싱 미들웨어 추가
import bodyParser from "body-parser"; // 바디 파서 미들웨어 추가
import { dbPool } from "./config/db";
import authRoute from "./routes/authRoute";
import csrfRoute from "./routes/csrfRoute";

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
app.use(express.json()); // JSON 요청을 처리하기 위한 미들웨어
app.use(cookieParser(process.env.SESSION_SECRET)); // 쿠키 파싱 미들웨어 등록
app.use(bodyParser.json()); // JSON 파싱 미들웨어 등록


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
app.use("/api/auth", authRoute);
app.use("/api/csrf", csrfRoute); // CSRF 토큰 요청 라우트

// *** 라우트 정의 끝 ***

// *** 이메일 중복 검사 API
app.post("/api/emailCheck", (req: Request, res: Response) => {
  const { email } = req.body as { email: string };

  // Step 1: 이메일을 기준으로 사용자 조회
  dbPool
    .query("SELECT user_id, email FROM user WHERE email = ?", [email])
    .then((rows: any) => {
      if (rows.length > 0) {
        // 이미 이메일이 존재하는 경우
        return res.status(200).json({
          success: false,
          message: "이미 사용 중인 이메일입니다.",
        });
      }

      // 이메일이 없는 경우
      res.status(200).json({
        success: true,
        message: "사용 가능한 이메일입니다.",
      });
    })
    .catch((err: any) => {
      // Step 2: 서버 오류 처리
      console.error("이메일 중복 검사 중 서버 오류 발생:", err);
      res.status(500).json({
        success: false,
        message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      });
    });
}); // *** 이메일 중복 검사 API 끝
