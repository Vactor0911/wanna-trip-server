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

// *** 토큰 리프레시 API 시작
app.post("/api/token/refresh", async (req: Request, res: Response) => {
  const { email, refreshToken, loginType } = req.body;

  try {
    const rows: any = await dbPool.query(
      "SELECT refreshToken FROM user WHERE email = ?",
      [email]
    );

    if (rows.length === 0 || rows[0].refreshToken !== refreshToken) {
      res
        .status(401)
        .json({ success: false, message: "잘못된 Refresh Token입니다." });
      return;
    }

    if (loginType === "kakao" || loginType === "google") {
      // 새 AccessToken 생성
      const newAccessToken = jwt.sign(
        { email },
        process.env.JWT_SECRET_KEY as string,
        { expiresIn: "1h" }
      );

      res.status(200).json({ success: true, accessToken: newAccessToken });
    } else {
      res
        .status(400)
        .json({ success: false, message: "지원하지 않는 로그인 타입입니다." });
      return;
    }
  } catch (err) {
    console.error("토큰 갱신 실패:", err);
    res.status(500).json({ success: false, message: "토큰 갱신 실패" });
  }
}); // 토큰 리프레시 API 끝

// *** 토큰 재발급 API (팹랩 예약 시스템 인용, 수정해야함) ***
app.post(
  "/users/token/refresh",
  csrfProtection,
  (req: Request, res: Response) => {
    const { refreshToken } = req.cookies; // 쿠키에서 Refresh Token 추출

    if (!refreshToken) {
      res.status(403).json({
        success: false,
        message: "Refresh Token이 필요합니다.",
      });
      return;
    }

    dbPool.query("SELECT * FROM user WHERE refreshtoken = ?", [refreshToken])
      .then((rows: any) => {
        if (rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: "유효하지 않은 Refresh Token입니다.",
          });
        }

        // Refresh Token 유효성 검증 및 Access Token 재발급
        try {
          const decoded: any = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET!
          );
          const newAccessToken = jwt.sign(
            {
              userId: decoded.userId,
              name: decoded.name,
              permission: decoded.permission,
            },
            process.env.JWT_ACCESS_SECRET!,
            { expiresIn: "15m" } // Access Token 만료 시간
          );

          return res.status(200).json({
            success: true,
            message: "Access Token이 갱신되었습니다.",
            accessToken: newAccessToken,
            userId: decoded.userId,
            name: decoded.name,
            permission: decoded.permission,
          });
        } catch (err) {
          // Refresh Token 만료 시 DB에서 삭제
          dbPool.query(
            "UPDATE user SET refreshtoken = NULL WHERE refreshtoken = ?",
            [refreshToken]
          );
          return res.status(403).json({
            success: false,
            message: "Refresh Token이 만료되었습니다.",
          });
        }
      })
      .catch((err) => {
        console.error("Token Refresh 처리 중 오류 발생:", err);
        res.status(500).json({
          success: false,
          message: "서버 오류로 인해 토큰 갱신에 실패했습니다.",
        });
      });
  }
);
// *** 토큰 재발급 API 끝 ***

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
