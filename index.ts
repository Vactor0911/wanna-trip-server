import express, { Request, Response } from "express";
import MariaDB from 'mariadb';
import cors from "cors";
import bodyParser from "body-parser";
import bcrypt from 'bcrypt'; // 비밀번호 암호화 최신버전 express 에서 가지고 있다함
import dotenv from 'dotenv'; // 환경 변수 사용한 민감한 정보 관리
import axios from 'axios'; // HTTP 요청을 위한 라이브러리


// .env 파일 로드
dotenv.config();

const PORT = 3005; // 서버가 실행될 포트 번호

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MariaDB 연결 (createPool 사용)
const db = MariaDB.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
});

console.log(process.env.DB_HOST, process.env.DB_PORT, process.env.DB_USERNAME, process.env.DB_PASSWORD, process.env.DB_NAME);

// MariaDB 연결 확인
db.getConnection()
    .then(conn => {
        console.log("데이터베이스가 성공적으로 연결되었습니다");
        conn.release();
    })
    .catch(err => {
        console.error("데이터베이스 연결에 실패하였습니다.", err.message);
    });


// 기본 라우트 설정
app.get("/", (req, res) => {
  res.send("Wanna Trip Web Server!");
});

// 서버 시작
app.listen(PORT, "0.0.0.0", () => {
  console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.\n http://localhost:${PORT}/`);
});



// *** 사용자 로그인 API 시작
app.post('/api/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  console.log("로그인 요청 받은 데이터:", { email, password });

  try {
      // 이메일로 사용자 조회
      const rows = await db.query('SELECT * FROM user WHERE email = ?', [email]);
      console.log("사용자 조회 결과:", rows);

      // 사용자가 없는 경우
      if (rows.length === 0) {
          console.log("사용자를 찾을 수 없습니다:", email);
          return res.status(401).json({ 
              success: false, 
              message: '사용자를 찾을 수 없습니다. 회원가입 후 이용해주세요.' 
          });
      }

      const user = rows[0];

      // 간편 로그인 사용자 확인
      if (user.loginType !== 'normal') { 
          console.log("간편 로그인 사용자는 일반 로그인을 사용할 수 없습니다:", email);
          return res.status(401).json({ 
              success: false, 
              message: '간편 로그인 사용자는 일반 로그인을 사용할 수 없습니다. 간편 로그인으로 이용해주세요.' 
          });
      }

      // 암호화된 비밀번호 가져오기
      const user_password = user.password;
      console.log("DB에 저장된 비밀번호:", user_password);

      // 비밀번호 비교
      const isPasswordMatch = await bcrypt.compare(password, user_password);
      if (!isPasswordMatch) {
          console.log("비밀번호가 일치하지 않습니다");
          return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다' });
      }

      // 로그인 성공
      const nickname = user.name; // DB의 name 필드를 닉네임으로 사용
      console.log(`[${email}] ${nickname}님 로그인 성공`);
      res.json({ 
          success: true, 
          message: '로그인 성공', 
          nickname: nickname // 닉네임 반환
      });
  } catch (err) {
      console.error("서버 오류 발생:", err);
      res.status(500).json({ success: false, message: '서버 오류 발생', error: err.message });
  }
}); // 사용자 로그인 API 끝


// *** 로그아웃 API 추가
app.post('/api/logout', async (req: Request, res: Response) => {
  const { email, token } = req.body;

  try {
    // DB에서 사용자 조회
    const rows = await db.query("SELECT * FROM user WHERE email = ?", [email]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });
    }

    const storedToken = rows[0].token;
    const loginType = rows[0].loginType;

    // 간편 로그인 사용자(카카오)의 경우 토큰 검증
    if (loginType === "kakao" && storedToken !== token) {
      return res.status(401).json({ success: false, message: "잘못된 토큰입니다." });
    }

    // 로그아웃 처리: 토큰 필드를 null로 업데이트
    await db.query("UPDATE user SET token = NULL WHERE email = ?", [email]);

    console.log(`사용자 [${email}] 로그아웃 성공`);
    res.status(200).json({ success: true, message: "로그아웃이 성공적으로 완료되었습니다." });
  } catch (err) {
    console.error("로그아웃 처리 중 오류 발생:", err);
    res.status(500).json({ success: false, message: "로그아웃 처리 중 오류가 발생했습니다." });
  }
});
 // 로그아웃 API 끝



