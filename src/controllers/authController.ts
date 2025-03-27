import { Request, Response } from "express";
import bcrypt from "bcrypt"; // 비밀번호 암호화 최신버전 express 에서 가지고 있다함
import axios from "axios";
import jwt from "jsonwebtoken"; //JWT 발급을 위한 라이브러리 설치
import crypto from "crypto"; // 추가: refreshToken 생성에 사용할 라이브러리
import { dbPool } from "../config/db";

// 사용자 로그인
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Step 1: 이메일로 사용자 조회
  dbPool
    .query("SELECT * FROM user WHERE email = ?", [email])
    .then((rows: any) => {
      if (rows.length === 0) {
        // 사용자가 없는 경우
        return res.status(401).json({
          success: false,
          message: "사용자를 찾을 수 없습니다. 회원가입 후 이용해주세요.",
        });
      }

      const user = rows[0];

      // Step 2: 간편 로그인 사용자 확인
      if (user.loginType !== "normal") {
        return res.status(401).json({
          success: false,
          message:
            "간편 로그인 사용자는 일반 로그인을 사용할 수 없습니다.\n간편 로그인으로 이용해주세요.",
        });
      }

      // Step 3: 암호화된 비밀번호 비교
      return bcrypt.compare(password, user.password).then((isPasswordMatch) => {
        if (!isPasswordMatch) {
          return res.status(401).json({
            success: false,
            message: "비밀번호가 일치하지 않습니다",
          });
        }

        // Step 4: 로그인 성공 처리
        const nickname = user.name; // dbPool의 name 필드를 닉네임으로 사용
        res.json({
          success: true,
          message: "로그인 성공",
          nickname: nickname, // 닉네임 반환
          userId: Number(user.user_id), // 사용자 ID 반환
        });
      });
    })
    .catch((err) => {
      // 에러 처리
      console.error("서버 오류 발생:", err);
      res.status(500).json({
        success: false,
        message: "서버 오류 발생",
        error: err.message,
      });
    });
};

// 사용자 로그아웃
export const logout = async (req: Request, res: Response) => {
  const { email, token } = req.body;

  // `undefined`를 명시적으로 `null`로 변환
  const receivedToken = token || null;

  try {
    // Step 1: 사용자 조회
    const rows = await dbPool.query("SELECT * FROM user WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
      // 사용자 정보를 찾지 못한 경우
      res
        .status(404)
        .json({ success: false, message: "사용자를 찾을 수 없습니다." });
      return;
    }

    const storedToken = rows[0].token || null; // `null`로 명시적으로 처리
    const storedRefreshToken = rows[0].refreshToken;
    const loginType = rows[0].loginType;

    // Step 2: 로그인 타입에 따른 토큰 검증
    if (loginType === "normal") {
      // 일반 로그인 사용자는 AccessToken만 검증
      if (storedToken !== receivedToken) {
        res
          .status(401)
          .json({ success: false, message: "잘못된 AccessToken입니다." });
        return;
      }
    } else if (loginType === "kakao" || loginType === "google") {
      // 간편 로그인 사용자는 AccessToken 또는 RefreshToken 검증
      if (
        storedToken !== receivedToken &&
        storedRefreshToken !== receivedToken
      ) {
        res.status(401).json({ success: false, message: "잘못된 토큰입니다." });
        return;
      }
    } else {
      res
        .status(400)
        .json({ success: false, message: "알 수 없는 로그인 타입입니다." });
      return;
    }

    // Step 3: 토큰 및 RefreshToken 제거
    await dbPool.query(
      "UPDATE user SET token = NULL, refreshToken = NULL WHERE email = ?",
      [email]
    );

    // Step 4: 성공 응답 반환
    res.status(200).json({
      success: true,
      message: "로그아웃이 성공적으로 완료되었습니다.",
    });
  } catch (err) {
    // Step 5: 에러 처리
    console.error("로그아웃 처리 중 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "로그아웃 처리 중 오류가 발생했습니다.",
    });
  }
}; // *** 로그아웃 API 끝 ***

