import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv"; // 환경 변수 사용한 민감한 정보 관리
import jwt from "jsonwebtoken"; //JWT 발급을 위한 라이브러리 설치
import { dbPool } from "./config/db";
import authRoute from "./routes/authRoute";

// .env 파일 로드
dotenv.config();

const PORT = 3000; // 서버가 실행될 포트 번호

const app = express();
app.use(cors()); // CORS 미들웨어 추가
app.use(express.json()); // JSON 요청을 처리하기 위한 미들웨어

// 기본 라우트 설정
app.get("/", (req, res) => {
  res.send("Wanna Trip Web Server!");
});

// 서버 시작
app.listen(PORT, "0.0.0.0", () => {
  console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});

// 사용자 계정 관련
app.use("/api/auth", authRoute);

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