// *** 카카오 간편 로그인 API 시작
app.post('/api/login/kakao', async (req: Request, res: Response) => {
  const { email, name, loginType, token } = req.body; // 클라이언트에서 전달된 사용자 정보

  try {
    // Access Token 유효성 검증
    const kakaoResponse = await axios.get("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (kakaoResponse.status !== 200) {
      return res.status(401).json({ success: false, message: "잘못된 토큰 또는 만료된 토큰" });
    }

    // DB에서 사용자 조회
    const rows = await db.query("SELECT * FROM user WHERE email = ?", [email]);
    if (rows.length === 0) {
      // 사용자 등록
      await db.query(
        "INSERT INTO user (email, name, loginType, token) VALUES (?, ?, ?, ?)",
        [email, name, loginType, token]
      );
    } else {
      // 기존 사용자 정보 업데이트
      await db.query(
        "UPDATE user SET name = ?, loginType = ?, token = ? WHERE email = ?",
        [name, loginType, token, email]
      );
    }

    console.log(`[${email}] 로그인 성공`);

    // 성공 응답
    res.status(200).json({
      success: true,
      message: `${name} 님 환영합니다!`,
      email,
      name,
      loginType,
    });

  } catch (err) {
    console.error("카카오 간편 로그인 처리 실패:", err);
    res.status(500).json({ success: false, message: "카카오 로그인 실패" });
  }
});  //카카오 간편 로그인 API 끝

// *** 토큰 리프레시 API 시작
app.post('/api/token/refresh', async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    const rows = await db.query("SELECT refreshToken FROM user WHERE email = ?", [email]);
    if (rows.length === 0 || !rows[0].refreshToken) {
      return res.status(401).json({ success: false, message: "Refresh Token이 없습니다." });
    }

    const refreshToken = rows[0].refreshToken;
    const response = await axios.post("https://kauth.kakao.com/oauth/token", null, {
      params: {
        grant_type: "refresh_token",
        client_id: process.env.KAKAO_CLIENT_ID,
        refresh_token: refreshToken,
      },
    });

    const newAccessToken = response.data.access_token;
    res.status(200).json({ success: true, token: newAccessToken });
  } catch (err) {
    console.error("토큰 갱신 실패:", err);
    res.status(500).json({ success: false, message: "토큰 갱신 실패" });
  }
}); // 토큰 리프레시 API 끝


// *** 사용자 회원가입 API
app.post('/api/register', async (req: Request, res: Response) => {
  const { email, password, name } = req.body as {  email: string; password: string; name: string;};
  console.log("받은 데이터:", {  email, password, name });

  try {
      // 이메일 중복 확인
      const rows_email = await db.query('SELECT * FROM user WHERE email = ?', [email]);
      if (rows_email.length > 0) {
          console.log("이메일이 이미 존재합니다:", email);
          return res.status(400).json({ success: false, message: '이메일이 이미 존재합니다' });
      }
      
      // 비밀번호 암호화
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log("Hashed password:", hashedPassword);

      // 사용자 저장
      const result = await db.query(
          'INSERT INTO user (email, password, plain_password, name) VALUES (?, ?, ?, ?)',
          [ email, hashedPassword, password, name]
      );
      console.log("사용자 삽입 결과:", result);

      res.status(201).json({ success: true, message: '사용자가 성공적으로 등록되었습니다' });
  } catch (err) {
      console.error("서버 오류 발생:", err);
      res.status(500).json({ success: false, message: '서버 오류 발생', error: err.message });
  }
});

  



