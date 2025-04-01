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
};

// 카카오 간편 로그인
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

// 구글 간편 로그인
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

// 이메일 인증 코드 전송
export const sendVerifyEmail = async (req: Request, res: Response) => {
  const { email, id, purpose, name = "" } = req.body; // 요청에 id 추가, name은 선택적

  if (!email || !id) {
    res
      .status(400)
      .json({ success: false, message: "학번과 이메일 주소가 필요합니다." });
    return;
  }
  if (!validator.isEmail(email)) {
    res
      .status(400)
      .json({ success: false, message: "유효한 이메일 주소를 입력하세요." });
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

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction(); // 트랜잭션 시작

    switch (purpose) {
      case "resetPassword":
        const resetRows = await connection.query(
          "SELECT id, email, state FROM user WHERE id = ? AND email = ?",
          [id, email]
        );
        const resetUser = resetRows[0];

        if (!resetUser) {
          res.status(404).json({
            success: false,
            message: "학번과 이메일이 일치하는 계정이 없습니다.",
          });
          return;
        }

        if (resetUser.state === "inactive") {
          res.status(400).json({
            success: false,
            message: "탈퇴된 계정입니다. 관리자에게 문의해주세요.",
          });
          return;
        }
        break;

      case "verifyAccount":
        const studentRows = await connection.query(
          "SELECT student_id FROM student WHERE student_id = ? AND name = ?",
          [id, name]
        );
        const student = studentRows[0];

        if (!student) {
          res.status(400).json({
            success: false,
            message:
              "해당 학번과 이름에 맞는 학생 정보를 찾을 수 없습니다. 관리자에게 문의하세요.",
          });
          return;
        }

        const existingUserRows = await connection.query(
          "SELECT id, email, state FROM user WHERE id = ? OR email = ?",
          [id, email]
        );
        const existingUser = existingUserRows[0];

        if (existingUser) {
          if (existingUser.id === id) {
            res.status(400).json({
              success: false,
              message: "이미 존재하는 학번입니다. 다른 학번을 사용해주세요.",
            });
            return;
          }

          if (existingUser.email === email) {
            if (existingUser.state === "inactive") {
              res.status(400).json({
                success: false,
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

      case "accountRecovery":
        const recoveryRows = await connection.query(
          "SELECT id, email, state FROM user WHERE id = ? AND email = ?",
          [id, email]
        );
        const recoveryUser = recoveryRows[0];

        if (!recoveryUser) {
          res.status(404).json({
            success: false,
            message: "학번과 이메일이 일치하는 계정이 없습니다.",
          });
          return;
        }

        if (recoveryUser.state !== "inactive") {
          res
            .status(400)
            .json({ success: false, message: "이미 활성화된 계정입니다." });
          return;
        }
        break;

      case "modifyInfo":
        const modifyRows = await connection.query(
          "SELECT id, email FROM user WHERE id = ?",
          [id]
        );
        const modifyUser = modifyRows[0];

        if (!modifyUser) {
          res.status(404).json({
            success: false,
            message: "해당 학번과 일치하는 계정을 찾을 수 없습니다.",
          });
          return;
        }

        if (modifyUser.email === email) {
          res.status(400).json({
            success: false,
            message:
              "현재 이메일과 동일한 값입니다. 변경할 이메일을 입력해주세요.",
          });
          return;
        }
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
      from: `"FabLab 예약 시스템" <${process.env.NODEMAILER_USER}>`,
      to: email,
      subject: "[FabLab 예약 시스템] 인증번호를 입력해주세요.",
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
      .json({ success: false, message: "유효한 이메일 주소를 입력하세요." });
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
  dbPool.query("SELECT * FROM user WHERE id = ? AND email = ?", [id, email])
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
