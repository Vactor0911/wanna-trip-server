import { Request, Response } from "express";
import bcrypt from "bcrypt"; // 비밀번호 암호화 최신버전 express 에서 가지고 있다함
import axios from "axios";
import jwt from "jsonwebtoken"; //JWT 발급을 위한 라이브러리 설치
import nodemailer from "nodemailer"; // 이메일 전송 라이브러리
import multer from "multer"; // 파일 업로드를 위한 라이브러리
import fs from "fs"; // 파일 시스템 모듈

import validator from "validator"; // 유효성 검사 라이브러리
const allowedSymbolsForPassword = /^[a-zA-Z0-9!@#$%^&*?]*$/; // 허용된 문자만 포함하는지 확인

import { dbPool } from "../config/db";
import { mergeTemplates } from "./templateController";
import path from "path";

// 사용자 회원가입
export const register = async (req: Request, res: Response) => {
  const { email, password, name, terms } = req.body;
  const connection = await dbPool.getConnection(); // 커넥션 획득

  try {
    await connection.beginTransaction(); // 트랜잭션 시작

    // Step 1: 이메일 중복 확인
    const rows_email = await connection.query(
      "SELECT * FROM user WHERE email = ?",
      [email]
    );

    if (rows_email.length > 0) {
      await connection.rollback(); // 롤백
      // 로그인 유형에 따른 메시지 생성
      let loginTypeMsg = "";
      const loginType = rows_email[0].login_type;

      if (loginType === "kakao") {
        loginTypeMsg = "카카오 간편 로그인";
      } else if (loginType === "google") {
        loginTypeMsg = "구글 간편 로그인";
      } else {
        loginTypeMsg = "일반 로그인";
      }

      res.status(400).json({
        success: false,
        message: `이미 가입된 이메일입니다. ${loginTypeMsg}으로 로그인해 주세요.`,
        loginType: loginType,
      });
      return;
    }

    // // 비밀번호 검증 추가
    // if (
    //   !validator.isStrongPassword(password, {
    //     minLength: 8,
    //     minNumbers: 1,
    //     minSymbols: 1,
    //     minUppercase: 0,
    //   }) ||
    //   !allowedSymbolsForPassword.test(password) // 허용된 문자만 포함하지 않은 경우
    // ) {
    //   res.status(400).json({
    //     success: false,
    //     message:
    //       "비밀번호는 8자리 이상, 영문, 숫자, 특수문자(!@#$%^&*?)를 포함해야 합니다.",
    //   });
    //   return;
    // }

    // Step 2: 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // Step 3: 사용자 저장
    await connection.query(
      "INSERT INTO user (email, password, name, terms) VALUES (?, ?, ?, ?)",
      [email, hashedPassword, name, JSON.stringify(terms, null, " ")]
    );

    await connection.commit(); // 트랜잭션 커밋

    // Step 4: 성공 응답
    res.status(201).json({
      success: true,
      message: "사용자가 성공적으로 등록되었습니다",
    });
  } catch (err: any) {
    await connection.rollback(); // 오류 시 롤백
    console.error("서버 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "서버 오류 발생",
      error: err.message,
    });
  } finally {
    connection.release(); // 커넥션 반환
  }
};

// 사용자 로그인
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // Step 0: 탈퇴된 계정인지 확인
    const rows_check = await dbPool.query(
      "SELECT user_id, state FROM user WHERE email = ?",
      [email]
    );

    if (rows_check.length > 0 && rows_check[0].state === "inactive") {
      // 탈퇴된 계정인 경우
      res.status(400).json({
        success: false,
        message: "탈퇴된 계정입니다. 관리자에게 문의해주세요.",
      });
      return;
    }

    // Step 1: ID로 사용자 조회
    const rows = await dbPool.query(
      "SELECT * FROM user WHERE email = ? AND state = 'active'",
      [email]
    );

    if (rows.length === 0) {
      // 사용자가 없는 경우
      res.status(400).json({
        success: false,
        message: "사용자를 찾을 수 없습니다. 회원가입 후 이용해주세요.",
      });
      return;
    }

    const user = rows[0];

    // Step 2: 간편 로그인 사용자 확인
    if (user.login_type !== "normal") {
      let loginTypeName = "";
      if (user.login_type === "kakao") {
        loginTypeName = "카카오";
      } else if (user.login_type === "google") {
        loginTypeName = "구글";
      } else {
        loginTypeName = user.login_type;
      }

      res.status(400).json({
        success: false,
        message: `이 계정은 간편 로그인으로 연동되어 있습니다. \n${loginTypeName} 간편 로그인을 이용해주세요.`,
      });
      return;
    }

    // Step 3: 암호화된 비밀번호 비교
    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      res.status(400).json({
        success: false,
        message: "비밀번호가 일치하지 않습니다. 다시 입력해주세요.",
      });
      return;
    }

    // Step 4: Access Token 발급
    const accessToken = jwt.sign(
      {
        userId: user.user_id,
        userUuid: user.user_uuid, // 사용자 UUID
        name: user.name,
        permission: user.permission,
        login_type: "normal",
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "30m" } // Access Token 만료 시간 30m
    );

    // Step 5: Refresh Token 발급
    const refreshToken = jwt.sign(
      {
        userId: user.user_id,
        userUuid: user.user_uuid, // 사용자 UUID
        name: user.name,
        permission: user.permission,
        login_type: "normal",
      },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" } // Refresh Token 만료 시간 7d
    );

    // Step 6: Refresh Token 저장 (DB)
    await dbPool.query("UPDATE user SET refresh_token = ? WHERE email = ?", [
      refreshToken,
      email,
    ]);

    // Step 7: 쿠키에 Refresh Token 저장
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // 환경에 따라 동적 설정
      // true: HTTPS 환경에서만 작동, 로컬 테스트에선 false로
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      // 로컬 개발환경에선 반드시 lax로, 배포시 none + secure:true
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    });

    // Step 8: 응답 반환
    res.status(200).json({
      success: true,
      message: "로그인 성공",
      name: user.name,
      userUuid: user.user_uuid, // 사용자 UUID
      userId: user.user_id, // 사용자 ID, 프론트에서 사용
      permissions: user.permission, // 사용자 권한, 프론트에서 사용
      accessToken, // Access Token 반환
      loginType: "normal", // loginType 추가
    });
    return;
  } catch (err: any) {
    // 에러 처리
    console.error("서버 오류 발생:", err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "서버 오류 발생",
      error: err.message,
    });
    return;
  }
};

