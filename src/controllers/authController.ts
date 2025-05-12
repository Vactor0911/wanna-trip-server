import { Request, Response } from "express";
import bcrypt from "bcrypt"; // 비밀번호 암호화 최신버전 express 에서 가지고 있다함
import axios from "axios";
import jwt from "jsonwebtoken"; //JWT 발급을 위한 라이브러리 설치
import nodemailer from "nodemailer"; // 이메일 전송 라이브러리

import validator from "validator"; // 유효성 검사 라이브러리
const allowedSymbolsForPassword = /^[a-zA-Z0-9!@#$%^&*?]*$/; // 허용된 문자만 포함하는지 확인

import { dbPool } from "../config/db";

// 사용자 회원가입
export const register = async (req: Request, res: Response) => {
  const { email, password, name, terms } = req.body;

  try {
    // Step 1: 이메일 중복 확인
    const rows_email = await dbPool.query(
      "SELECT * FROM user WHERE email = ?",
      [email]
    );

    if (rows_email.length > 0) {
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
    await dbPool.query(
      "INSERT INTO user (email, password, name, terms) VALUES (?, ?, ?, ?)",
      [email, hashedPassword, name, JSON.stringify(terms, null, " ")]
    );

    // Step 4: 성공 응답
    res.status(201).json({
      success: true,
      message: "사용자가 성공적으로 등록되었습니다",
    });
  } catch (err: any) {
    // Step 5: 에러 처리
    console.error("서버 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "서버 오류 발생",
      error: err.message,
    });
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
      secure: false, // true: HTTPS 환경에서만 작동, 로컬 테스트에선 false로
      sameSite: "lax", // 로컬 개발환경에선 반드시 lax로, 배포시 none + secure:true
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
    res.clearCookie("accessToken");
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

  try {
    // Step 1: 카카오 사용자 정보 확인
    const kakaoResponse = await axios.get("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${KaKaoAccessToken}` },
    });

    if (kakaoResponse.status !== 200) {
      res.status(401).json({
        success: false,
        message: "잘못된 토큰 또는 만료된 토큰",
      });
      return;
    }

    // Step 2: 사용자 정보 추출
    const userData = kakaoResponse.data;
    const kakaoEmail = userData.kakao_account.email; // 카카오에서 제공하는 이메일
    const kakaoName = userData.properties.nickname; // 닉네임
    const kakaoId = userData.id.toString(); // 중요: 카카오 고유 ID 저장

    // 이메일로 기존 사용자 검색
    const rows = await dbPool.query("SELECT * FROM user WHERE email = ?", [
      kakaoEmail,
    ]);

    let user;

    if (rows.length > 0) {
      user = rows[0];

      // 이미 카카오 계정으로 로그인한 경우 - 기존 로그인 진행
      if (user.login_type === "kakao") {
        // 로그인 처리 계속 진행 (아래 Access Token 발급 등으로 자연스럽게 이어짐)
      }
      // 이미 다른 방식으로 가입된 계정이 있는 경우
      else {
        // 프론트엔드에 계정 존재함을 알리고, 계정 연동 또는 기존 계정 로그인 중 선택하게 함
        res.status(200).json({
          success: false, // 로그인 실패로 처리
          accountExists: true,
          message: "이미 다른 방식으로 가입된 계정이 있습니다.",
          email: kakaoEmail,
          existingLoginType: user.login_type,
          // 카카오 계정 정보도 함께 전달하여 나중에 연동할 때 사용할 수 있게 함
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
      await dbPool.query(
        "INSERT INTO user (email, name, login_type, provider_id) VALUES (?, ?, ?, ?)",
        [kakaoEmail, kakaoName, "kakao", kakaoId]
      );

      // 새로 등록한 사용자 정보 가져오기
      const newUserRows = await dbPool.query(
        "SELECT * FROM user WHERE email = ? AND login_type = 'kakao'",
        [kakaoEmail]
      );
      user = newUserRows[0];
    }

    // Step 4: Access Token 발급
    const accessToken = jwt.sign(
      {
        userId: user.user_id,
        name: kakaoName,
        permission: user.permission,
        login_type: "kakao",
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "30m" } // Access Token 만료 시간
    );

    // Step 5: Refresh Token 발급
    const refreshToken = jwt.sign(
      {
        userId: user.user_id,
        name: kakaoName,
        permission: user.permission,
        login_type: "kakao",
      },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" } // Refresh Token 만료 시간
    );

    // Step 6: Refresh Token 저장 (DB)
    await dbPool.query(
      "UPDATE user SET refresh_token = ?, name = ? WHERE email = ?",
      [refreshToken, kakaoName, kakaoEmail]
    );

    // Step 7: 쿠키에 Refresh Token 저장
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false, // true: HTTPS 환경에서만 작동, 로컬 테스트에선 false로
      sameSite: "lax", // 로컬 개발환경에선 반드시 lax로, 배포시 none + secure:true
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    });

    // Step 8: 클라이언트로 응답 반환
    res.status(200).json({
      success: true,
      message: `로그인 성공`,
      name: kakaoName,
      userId: user.user_id, // 사용자 ID 반환
      permissions: user.permission, // 사용자 권한
      accessToken, // Access Token 반환
    });
  } catch (err) {
    // 에러 처리
    console.error("카카오 로그인 처리 중 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "카카오 로그인 처리 중 오류가 발생했습니다.",
    });
  }
};

// 구글 간편 로그인
export const googleLogin = async (req: Request, res: Response) => {
  const { googleEmail, googleName } = req.body;

  try {
    // Step 1: 사용자 이메일로 조회
    const rows = await dbPool.query("SELECT * FROM user WHERE email = ?", [
      googleEmail,
    ]);

    let user;

    if (rows.length > 0) {
      user = rows[0];

      // 이미 구글 계정으로 로그인한 경우
      if (user.login_type === "google") {
        // 이후 Access Token 및 Refresh Token 발급 로직으로 진행
      }
      // 다른 로그인 방식으로 이미 계정이 있는 경우
      else {
        res.status(200).json({
          success: false,
          accountExists: true,
          message: "이미 다른 방식으로 가입된 계정이 있습니다.",
          email: googleEmail,
          existingLoginType: user.login_type,
          socialInfo: {
            socialType: "google",
            socialId: null, // 구글은 이메일을 유일한 식별자로 사용하기 때문에 별도 ID를 저장하지 않음
            name: googleName,
          },
        });
        return;
      }
    } else {
      // 신규 사용자 등록: 간편 로그인 시 필수 약관(privacy)을 자동 체크
      await dbPool.query(
        "INSERT INTO user (email, name, login_type, provider_id, terms) VALUES (?, ?, ?, ?, ?)",
        [
          googleEmail,
          googleName,
          "google",
          null,
          '{"privacy": true, "location": false}',
        ]
      );

      // 새로 등록한 사용자 정보 가져오기
      const newUserRows = await dbPool.query(
        "SELECT * FROM user WHERE email = ?",
        [googleEmail]
      );
      user = newUserRows[0];
    }

    // Step 4: Access Token 발급
    const accessToken = jwt.sign(
      {
        userId: user.user_id,
        name: googleName,
        permission: user.permission,
        login_type: "google",
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "30m" } // Access Token 만료 시간
    );

    // Step 5: Refresh Token 발급
    const refreshToken = jwt.sign(
      {
        userId: user.user_id,
        name: googleName,
        permission: user.permission,
        login_type: "google",
      },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" } // Refresh Token 만료 시간
    );

    // Step 6: Refresh Token 저장 (DB)
    await dbPool.query(
      "UPDATE user SET refresh_token = ?, name = ? WHERE email = ?",
      [refreshToken, googleName, googleEmail]
    );

    // Step 7: 쿠키에 Refresh Token 저장
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false, // true: HTTPS 환경에서만 작동, 로컬 테스트에선 false로
      sameSite: "lax", // 로컬 개발환경에선 반드시 lax로, 배포시 none + secure:true
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    });

    // Step 8: 클라이언트로 응답 반환
    res.status(200).json({
      success: true,
      message: `로그인 성공`,
      name: googleName,
      userId: user.user_id, // 사용자 ID 반환
      permissions: user.permission, // 사용자 권한
      accessToken, // Access Token 반환
    });
  } catch (err) {
    console.error("구글 로그인 처리 중 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "구글 로그인 처리 중 오류가 발생했습니다.",
    });
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
    const expiresAt = new Date(
      new Date().getTime() + 9 * 60 * 60 * 1000 + 5 * 60 * 1000
    ); // 5분 후
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
      subject: "[Wanna Trip] 이메일 인증번호를 입력해주세요.",
      html: `
    <div style="max-width:400px;margin:40px auto;padding:32px 24px 24px 24px;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);background:#fff;font-family:'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif;">
      <h1 style="font-size:24px;font-weight:700;color:#3f87ec;margin-bottom:16px;text-align:center;">Wanna Trip 이메일 인증</h1>
      <div style="font-size:16px;color:#222;text-align:center;margin-bottom:24px;">
        아래 인증번호를 입력해 주세요.
      </div>
      <div style="margin:0 auto 24px auto;max-width:220px;padding:20px 0;border-radius:12px;background:#f4f6fa;text-align:center;">
        <h2 style="font-size:32px;letter-spacing:6px;font-weight:700;color:#3f87ec;margin:0;">${verificationCode}</h2>
      </div>
      <div style="font-size:14px;color:#888;text-align:center;">
        인증번호는 5분간만 유효합니다.<br/>
        본 메일은 발신 전용입니다.
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
  const { email, password, socialInfo } = req.body;

  // socialInfo: { socialType: "kakao" | "google",
  //               socialId?: string | null,
  //               name: string }
  const socialType = socialInfo?.socialType;
  const socialId = socialInfo?.socialId; // 구글은 null일 수 있음
  const name = socialInfo?.name || null;

  try {
    // socialType은 반드시 존재해야 함
    if (!socialType) {
      res.status(400).json({
        success: false,
        message: "소셜 로그인 정보가 올바르지 않습니다.",
      });
      return;
    }
    // 구글은 socialId 체크를 생략하고, 그 외는 반드시 socialId가 존재해야 함
    if (socialType !== "google" && !socialId) {
      res.status(400).json({
        success: false,
        message: "소셜 로그인 정보가 올바르지 않습니다.",
      });
      return;
    }

    // 기존 계정 조회
    const rows = await dbPool.query(
      "SELECT * FROM user WHERE email = ? AND state = 'active'",
      [email]
    );
    // 사용자가 존재하지 않거나 탈퇴된 경우
    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "연동할 계정을 찾을 수 없습니다.",
      });
      return;
    }

    const user = rows[0];

    // 일반 계정과 연동하려면 비밀번호가 필요함 (일반 계정인 경우)
    if (user.login_type === "normal") {
      if (!password) {
        res.status(400).json({
          success: false,
          message: "일반 계정과 연동하려면 비밀번호가 필요합니다.",
        });
        return;
      }
      const isPasswordMatch = await bcrypt.compare(password, user.password);
      if (!isPasswordMatch) {
        res.status(400).json({
          success: false,
          message: "비밀번호가 일치하지 않습니다.",
        });
        return;
      }
    }

    // 업데이트할 provider_id: 구글인 경우는 그대로, 카카오 등은 전달된 socialId 사용
    const newProviderId = socialType === "google" ? user.provider_id : socialId;

    // DB에 저장된 기존 terms 값을 JSON.parse하여 수정한 후, 원하는 포맷으로 다시 문자열화
    const existingTerms = user.terms ? JSON.parse(user.terms) : {};
    existingTerms.privacy = true; // 필수 약관은 항상 true

    const formattedTerms = JSON.stringify(existingTerms, null, " ");

    // 업데이트 쿼리: login_type, provider_id, name, terms를 일괄 업데이트
    await dbPool.query(
      "UPDATE user SET login_type = ?, provider_id = ?, name = ?, terms = ? WHERE email = ?",
      [socialType, newProviderId, name, formattedTerms, email]
    );

    // Step 1: Access Token 발급
    const accessToken = jwt.sign(
      {
        userId: user.user_id,
        name: name || user.name,
        permission: user.permission,
        login_type: socialType,
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "30m" } // Access Token 만료 시간
    );

    // Step 2: Refresh Token 발급
    const refreshToken = jwt.sign(
      {
        userId: user.user_id,
        name: name || user.name,
        permission: user.permission,
        login_type: socialType,
      },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" } // Refresh Token 만료 시간
    );

    // Step 3: Refresh Token 저장 (DB)
    await dbPool.query("UPDATE user SET refresh_token = ? WHERE email = ?", [
      refreshToken,
      email,
    ]);

    // Step 4: 쿠키에 Refresh Token 저장
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false, // true: HTTPS 환경에서만 작동, 로컬 테스트에선 false로
      sameSite: "lax", // 로컬 개발환경에선 반드시 lax로, 배포시 none + secure:true
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    });

    // 성공 응답
    res.status(200).json({
      success: true,
      message: "계정이 성공적으로 연동되었습니다.",
      accessToken, // 액세스 토큰 추가
      name: name || user.name,
      userUuid: user.user_uuid,
      userId: user.user_id,
      permissions: user.permission,
      loginType: socialType,
    });
    return;
  } catch (err) {
    console.error("계정 연동 중 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "계정 연동 중 오류가 발생했습니다.",
    });
    return;
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
