import express, { Request, Response } from "express";
import MariaDB from "mariadb";
import cors from "cors";
import bcrypt from "bcrypt"; // 비밀번호 암호화 최신버전 express 에서 가지고 있다함
import dotenv from "dotenv"; // 환경 변수 사용한 민감한 정보 관리
import axios from "axios"; // HTTP 요청을 위한 라이브러리
import jwt from "jsonwebtoken"; //JWT 발급을 위한 라이브러리 설치
import crypto from "crypto"; // 추가: refreshToken 생성에 사용할 라이브러리

// .env 파일 로드
dotenv.config();

const PORT = 3000; // 서버가 실행될 포트 번호

const app = express();
app.use(cors()); // CORS 미들웨어 추가
app.use(express.json()); // JSON 요청을 처리하기 위한 미들웨어

// MariaDB 연결
const db = MariaDB.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionLimit: 10,
});

// MariaDB 연결 확인
db.getConnection()
  .then((conn) => {
    console.log("데이터베이스가 성공적으로 연결되었습니다");
    conn.release();
  })
  .catch((err) => {
    console.error("데이터베이스 연결에 실패하였습니다.", err.message);
  });

// 기본 라우트 설정
app.get("/", (req, res) => {
  res.send("Wanna Trip Web Server!");
});

// 서버 시작
app.listen(PORT, "0.0.0.0", () => {
  console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});

// ----------------- API 라우트 -----------------

// # [ 로그인, 회원가입 API ] #