// 사용자 로그아웃
export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies; // 쿠키에서 Refresh Token 추출

  if (!refreshToken) {
    res.status(403).json({
      success: false,
      message: "Refresh Token이 필요합니다.",
    });
    return;
  }

  try {
    // DB에서 유효한 토큰인지 확인
    const rows = await dbPool.query(
      "SELECT * FROM user WHERE refresh_token = ?",
      [refreshToken]
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "유효하지 않은 Refresh Token입니다.",
      });
      return;
    }

    // DB에서 Refresh Token 제거
    await dbPool.query(
      "UPDATE user SET refresh_token = NULL WHERE refresh_token = ?",
      [refreshToken]
    );

    // 클라이언트에서 쿠키 삭제
    res.clearCookie("csrf-token"); // CSRF 토큰 쿠키 삭제
    res.clearCookie("refreshToken");

    res.status(200).json({
      success: true,
      message: "로그아웃이 성공적으로 완료되었습니다.",
    });
    return;
  } catch (err) {
    console.error("로그아웃 처리 중 서버 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "로그아웃 처리 중 오류가 발생했습니다.",
    });
    return;
  }
};

// 카카오 간편 로그인
export const kakaoLogin = async (req: Request, res: Response) => {
  const { KaKaoAccessToken } = req.body;
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();

    // Step 1: 카카오 사용자 정보 확인
    const kakaoResponse = await axios.get("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${KaKaoAccessToken}` },
    });

    if (kakaoResponse.status !== 200) {
      await connection.rollback();
      res.status(401).json({
        success: false,
        message: "잘못된 토큰 또는 만료된 토큰",
      });
      return;
    }

    // 사용자 정보 추출 및 처리
    const userData = kakaoResponse.data; // 카카오 사용자 정보
    const kakaoEmail = userData.kakao_account.email; // 카카오 이메일
    const kakaoName = userData.properties.nickname; // 카카오 사용자 이름
    const kakaoId = userData.id.toString(); // 카카오 고유 아이디

    // 이메일로 기존 사용자 검색
    const rows = await connection.query("SELECT * FROM user WHERE email = ?", [
      kakaoEmail,
    ]);

    let user;

    if (rows.length > 0) {
      user = rows[0];

      // 이미 다른 방식으로 가입된 계정이 있는 경우
      if (user.login_type !== "kakao") {
        await connection.rollback();
        res.status(200).json({
          success: false,
          accountExists: true,
          message: "이미 다른 방식으로 가입된 계정이 있습니다.",
          email: kakaoEmail,
          existingLoginType: user.login_type,
          socialInfo: {
            socialType: "kakao",
            socialId: kakaoId,
            name: kakaoName,
          },
        });
        return;
      }
    } else {
      // 신규 사용자 등록
      const insertResult = await connection.query(
        "INSERT INTO user (email, name, login_type, provider_id) VALUES (?, ?, ?, ?)",
        [kakaoEmail, kakaoName, "kakao", kakaoId]
      );

      // 새로 등록한 사용자 정보 가져오기
      const newUserRows = await connection.query(
        "SELECT * FROM user WHERE email = ? AND login_type = 'kakao'",
        [kakaoEmail]
      );
      user = newUserRows[0];
    }

    // Access Token 및 Refresh Token 발급
    const accessToken = jwt.sign(
      {
        userId: user.user_id,
        userUuid: user.user_uuid,
        name: kakaoName,
        permission: user.permission,
        login_type: "kakao",
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "30m" } // Access Token 만료 시간 30m
    );

    const refreshToken = jwt.sign(
      {
        userId: user.user_id,
        userUuid: user.user_uuid,
        name: kakaoName,
        permission: user.permission,
        login_type: "kakao",
      },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" } // Refresh Token 만료 시간 7d
    );

    // Refresh Token 저장
    await connection.query(
      "UPDATE user SET refresh_token = ?, name = ? WHERE email = ?",
      [refreshToken, kakaoName, kakaoEmail]
    );

    await connection.commit();

    // 쿠키에 Refresh Token 저장
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production",  // 환경에 따라 동적 설정
      // true: HTTPS 환경에서만 작동, 로컬 테스트에선 false로
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",   
      // 로컬 개발환경에선 반드시 lax로, 배포시 none + secure:true
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    });

    res.status(200).json({
      success: true,
      message: `로그인 성공`,
      name: kakaoName,
      userId: user.user_id,
      permissions: user.permission,
      accessToken,
      loginType: "kakao",
    });
  } catch (err) {
    await connection.rollback();
    console.error("카카오 로그인 처리 중 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "카카오 로그인 처리 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release();
  }
};