// *** 카카오 간편 로그인 API 시작
export const kakaoLogin = (req: Request, res: Response) => {
  const { email, name, token } = req.body;

  // Step 1: 카카오 사용자 정보 확인
  axios
    .get("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((kakaoResponse) => {
      if (kakaoResponse.status !== 200) {
        res.status(401).json({
          success: false,
          message: "잘못된 토큰 또는 만료된 토큰",
        });
        return;
      }

      // Step 2: 사용자 정보 추출
      const userData = kakaoResponse.data;
      const kakaoEmail = userData.kakao_account.email || email; // 카카오에서 제공하는 이메일
      const kakaoName = userData.properties.nickname || name; // 닉네임 추출

      // Step 3: dbPool에서 사용자 정보 조회
      return dbPool
        .query("SELECT * FROM user WHERE email = ?", [kakaoEmail])
        .then((rows: any) => {
          if (rows.length === 0) {
            // 신규 사용자 등록
            return dbPool.query(
              "INSERT INTO user (email, name, loginType, token) VALUES (?, ?, ?, ?)",
              [kakaoEmail, kakaoName, "kakao", token]
            );
          } else {
            // 기존 사용자 정보 업데이트
            return dbPool.query(
              "UPDATE user SET name = ?, loginType = ?, token = ? WHERE email = ?",
              [kakaoName, "kakao", token, kakaoEmail]
            );
          }
        })
        .then(() => {
          // Step 4: 사용자 ID 조회
          return dbPool
            .query("SELECT * FROM user WHERE email = ?", [kakaoEmail])
            .then((rows: any) => {
              const user = rows[0];

              // Step 5: AccessToken 생성
              const accessToken = jwt.sign(
                { email: kakaoEmail, name: kakaoName },
                process.env.JWT_SECRET_KEY as string,
                { expiresIn: "1h" }
              );

              // Step 6: RefreshToken 생성
              const refreshToken = crypto.randomBytes(32).toString("hex");

              // Step 7: RefreshToken 및 AccessToken 저장
              return dbPool
                .query(
                  "UPDATE user SET token = ?, refreshToken = ? WHERE email = ?",
                  [accessToken, refreshToken, kakaoEmail]
                )
                .then(() => {
                  // Step 8: 클라이언트로 응답 반환
                  res.status(200).json({
                    success: true,
                    message: `[ ${kakaoName} ] 님 환영합니다!`,
                    userId: Number(user.user_id), // 사용자 ID 반환
                    email: kakaoEmail,
                    name: kakaoName,
                    loginType: "kakao",
                    accessToken,
                    refreshToken, // 클라이언트에 RefreshToken 반환
                  });
                });
            });
        });
    })
    .catch((err) => {
      // 에러 처리
      console.error("카카오 로그인 처리 중 오류 발생:", err);
      res.status(500).json({
        success: false,
        message: "카카오 로그인 처리 중 오류가 발생했습니다.",
      });
    });
};

// 구글 로그인
export const googleLogin = async (req: Request, res: Response) => {
  const { email, name } = req.body;

  try {
    // Step 1: 사용자 이메일로 조회
    const rows = await dbPool.query("SELECT * FROM user WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
      // Step 2: 신규 사용자라면 dbPool에 삽입
      await dbPool.query(
        "INSERT INTO user (email, name, loginType, status) VALUES (?, ?, ?, ?)",
        [email, name, "google", "active"] // loginType: google, status: active
      );
    } else {
      // Step 3: 기존 사용자라면 정보 업데이트
      await dbPool.query(
        "UPDATE user SET name = ?, loginType = ? WHERE email = ?",
        [name, "google", email]
      );
    }

    // Step 4: JWT 생성 = AccessToken 생성
    const accessToken = jwt.sign(
      { email, name }, // JWT 페이로드
      process.env.JWT_SECRET_KEY as string, // 비밀 키
      { expiresIn: "1h" } // 유효 기간
    );

    // Step 5: RefreshToken 생성
    const refreshToken = crypto.randomBytes(32).toString("hex"); // Secure Refresh Token

    // Step 6: RefreshToken 및 AccessToken dbPool 저장
    await dbPool.query(
      "UPDATE user SET token = ?, refreshToken = ? WHERE email = ?",
      [accessToken, refreshToken, email]
    );

    await dbPool
      .query("SELECT user_id FROM user WHERE email = ?", [email])
      .then((result: any) => {
        const userId = result[0].user_id;

        // Step 7: 성공 응답 반환
        res.status(200).json({
          success: true,
          message: `[ ${name} ] 님 환영합니다!`,
          userId: Number(userId), // 사용자 ID 반환
          email,
          name,
          loginType: "google",
          accessToken,
          refreshToken, // 클라이언트에 반환
        });
      });
  } catch (err) {
    console.error("구글 로그인 처리 중 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "구글 로그인 처리 중 오류가 발생했습니다.",
    });
  }
};

// *** 사용자 회원가입
export const register = (req: Request, res: Response) => {
  const { email, password, name } = req.body as {
    email: string;
    password: string;
    name: string;
  };

  // Step 1: 이메일 중복 확인
  dbPool
    .query("SELECT * FROM user WHERE email = ?", [email])
    .then((rows_email: any) => {
      if (rows_email.length > 0) {
        return res
          .status(400)
          .json({ success: false, message: "이메일이 이미 존재합니다" });
      }

      // Step 2: 비밀번호 암호화
      return bcrypt.hash(password, 10);
    })
    .then((hashedPassword: string) => {
      // Step 3: 사용자 저장
      return dbPool.query(
        "INSERT INTO user (email, password, name) VALUES (?, ?, ?)",
        [email, hashedPassword, name]
      );
    })
    .then((result: any) => {
      res
        .status(201)
        .json({ success: true, message: "사용자가 성공적으로 등록되었습니다" });
    })
    .catch((err: any) => {
      // Step 4: 에러 처리
      console.error("서버 오류 발생:", err);
      res.status(500).json({
        success: false,
        message: "서버 오류 발생",
        error: err.message,
      });
    });
};