// *** 사용자 로그인 API 시작 ***
app.post("/api/login", (req: Request, res: Response) => {
  const { email, password } = req.body;

  console.log("로그인 요청 받은 데이터:", { email, password });

  // Step 1: 이메일로 사용자 조회
  db.query("SELECT * FROM user WHERE email = ?", [email])
    .then((rows: any) => {
      console.log("사용자 조회 결과:", rows);

      if (rows.length === 0) {
        // 사용자가 없는 경우
        console.log("사용자를 찾을 수 없습니다:", email);
        return res.status(401).json({
          success: false,
          message: "사용자를 찾을 수 없습니다. 회원가입 후 이용해주세요.",
        });
      }

      const user = rows[0];

      // Step 2: 간편 로그인 사용자 확인
      if (user.loginType !== "normal") {
        console.log(
          "간편 로그인 사용자는 일반 로그인을 사용할 수 없습니다:",
          email
        );
        return res.status(401).json({
          success: false,
          message:
            "간편 로그인 사용자는 일반 로그인을 사용할 수 없습니다.\n간편 로그인으로 이용해주세요.",
        });
      }

      // Step 3: 암호화된 비밀번호 비교
      return bcrypt.compare(password, user.password).then((isPasswordMatch) => {
        if (!isPasswordMatch) {
          console.log("비밀번호가 일치하지 않습니다");
          return res.status(401).json({
            success: false,
            message: "비밀번호가 일치하지 않습니다",
          });
        }

        // Step 4: 로그인 성공 처리
        const nickname = user.name; // DB의 name 필드를 닉네임으로 사용
        console.log(`[${email}] ${nickname}님 로그인 성공`);
        res.json({
          success: true,
          message: "로그인 성공",
          nickname: nickname, // 닉네임 반환
          userId : user.userId // 사용자 ID 반환
        });

        // Step 5: 터미널에 반환 정보 출력
        console.log("반환 정보:", {
          success: true,
          message: "로그인 성공",
          nickname: nickname,
          userId: user.userId,
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
}); // 사용자 로그인 API 끝

// *** 로그아웃 API 수정 ***
app.post("/api/logout", async (req: Request, res: Response) => {
  const { email, token } = req.body;

  // `undefined`를 명시적으로 `null`로 변환
  const receivedToken = token || null;

  console.log("로그아웃 요청 받은 데이터:", { email, receivedToken });

  try {
    // Step 1: 사용자 조회
    const rows = await db.query("SELECT * FROM user WHERE email = ?", [email]);

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

    console.log("DB에서 가져온 토큰 값:", storedToken);

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
    await db.query(
      "UPDATE user SET token = NULL, refreshToken = NULL WHERE email = ?",
      [email]
    );

    console.log(`[${email}] 님의 로그아웃이 성공적으로 완료되었습니다.`);

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
}); // *** 로그아웃 API 끝 ***

// *** 카카오 간편 로그인 API 시작
app.post("/api/login/kakao", (req: Request, res: Response) => {
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

      // Step 3: DB에서 사용자 정보 조회
      return db
        .query("SELECT * FROM user WHERE email = ?", [kakaoEmail])
        .then((rows: any) => {
          if (rows.length === 0) {
            // 신규 사용자 등록
            return db.query(
              "INSERT INTO user (email, name, loginType, token) VALUES (?, ?, ?, ?)",
              [kakaoEmail, kakaoName, "kakao", token]
            );
          } else {
            // 기존 사용자 정보 업데이트
            return db.query(
              "UPDATE user SET name = ?, loginType = ?, token = ? WHERE email = ?",
              [kakaoName, "kakao", token, kakaoEmail]
            );
          }
        })
        .then(() => {
          // Step 4: 사용자 ID 조회
          return db
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
              return db
                .query(
                  "UPDATE user SET token = ?, refreshToken = ? WHERE email = ?",
                  [accessToken, refreshToken, kakaoEmail]
                )
                .then(() => {
                  // Step 8: 클라이언트로 응답 반환
                  res.status(200).json({
                    success: true,
                    message: `[ ${kakaoName} ] 님 환영합니다!`,
                    userId: user.userId, // 사용자 ID 반환
                    email: kakaoEmail,
                    name: kakaoName,
                    loginType: "kakao",
                    accessToken,
                    refreshToken, // 클라이언트에 RefreshToken 반환
                  });
                  console.log("반환 정보:", {
                    success: true,
                    message: `[ ${kakaoName} ] 님 환영합니다!`,
                    userId: user.userId,
                    email: kakaoEmail,
                    name: kakaoName,
                    loginType: "kakao",
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
}); // *** 카카오 간편 로그인 API 끝 ***

// *** 구글 간편 로그인 API 시작
app.post("/api/login/google", async (req: Request, res: Response) => {
  const { email, name } = req.body;

  try {
    // Step 1: 사용자 이메일로 조회
    const rows = await db.query("SELECT * FROM user WHERE email = ?", [email]);

    if (rows.length === 0) {
      // Step 2: 신규 사용자라면 DB에 삽입
      await db.query(
        "INSERT INTO user (email, name, loginType, status) VALUES (?, ?, ?, ?)",
        [email, name, "google", "active"] // loginType: google, status: active
      );
    } else {
      // Step 3: 기존 사용자라면 정보 업데이트
      await db.query(
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

    // Step 6: RefreshToken 및 AccessToken DB 저장
    await db.query(
      "UPDATE user SET token = ?, refreshToken = ? WHERE email = ?",
      [accessToken, refreshToken, email]
    );

    // Step 7: 성공 응답 반환
    res.status(200).json({
      success: true,
      message: `[ ${name} ] 님 환영합니다!`,
      userId: rows[0].userId, // 사용자 ID 반환
      email,
      name,
      loginType: "google",
      accessToken,
      refreshToken, // 클라이언트에 반환
    });
    // Step 8: 터미널에 반환 정보 출력
    console.log("반환 정보:", {
      success: true,
      message: `[ ${name} ] 님 환영합니다!`,
      userId: rows[0].userId,
      email,
      name,
      loginType: "google",
    });
  } catch (err) {
    console.error("구글 로그인 처리 중 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "구글 로그인 처리 중 오류가 발생했습니다.",
    });
  }
}); // *** 구글 간편 로그인 API 끝

// *** 토큰 리프레시 API 시작
app.post("/api/token/refresh", async (req: Request, res: Response) => {
  const { email, refreshToken, loginType } = req.body;

  try {
    const rows: any = await db.query(
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

// *** 사용자 회원가입 API 시작
app.post("/api/register", (req: Request, res: Response) => {
  const { email, password, name } = req.body as {
    email: string;
    password: string;
    name: string;
  };
  console.log("받은 데이터:", { email, password, name });

  // Step 1: 이메일 중복 확인
  db.query("SELECT * FROM user WHERE email = ?", [email])
    .then((rows_email: any) => {
      if (rows_email.length > 0) {
        console.log("이메일이 이미 존재합니다:", email);
        return res
          .status(400)
          .json({ success: false, message: "이메일이 이미 존재합니다" });
      }

      // Step 2: 비밀번호 암호화
      return bcrypt.hash(password, 10);
    })
    .then((hashedPassword: string) => {
      console.log("Hashed password:", hashedPassword);

      // Step 3: 사용자 저장
      return db.query(
        "INSERT INTO user (email, password, name) VALUES (?, ?, ?)",
        [email, hashedPassword, name]
      );
    })
    .then((result: any) => {
      console.log("사용자 삽입 결과:", result);
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
}); // *** 사용자 회원가입 API 끝

// *** 이메일 중복 검사 API
app.post("/api/emailCheck", (req: Request, res: Response) => {
  const { email } = req.body as { email: string };

  console.log("이메일 중복 검사 요청 받은 데이터:", { email });

  // Step 1: 이메일을 기준으로 사용자 조회
  db.query("SELECT user_id, email FROM user WHERE email = ?", [email])
    .then((rows: any) => {
      console.log("이메일 조회 결과:", rows);

      if (rows.length > 0) {
        // 이미 이메일이 존재하는 경우
        console.log("이미 존재하는 이메일:", email);
        return res.status(200).json({
          success: false,
          message: "이미 사용 중인 이메일입니다.",
        });
      }

      // 이메일이 없는 경우
      console.log("사용 가능한 이메일:", email);
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



// *** 템플릿, 보드, 카드 업데이트 API 시작 ***
app.post("/api/update-template", (req: Request, res: Response) => {
  const { action, data } = req.body;

  switch (action) {
    // 시간 업데이트
    case "updateTime": {
      const { cardId, timeStart, timeEnd } = data;

      // 유효성 검사: 시간 형식이 00:00 ~ 24:00인지 확인
      const isValidTime = (time: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);

      if (!isValidTime(timeStart) || !isValidTime(timeEnd)) {
        res.status(400).json({
          success: false,
          message: "시간은 00:00 ~ 24:00 사이여야 합니다.",
        });
        return
      }

      if (timeStart >= timeEnd) {
        res.status(400).json({
          success: false,
          message: "시작 시간이 종료 시간보다 이전이어야 합니다.",
        });
        return;
      }

      // Step 1: 선택된 카드 업데이트
      db.query(
        "UPDATE card SET timeStart = ?, timeEnd = ? WHERE cardId = ?",
        [timeStart, timeEnd, cardId]
      )
        .then(() => {
          // Step 2: 동일한 보드의 다른 카드 가져오기
          return db.query(
            `
            SELECT * 
            FROM card 
            WHERE cardId != ? 
              AND position LIKE CONCAT(SUBSTRING_INDEX(
                (SELECT position FROM card WHERE cardId = ?), ',', 1), ',%') 
            ORDER BY timeStart
          `,
            [cardId, cardId]
          );
        })
        .then((rows: any[]) => {
          let previousEndTime = timeEnd;
          const updates: Promise<any>[] = [];

          for (const card of rows) {
            if (card.timeStart < previousEndTime) {
              // Step 3: 카드가 겹치는 경우 시간 재배치
              const duration =
                new Date(`1970-01-01T${card.timeEnd}:00Z`).getTime() -
                new Date(`1970-01-01T${card.timeStart}:00Z`).getTime();
              const newStartTime = new Date(`1970-01-01T${previousEndTime}:00Z`);
              const newEndTime = new Date(newStartTime.getTime() + duration);

              const formattedStart = newStartTime.toISOString().slice(11, 16);
              const formattedEnd = newEndTime.toISOString().slice(11, 16);

              updates.push(
                db.query<any>("UPDATE card SET timeStart = ?, timeEnd = ? WHERE cardId = ?", [
                  formattedStart,
                  formattedEnd,
                  card.cardId,
                ])
              );

              previousEndTime = formattedEnd;
            } else {
              // Step 4: 카드가 겹치지 않는 경우, 다음 종료 시간 업데이트
              previousEndTime = card.timeEnd;
            }
          }

          return Promise.all(updates);
        })
        .then(() => {
          res.status(200).json({ success: true, message: "시간 업데이트 완료" });
        })
        .catch((err) => {
          console.error("시간 업데이트 오류:", err);
          res.status(500).json({ success: false, message: "시간 업데이트 실패" });
        });
      break;
    }

    // 내용 업데이트
    case "updateContent": {
      const { cardId: contentCardId, content } = data;

      db.query("UPDATE card SET content = ? WHERE cardId = ?", [content, contentCardId])
        .then(() => {
          res.status(200).json({ success: true, message: "내용 업데이트 완료" });
        })
        .catch((err) => {
          console.error("내용 업데이트 오류:", err);
          res.status(500).json({ success: false, message: "내용 업데이트 실패" });
        });
      break;
    }

    // 보드 위치 교환
    case "swapBoardPosition": {
      const { board1Position, board2Position } = data;

      if (!board1Position || !board2Position) {
        res.status(400).json({ success: false, message: "잘못된 요청" });
        return;
      }

      const [board1Day] = board1Position.split(","); // "0"
      const [board2Day] = board2Position.split(","); // "1"

      // Step 2: 모든 카드의 day 값을 교환
      db.query(
        "UPDATE card SET position = REPLACE(position, ?, 'temp') WHERE position LIKE CONCAT(?, ',%')",
        [board1Day, board1Day]
      )
        .then(() =>
          db.query(
            "UPDATE card SET position = REPLACE(position, ?, ?) WHERE position LIKE CONCAT(?, ',%')",
            [board2Day, board1Day, board2Day]
          )
        )
        .then(() =>
          db.query(
            "UPDATE card SET position = REPLACE(position, 'temp', ?) WHERE position LIKE 'temp,%'",
            [board2Day]
          )
        )
        .then(() => {
          res.status(200).json({ success: true, message: "보드 위치 교환 완료" });
          console.log(`보드 위치가 교환되었습니다: ${board1Position} <-> ${board2Position}`);
        })
        .catch((err) => {
          console.error("보드 위치 교환 오류:", err);
          res.status(500).json({ success: false, message: "보드 위치 교환 실패" });
        });
      break;
    }

    default:
      res.status(400).json({ success: false, message: "잘못된 요청" });
  }
});
// *** 템플릿, 보드, 카드 업데이트 API 끝 ***














// # [ 작업 핸들링 API ] #
app.post("/api/get-task", (req: Request, res: Response) => {
  const { userId } = req.body as { userId: number };
});