// 구글 간편 로그인
export const googleLogin = async (req: Request, res: Response) => {
  const { googleEmail, googleName } = req.body;
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();

    // 사용자 이메일로 조회
    const rows = await connection.query("SELECT * FROM user WHERE email = ?", [
      googleEmail,
    ]);

    let user;

    if (rows.length > 0) {
      user = rows[0];

      // 다른 로그인 방식으로 이미 계정이 있는 경우
      if (user.login_type !== "google") {
        await connection.rollback();
        res.status(200).json({
          success: false,
          accountExists: true,
          message: "이미 다른 방식으로 가입된 계정이 있습니다.",
          email: googleEmail,
          existingLoginType: user.login_type,
          socialInfo: {
            socialType: "google",
            socialId: null,
            name: googleName,
          },
        });
        return;
      }
    } else {
      // 신규 사용자 등록
      await connection.query(
        "INSERT INTO user (email, name, login_type, provider_id) VALUES (?, ?, ?, ?)",
        [googleEmail, googleName, "google", null]
      );

      // 새로 등록한 사용자 정보 가져오기
      const newUserRows = await connection.query(
        "SELECT * FROM user WHERE email = ?",
        [googleEmail]
      );
      user = newUserRows[0];
    }

    // 토큰 발급 및 저장 로직
    const accessToken = jwt.sign(
      {
        userId: user.user_id,
        userUuid: user.user_uuid,
        name: googleName,
        permission: user.permission,
        login_type: "google",
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "30m" } // Access Token 만료 시간 30m
    );

    const refreshToken = jwt.sign(
      {
        userId: user.user_id,
        userUuid: user.user_uuid,
        name: googleName,
        permission: user.permission,
        login_type: "google",
      },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" } // Refresh Token 만료 시간 7d
    );

    // Refresh Token 저장
    await connection.query(
      "UPDATE user SET refresh_token = ?, name = ? WHERE email = ?",
      [refreshToken, googleName, googleEmail]
    );

    await connection.commit();

    // 쿠키에 Refresh Token 저장
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // 환경에 따라 동적 설정
      // true: HTTPS 환경에서만 작동, 로컬 테스트에선 false로
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", 
      // 로컬 개발환경에선 반드시 lax로, 배포시 none + secure:true
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    });

    res.status(200).json({
      success: true,
      message: `로그인 성공`,
      name: googleName,
      userId: user.user_id,
      permissions: user.permission,
      accessToken,
      loginType: "google",
    });
  } catch (err) {
    await connection.rollback();
    console.error("구글 로그인 처리 중 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "구글 로그인 처리 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release();
  }
};

