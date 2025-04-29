import { Request, Response } from "express";
import bcrypt from "bcrypt"; // 비밀번호 암호화 최신버전 express 에서 가지고 있다함
import axios from "axios";
import jwt from "jsonwebtoken"; //JWT 발급을 위한 라이브러리 설치
import crypto from "crypto"; // 추가: refreshToken 생성에 사용할 라이브러리
import nodemailer from "nodemailer"; // 이메일 전송 라이브러리

import validator from "validator"; // 유효성 검사 라이브러리
const allowedSymbolsForPassword = /^[a-zA-Z0-9!@#$%^&*?]*$/; // 허용된 문자만 포함하는지 확인

import { dbPool } from "../config/db";

// 사용자 회원가입
export const register = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  try {
    // Step 1: 이메일 중복 확인
    const rows_email = await dbPool.query(
      "SELECT * FROM user WHERE email = ?",
      [email]
    );

    if (rows_email.length > 0) {
      res.status(400).json({
        success: false,
        message: "이메일이 이미 존재합니다.",
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
      "INSERT INTO user (email, password, name) VALUES (?, ?, ?)",
      [email, hashedPassword, name]
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

  // Step 0: 탈퇴된 계정인지 확인
  dbPool
    .query("SELECT user_id, state FROM user WHERE email = ?", [email])
    .then((rows: any) => {
      if (rows.length > 0 && rows[0].state === "inactive") {
        // 탈퇴된 계정인 경우
        return Promise.reject({
          status: 400,
          message: "탈퇴된 계정입니다. 관리자에게 문의해주세요.",
        });
      }

      // Step 1: ID로 사용자 조회
      return dbPool.query(
        "SELECT * FROM user WHERE email = ? AND state = 'active'",
        [email]
      );
    })
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
      if (user.login_type !== "normal") {
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
            message: "비밀번호가 일치하지 않습니다. 다시 입력해주세요.",
          });
        }

        // Step 3: Access Token 발급
        const accessToken = jwt.sign(
          {
            userId: user.user_id,
            name: user.name,
            permission: user.permission,
            login_type: "normal",
          },
          process.env.JWT_ACCESS_SECRET!,
          { expiresIn: "30m" } // Access Token 만료 시간
        );

        // Step 4: Refresh Token 발급
        const refreshToken = jwt.sign(
          {
            userId: user.user_id,
            name: user.name,
            permission: user.permission,
            login_type: "normal",
          },
          process.env.JWT_REFRESH_SECRET!,
          { expiresIn: "7d" } // Refresh Token 만료 시간
        );

        // Step 5: Refresh Token 저장 (DB)
        return dbPool
          .query("UPDATE user SET refresh_token = ? WHERE email = ?", [
            refreshToken,
            email,
          ])
          .then(() => {
            // Step 6: 쿠키에 Refresh Token 저장
            res.cookie("refreshToken", refreshToken, {
              httpOnly: true,
              secure: false, // true: HTTPS 환경에서만 작동, 로컬 테스트에선 false로
              sameSite: "lax", // 로컬 개발환경에선 반드시 lax로, 배포시 none + secure:true
              maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
            });

            // Step 7: 응답 반환
            res.status(200).json({
              success: true,
              message: "로그인 성공",
              name: user.name,
              userUuid: user.user_uuid, // 사용자 UUID
              userId: user.user_id, // 사용자 ID, 프론트에서 사용
              permissions: user.permission, // 사용자 권한, 프론트에서 사용
              accessToken, // Access Token 반환
            });
          });
      });
    })
    .catch((err) => {
      // 에러 처리
      if (err.status) {
        res.status(err.status).json({
          success: false,
          message: err.message,
        });
      } else {
        console.error("서버 오류 발생:", err);
        res.status(500).json({
          success: false,
          message: "서버 오류 발생",
          error: err.message,
        });
      }
    });
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

  dbPool
    .query("SELECT * FROM user WHERE refresh_token = ?", [refreshToken])
    .then((rows: any[]) => {
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "유효하지 않은 Refresh Token입니다.",
        });
      }

      // DB에서 Refresh Token 제거
      return dbPool
        .query("UPDATE user SET refresh_token = NULL WHERE refresh_token = ?", [
          refreshToken,
        ])
        .then(() => {
          // 클라이언트에서 쿠키 삭제
          res.clearCookie("accessToken");
          res.clearCookie("refreshToken");

          return res.status(200).json({
            success: true,
            message: "로그아웃이 성공적으로 완료되었습니다.",
          });
        });
    })
    .catch((err) => {
      console.error("로그아웃 처리 중 서버 오류 발생:", err);
      res.status(500).json({
        success: false,
        message: "로그아웃 처리 중 오류가 발생했습니다.",
      });
    });
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

    // Step 3: dbPool에서 사용자 정보 조회
    const rows = await dbPool.query("SELECT * FROM user WHERE email = ?", [
      kakaoEmail,
    ]);

    let user;

    if (rows.length === 0) {
      // 신규 사용자 등록
      await dbPool.query(
        "INSERT INTO user (email, name, login_type) VALUES (?, ?, ?)",
        [kakaoEmail, kakaoName, "kakao"]
      );

      // 새로 등록한 사용자 정보 가져오기
      const newUserRows = await dbPool.query(
        "SELECT * FROM user WHERE email = ?",
        [kakaoEmail]
      );
      user = newUserRows[0];
    } else {
      // 기존 사용자
      user = rows[0];
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

    if (rows.length === 0) {
      // 신규 사용자 등록
      await dbPool.query(
        "INSERT INTO user (email, name, login_type) VALUES (?, ?, ?)",
        [googleEmail, googleName, "google"]
      );

      // 새로 등록한 사용자 정보 가져오기
      const newUserRows = await dbPool.query(
        "SELECT * FROM user WHERE email = ?",
        [googleEmail]
      );
      user = newUserRows[0];
    } else {
      // 기존 사용자
      user = rows[0];
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
          "SELECT email, state FROM user WHERE email = ?", // state : "active" / "inactive"
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

            res.status(400).json({
              success: false,
              message:
                "이미 존재하는 이메일입니다. 다른 이메일을 사용해주세요.",
            });
            return;
          }
        }
        break;

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
      from: `"여행갈래?" <${process.env.NODEMAILER_USER}>`,
      to: email,
      subject: "[여행갈래?] 인증번호를 입력해주세요.",
      html: `
        <h1>이메일 인증</h1>
        <div>
          <h2>인증번호 [<b>${verificationCode}</b>]를 인증 창에 입력하세요.</h2><br/>
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

// 리프레쉬 토큰 재발급
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