// 이메일 인증 코드 전송
export const sendVerifyEmail = async (req: Request, res: Response) => {
  const { user_uuid, email, purpose } = req.body; // purpose : "verifyEmailCode" / "modifyInfo"
  // 내 정보 수정 기능 추가 시 요청 컬럼 추가

  if (!email) {
    res
      .status(400)
      .json({ success: false, message: "이메일 주소가 필요합니다." });
    return;
  }
  if (!validator.isEmail(email)) {
    res
      .status(400)
      .json({ success: false, message: "유효한 이메일 주소를 입력해주세요." });
    return;
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction(); // 트랜잭션 시작

    switch (purpose) {
      case "verifyEmailCode": // 이메일 인증
        // Step 1: 이메일 중복 확인
        const existingUserRows = await connection.query(
          "SELECT email, state, login_type FROM user WHERE email = ?", // state : "active" / "inactive"
          [email]
        );
        const existingUser = existingUserRows[0];

        if (existingUser) {
          if (existingUser.email === email) {
            if (existingUser.state === "inactive") {
              res.status(400).json({
                success: false,
                // 간편 로그인 사용자들의 계정 복구 방식이 필요.
                message: "탈퇴된 계정입니다. 관리자에게 문의해주세요.",
              });
              return;
            }

            if (existingUserRows.length > 0) {
              // 기존 사용자 존재 -> 로그인 유형에 따른 메시지 생성
              let loginTypeMsg = "";
              const loginType = existingUserRows[0].login_type;

              if (loginType === "kakao") {
                loginTypeMsg = "카카오 간편 로그인";
              } else if (loginType === "google") {
                loginTypeMsg = "구글 간편 로그인";
              } else {
                loginTypeMsg = "일반 로그인";
              }

              res.status(400).json({
                success: false,
                message: `이미 가입된 이메일입니다.\n${loginTypeMsg}으로 로그인해 주세요.`,
                loginType, // 클라이언트에서 사용자가 어떤 방식으로 가입되었는지 확인할 수 있게 추가
              });
              return;
            }
          }
        }
        break;

      //TODO : 수정 필요
      case "modifyInfo": // 내 정보 수정
        const modifyRows = await connection.query(
          "SELECT email FROM user WHERE user_uuid = ? AND email = ?",
          [user_uuid, email]
        );
        const modifyUser = modifyRows[0];

        break;

      default:
        res.status(400).json({ success: false, message: "잘못된 요청입니다." });
        return;
    }

    // Step 1: 랜덤 인증 코드 생성
    const generateRandomCode = (n: number): string => {
      let str = "";
      for (let i = 0; i < n; i++) {
        str += Math.floor(Math.random() * 10);
      }
      return str;
    };
    const verificationCode = generateRandomCode(6);

    // Step 2: 인증 코드 저장 (유효 기간 5분)
    // 이건 나중에 한국 표준시로 바꿔야 함
    const expiresAt = new Date(new Date().getTime() + 5 * 60 * 1000); // 정확히 5분 후
    await connection.query(
      "INSERT INTO email_verification (email, verification_code, expires_at) VALUES (?, ?, ?)",
      [email, verificationCode, expiresAt]
    );

    // Step 3: 이메일 전송
    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.NODEMAILER_USER,
        pass: process.env.NODEMAILER_PASS,
      },
    });

    const mailOptions = {
      from: `"Wanna Trip" <${process.env.NODEMAILER_USER}>`,
      to: email,
      subject: "[Wanna Trip] 인증번호",
      html: `
      <div style="font-family:'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif; max-width:500px; margin:0 auto;">
        <!-- 헤더 -->
        <div style="background-color:#2589ff; color:white; padding:20px; text-align:left;">
          <h1 style="margin:0; font-size:24px; font-weight:bold;">Wanna Trip 인증번호</h1>
        </div>
        
        <!-- 본문 -->
        <div style="padding:30px 20px; background-color:white; border:1px solid #e1e1e1; border-top:none;">
          <p style="font-size:16px; color:#333; margin-bottom:30px;">
            Wanna Trip 이메일 인증번호입니다.
          </p>
          
          <!-- 인증번호 박스 -->
          <div style="background-color:#f4f7fd; padding:20px; text-align:center; margin-bottom:30px; border-radius:4px;">
            <h2 style="font-size:38px; letter-spacing:10px; color:#2589ff; margin:0; font-weight:bold;">${verificationCode}</h2>
          </div>
          
          <!-- 안내문구 -->
          <p style="font-size:14px; color:#888; margin-top:30px; border-top:1px solid #eee; padding-top:20px;">
            본 메일은 발신전용입니다.<br>
            인증번호는 5분간만 유효합니다.
          </p>
          <p style="font-size:13px; color:#999; margin-top:15px;">
            Copyright © WannaTrip Corp. All rights reserved.
          </p>
        </div>
      </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    await connection.commit(); // 트랜잭션 커밋
    res.status(200).json({
      success: true,
      message: "인증번호가 이메일로 발송되었습니다.",
    });
  } catch (err) {
    if (connection) await connection.rollback(); // 트랜잭션 롤백
    console.error("Error sending email verification code:", err);
    res
      .status(500)
      .json({ success: false, message: "메일 발송에 실패했습니다." });
  } finally {
    if (connection) connection.release();
  }
};

// 인증번호 검증
export const verifyEmailCode = async (req: Request, res: Response) => {
  const { email, code } = req.body;

  if (!email) {
    res.status(400).json({ success: false, message: "이메일을 입력해주세요." });
    return;
  }
  if (!code) {
    res
      .status(400)
      .json({ success: false, message: "인증번호를 입력해주세요." });
    return;
  }
  if (!validator.isEmail(email)) {
    res
      .status(400)
      .json({ success: false, message: "유효한 이메일 주소를 입력해주세요." });
    return;
  }
  if (!validator.isNumeric(code, { no_symbols: true }) || code.length !== 6) {
    res
      .status(400)
      .json({ success: false, message: "인증 코드는 6자리 숫자입니다." });
    return;
  }

  try {
    // 인증 코드 검증
    const [record] = await dbPool.query(
      "SELECT verification_code, expires_at FROM email_verification WHERE email = ? ORDER BY created_at DESC LIMIT 1",
      [email]
    );

    if (!record) {
      res
        .status(400)
        .json({ success: false, message: "인증번호가 존재하지 않습니다." });
      return;
    }

    const { verification_code: storedCode, expires_at: expiresAt } = record;

    if (
      new Date(new Date().getTime() + 9 * 60 * 60 * 1000) >
      new Date(new Date(expiresAt).getTime() + 9 * 60 * 60 * 1000)
    ) {
      res
        .status(400)
        .json({ success: false, message: "인증번호가 만료되었습니다." });
      return;
    }

    if (storedCode !== code) {
      res
        .status(400)
        .json({ success: false, message: "인증번호가 일치하지 않습니다." });
      return;
    }

    // 인증 성공
    await dbPool.query("DELETE FROM email_verification WHERE email = ?", [
      email,
    ]); // 검증 후 데이터 삭제

    res
      .status(200)
      .json({ success: true, message: "인증번호가 확인되었습니다." });
  } catch (err) {
    console.error("Error verifying code:", err);
    res
      .status(500)
      .json({ success: false, message: "서버 오류가 발생했습니다." });
  }
};

// 비밀번호 재설정
export const resetPassword = async (req: Request, res: Response) => {
  const { id, email, password } = req.body;

  if (!id || !email || !password) {
    res.status(400).json({
      success: false,
      message: "학번, 이메일, 비밀번호는 필수 입력 항목입니다.",
    });
    return;
  }

  if (
    !validator.isNumeric(id, { no_symbols: true }) ||
    id.length < 7 ||
    id.length > 10
  ) {
    res.status(400).json({
      success: false,
      message: "학번은 숫자로만 구성된 7~10자리 값이어야 합니다.",
    });
    return;
  }

  if (!validator.isEmail(email)) {
    res
      .status(400)
      .json({ success: false, message: "유효한 이메일 주소를 입력하세요." });
    return;
  }

  if (
    !validator.isStrongPassword(password, {
      minLength: 8,
      minNumbers: 1,
      minSymbols: 1,
      minUppercase: 0,
    }) ||
    !allowedSymbolsForPassword.test(password) // 허용된 문자만 포함하지 않은 경우
  ) {
    res.status(400).json({
      success: false,
      message: "비밀번호는 8자리 이상, 영문, 숫자, 특수문자를 포함해야 합니다.",
    });
    return;
  }

  // Step 1: 사용자 조회
  dbPool
    .query("SELECT * FROM user WHERE id = ? AND email = ?", [id, email])
    .then((rows: any[]) => {
      if (rows.length === 0) {
        return Promise.reject({
          status: 404,
          message: "일치하는 사용자를 찾을 수 없습니다.",
        });
      }

      // Step 2: 비밀번호 암호화
      return bcrypt.hash(password, 10).then((hashedPassword) => {
        return dbPool.query("UPDATE user SET password = ? WHERE id = ?", [
          hashedPassword,
          id,
        ]);
      });
    })
    .then(() => {
      res.status(200).json({
        success: true,
        message: "비밀번호가 성공적으로 변경되었습니다.",
      });
    })
    .catch((err) => {
      if (err.status) {
        res.status(err.status).json({ success: false, message: err.message });
      } else {
        console.error("비밀번호 변경 중 서버 오류:", err);
        res.status(500).json({
          success: false,
          message: "비밀번호 변경 중 서버 오류가 발생했습니다.",
        });
      }
    });
};

// 엑세스 토큰 재발급
export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies; // 쿠키에서 Refresh Token 추출

  if (!refreshToken) {
    res.status(403).json({
      success: false,
      message: "Refresh Token이 필요합니다.",
    });
    return;
  }

  try {
    const rows = await dbPool.query(
      "SELECT * FROM user WHERE refresh_token = ?",
      [refreshToken]
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "유효하지 않은 Refresh Token입니다.",
      });
      return;
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
          userUuid: decoded.userUuid, // 사용자 UUID
          name: decoded.name,
          permission: decoded.permission,
          login_type: decoded.login_type,
        },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "30m" } // Access Token 만료 시간
      );

      res.status(200).json({
        success: true,
        message: "Access Token이 갱신되었습니다.",
        accessToken: newAccessToken,
        userId: decoded.userId,
        name: decoded.name,
        permissions: decoded.permission,
      });
    } catch (err) {
      // Refresh Token 만료 시 DB에서 삭제
      await dbPool.query(
        "UPDATE user SET refresh_token = NULL WHERE refresh_token = ?",
        [refreshToken]
      );
      res.status(403).json({
        success: false,
        message: "Refresh Token이 만료되었습니다.",
      });
    }
  } catch (err) {
    console.error("Token Refresh 처리 중 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "서버 오류로 인해 토큰 갱신에 실패했습니다.",
    });
  }
};

// 계정 연동 API
export const linkAccount = async (req: Request, res: Response) => {
  const { email, socialInfo } = req.body;
  const socialType = socialInfo?.socialType;
  const socialId = socialInfo?.socialId;
  const name = socialInfo?.name || null;

  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();

    // socialType 검증
    if (!socialType || (socialType !== "google" && !socialId)) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: "소셜 로그인 정보가 올바르지 않습니다.",
      });
      return;
    }

    // 기존 계정 조회
    const rows = await connection.query(
      "SELECT * FROM user WHERE email = ? AND state = 'active'",
      [email]
    );

    if (rows.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "연동할 계정을 찾을 수 없습니다.",
      });
      return;
    }

    const user = rows[0];
    const newProviderId = socialType === "google" ? user.provider_id : socialId;

    // terms 값 처리
    let existingTerms;
    try {
      existingTerms =
        typeof user.terms === "string"
          ? JSON.parse(user.terms)
          : user.terms || {};
    } catch (e) {
      existingTerms = {};
    }
    existingTerms.privacy = true;

    const formattedTerms = JSON.stringify(existingTerms, null, " ");

    // 계정 정보 업데이트
    await connection.query(
      "UPDATE user SET login_type = ?, provider_id = ?, name = ?, terms = ? WHERE email = ?",
      [socialType, newProviderId, name, formattedTerms, email]
    );

    // 토큰 발급
    const accessToken = jwt.sign(
      {
        userId: user.user_id,
        userUuid: user.user_uuid,
        name: name || user.name,
        permission: user.permission,
        login_type: socialType,
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "30m" }
    );

    const refreshToken = jwt.sign(
      {
        userId: user.user_id,
        userUuid: user.user_uuid,
        name: name || user.name,
        permission: user.permission,
        login_type: socialType,
      },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" }
    );

    // Refresh Token 저장
    await connection.query(
      "UPDATE user SET refresh_token = ? WHERE email = ?",
      [refreshToken, email]
    );

    await connection.commit();

    // 쿠키 설정
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 템플릿 병합 시도 (트랜잭션과 독립적)
    try {
      await mergeTemplates(user.user_id, user.user_id);
    } catch (mergeErr) {
      console.error("템플릿 병합 실패:", mergeErr);
    }

    res.status(200).json({
      success: true,
      message: "계정이 성공적으로 연동되었습니다.",
      accessToken,
      name: name || user.name,
      userUuid: user.user_uuid,
      userId: user.user_id,
      permissions: user.permission,
      loginType: socialType,
    });
  } catch (err) {
    await connection.rollback();
    console.error("계정 연동 중 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "계정 연동 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release();
  }
};

// 계정 연동 상태 확인 API
export const checkAccountLink = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    const rows = await dbPool.query(
      "SELECT login_type, provider_id FROM user WHERE email = ? AND state = 'active'",
      [email]
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "계정을 찾을 수 없습니다.",
      });
      return;
    }

    const user = rows[0];

    res.status(200).json({
      success: true,
      loginType: user.login_type,
      isLinked: user.provider_id ? true : false,
    });
    return;
  } catch (err) {
    console.error("계정 연동 상태 확인 중 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "계정 연동 상태 확인 중 오류가 발생했습니다.",
    });
    return;
  }
};

// 사용자 정보 조회
export const getUserInfo = async (req: Request, res: Response) => {
  try {
    // req.user는 authenticate 미들웨어에서 설정된 값
    const user = req.user as { userId: number };

    if (!user || !user.userId) {
      res.status(401).json({
        success: false,
        message: "인증 정보가 유효하지 않습니다.",
      });
      return;
    }

    // DB에서 사용자 정보 조회
    const rows = await dbPool.query(
      "SELECT user_id, email, name, profile_image, user_uuid FROM user WHERE user_id = ? AND state = 'active'",
      [user.userId]
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "사용자 정보를 찾을 수 없습니다.",
      });
      return;
    }

    const userInfo = rows[0];

    res.status(200).json({
      success: true,
      data: {
        userId: userInfo.user_id,
        email: userInfo.email,
        nickname: userInfo.name,
        profileImage: userInfo.profile_image || null,
        userUuid: userInfo.user_uuid,
      },
    });
  } catch (err) {
    console.error("사용자 정보 조회 중 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "사용자 정보 조회 중 오류가 발생했습니다.",
    });
  }
};

// 닉네임 변경
export const updateNickname = async (req: Request, res: Response) => {
  const { nickname } = req.body;
  const user = req.user as { userId: number };

  if (!nickname || nickname.trim() === "") {
    res.status(400).json({
      success: false,
      message: "닉네임은 필수 입력 항목입니다.",
    });
    return;
  }

  try {
    await dbPool.query(
      "UPDATE user SET name = ? WHERE user_id = ? AND state = 'active'",
      [nickname, user.userId]
    );

    res.status(200).json({
      success: true,
      message: "닉네임이 성공적으로 변경되었습니다.",
      data: {
        nickname,
      },
    });
  } catch (err) {
    console.error("닉네임 변경 중 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "닉네임 변경 중 오류가 발생했습니다.",
    });
  }
};

// 비밀번호 변경
export const updatePassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;
  const user = req.user as { userId: number };
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();

    // 필수 입력 검증
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: "모든 비밀번호 필드를 입력해주세요.",
      });
      return;
    }

    // 새 비밀번호 일치 여부 확인
    if (newPassword !== confirmNewPassword) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: "새 비밀번호가 일치하지 않습니다.",
      });
      return;
    }

    // // 비밀번호 복잡성 검증
    // const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*?]).{8,}$/;
    // if (!passwordRegex.test(newPassword)) {
    //   res.status(400).json({
    //     success: false,
    //     message: "비밀번호는 8자 이상, 영문, 숫자, 특수문자를 포함해야 합니다.",
    //   });
    //   return;
    // }

    // 현재 사용자의 비밀번호 조회
    const rows = await connection.query(
      "SELECT password, login_type FROM user WHERE user_id = ? AND state = 'active'",
      [user.userId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "사용자를 찾을 수 없습니다.",
      });
      return;
    }

    const userInfo = rows[0];

    // 소셜 로그인 사용자는 비밀번호 변경 불가
    if (userInfo.login_type !== "normal") {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: `${
          userInfo.login_type === "kakao" ? "카카오" : "구글"
        } 간편 로그인 사용자는 비밀번호를 변경할 수 없습니다.`,
      });
      return;
    }

    // 현재 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      userInfo.password
    );

    if (!isPasswordValid) {
      await connection.rollback();
      res.status(401).json({
        success: false,
        message: "현재 비밀번호가 일치하지 않습니다.",
      });
      return;
    }

    // 현재 비밀번호와 새 비밀번호가 동일한지 확인
    if (currentPassword === newPassword) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: "새 비밀번호는 현재 비밀번호와 달라야 합니다.",
      });
      return;
    }

    // 새 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 비밀번호 업데이트
    await connection.query("UPDATE user SET password = ? WHERE user_id = ?", [
      hashedPassword,
      user.userId,
    ]);

    await connection.commit();

    res.status(200).json({
      success: true,
      message: "비밀번호가 성공적으로 변경되었습니다.",
    });
  } catch (err) {
    await connection.rollback();
    console.error("비밀번호 변경 중 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "비밀번호 변경 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release();
  }
};

// 계정 탈퇴
export const deleteAccount = async (req: Request, res: Response) => {
  const user = req.user as { userId: number, userUuid: string };
  const { password } = req.body;
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();

    // 사용자 정보 조회
    const rows = await connection.query(
      "SELECT * FROM user WHERE user_id = ? AND state = 'active'",
      [user.userId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "사용자를 찾을 수 없습니다.",
      });
      return;
    }

    const userInfo = rows[0];

    // 일반 계정인 경우 비밀번호 확인
    if (userInfo.login_type === "normal") {
      if (!password) {
        await connection.rollback();
        res.status(400).json({
          success: false,
          message: "계정 탈퇴를 위해 비밀번호가 필요합니다.",
        });
        return;
      }

      const isPasswordValid = await bcrypt.compare(password, userInfo.password);
      if (!isPasswordValid) {
        await connection.rollback();
        res.status(401).json({
          success: false,
          message: "비밀번호가 일치하지 않습니다.",
        });
        return;
      }
    }

    // 프로필 이미지 파일 삭제 로직 추가
    try {
      // 사용자의 프로필 이미지 정보 가져오기
      if (userInfo.profile_image) {
        // DB에 저장된 경로에서 파일명 추출
        const profileImagePath = path.join(
          __dirname, 
          "../../", 
          userInfo.profile_image.substring(1) // 앞의 '/' 제거
        );

        // 파일이 존재하는지 확인 후 삭제
        if (fs.existsSync(profileImagePath)) {
          fs.unlinkSync(profileImagePath);
          console.log(`사용자 ID ${user.userId}의 프로필 이미지 삭제: ${profileImagePath}`);
        }

        // 모든 종류의 프로필 이미지 삭제 (확장자 상관없이)
        const profileDir = path.join(__dirname, "../../uploads/profiles");
        if (fs.existsSync(profileDir)) {
          const files = fs.readdirSync(profileDir);
          const userPrefix = user.userUuid;

          files.forEach((file) => {
            if (file.startsWith(userPrefix)) {
              const filePath = path.join(profileDir, file);
              fs.unlinkSync(filePath);
              console.log(`사용자의 추가 프로필 이미지 삭제: ${filePath}`);
            }
          });
        }
      }
    } catch (error) {
      // 이미지 삭제 실패해도 계정 탈퇴는 계속 진행
      console.error("프로필 이미지 삭제 중 오류:", error);
    }

    // 계정 삭제 전에 관련 데이터 처리
    // 사용자의 템플릿 조회
    const templates = await connection.query(
      "SELECT template_id FROM template WHERE user_id = ?",
      [user.userId]
    );

    // 각 템플릿에 대해 보드와 카드 삭제
    for (const template of templates) {
      // 보드 조회
      const boards = await connection.query(
        "SELECT board_id FROM board WHERE template_id = ?",
        [template.template_id]
      );

      // 각 보드의 카드 삭제
      for (const board of boards) {
        await connection.query("DELETE FROM card WHERE board_id = ?", [
          board.board_id,
        ]);
      }

      // 보드 삭제
      await connection.query("DELETE FROM board WHERE template_id = ?", [
        template.template_id,
      ]);

      // 템플릿 삭제
      await connection.query("DELETE FROM template WHERE template_id = ?", [
        template.template_id,
      ]);
    }

    // 사용자 계정 삭제
    await connection.query(
      "DELETE from user WHERE user_id = ?",
      [user.userId]
    );

    await connection.commit();

    // 로그아웃 처리
    res.clearCookie("csrf-token");
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.status(200).json({
      success: true,
      message: "계정이 성공적으로 탈퇴되었습니다.",
    });
  } catch (err) {
    await connection.rollback();
    console.error("계정 탈퇴 중 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "계정 탈퇴 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release();
  }
};

// 프로필 이미지 저장 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads/profiles");

    // 디렉토리가 없으면 생성
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const user = req.user as { userUuid: string };
    // MIME 타입에서 확장자 추출 (더 안전한 방식)
    let ext = "";
    switch (file.mimetype) {
      case "image/jpeg":
        ext = ".jpg";
        break;
      case "image/png":
        ext = ".png";
        break;
      case "image/gif":
        ext = ".gif";
        break;
      case "image/webp":
        ext = ".webp";
        break;
      default:
        ext = path.extname(file.originalname) || ".jpg"; // 기본값 제공
    }

    // 추후에 삭제 예정
    console.log(
      `파일 업로드: 타입=${file.mimetype}, 파일명=${file.originalname}, 사용할 확장자=${ext}`
    );

    const fileName = `${user.userUuid}${ext}`;
    cb(null, fileName);
  },
});

// 파일 필터
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // 이미지 파일만 허용
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "지원되지 않는 파일 형식입니다. JPG, PNG, GIF, WEBP 형식만 업로드할 수 있습니다."
      )
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 4 * 1024 * 1024, // 4MB
  },
}).single("profileImage");

// 프로필 이미지 업로드
export const uploadProfileImage = async (req: Request, res: Response) => {
  const user = req.user as { userId: number; userUuid: string };

  upload(req, res, async (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "파일 크기는 4MB를 초과할 수 없습니다.",
        });
      }

      return res.status(400).json({
        success: false,
        message: err.message || "파일 업로드 중 오류가 발생했습니다.",
      });
    }

    // 파일이 없는 경우
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "업로드할 파일이 없습니다.",
      });
    }

    try {
      // 기존 프로필 이미지 조회
      const rows = await dbPool.query(
        "SELECT profile_image FROM user WHERE user_id = ?",
        [user.userId]
      );

      const oldProfileImage = rows[0]?.profile_image;

      // 새 이미지 저장 전에 먼저 기존 이미지들 삭제
      try {
        const profileDir = path.join(__dirname, "../../uploads/profiles");

        if (fs.existsSync(profileDir)) {
          const files = fs.readdirSync(profileDir);
          const userPrefix = user.userUuid;

          files.forEach((file) => {
            if (file.startsWith(userPrefix) && file !== req.file?.filename) {
              const filePath = path.join(profileDir, file);
              fs.unlinkSync(filePath);
            }
          });
        }

        // 1. DB에 저장된 이전 이미지 삭제 (추가 안전장치)
        if (oldProfileImage) {
          const oldImagePath = path.join(
            __dirname,
            "../../",
            oldProfileImage.substring(1)
          );

          // 새로 업로드된 파일과 다른 경우에만 삭제
          const newImagePath = `/uploads/profiles/${req.file.filename}`;
          if (oldProfileImage !== newImagePath && fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
      } catch (error) {
        console.error("기존 프로필 이미지 삭제 중 오류:", error);
        // 이미지 삭제 실패해도 새 이미지 저장은 계속 진행
      }

      // 새 프로필 이미지 경로
      const profileImagePath = `/uploads/profiles/${req.file.filename}`;

      // DB에 프로필 이미지 경로 저장
      await dbPool.query(
        "UPDATE user SET profile_image = ? WHERE user_id = ?",
        [profileImagePath, user.userId]
      );

      res.status(200).json({
        success: true,
        message: "프로필 이미지가 성공적으로 업로드되었습니다.",
        data: {
          profileImage: profileImagePath,
        },
      });
    } catch (err) {
      console.error("프로필 이미지 업로드 중 오류 발생:", err);
      res.status(500).json({
        success: false,
        message: "프로필 이미지 저장 중 오류가 발생했습니다.",
      });
    }
  });
};
