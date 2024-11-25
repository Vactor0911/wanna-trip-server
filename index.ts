import express, { Request, Response } from "express";
import MariaDB from 'mariadb';
import cors from "cors";
import bodyParser from "body-parser";
import bcrypt from 'bcrypt'; // 비밀번호 암호화 최신버전 express 에서 가지고 있다함
import dotenv from 'dotenv'; // 환경 변수 사용한 민감한 정보 관리


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




// 사용자 로그인 API
app.post('/api/login', async (req: Request, res: Response) => {
  const { sendID, password } = req.body as { sendID: string; password: string };
  console.log("로그인 요청 받은 데이터:", { sendID, password });

  try {
      // 이메일만으로 로그인 가능하도록 구현 테이블 변경
      // 이메일 또는 아이디로 사용자 조회
      const rows = await db.query(
          'SELECT * FROM user WHERE email = ? OR userId = ?', [sendID, sendID]
      );
      console.log("사용자 조회 결과:", rows);

      if (rows.length === 0) {
          console.log("사용자를 찾을 수 없습니다:", sendID);
          return res.status(401).json({ success: false, message: '사용자를 찾을 수 없습니다' });
      }

      // 암호화된 비밀번호 가져오기
      const user_password = rows[0].password;
      console.log("DB에 저장된 비밀번호:", user_password);

      // 비밀번호 비교
      const isPasswordMatch = await bcrypt.compare(password, user_password);
      if (!isPasswordMatch) {
          console.log("비밀번호가 일치하지 않습니다");
          return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다' });
      }

      // 로그인 성공
      console.log("로그인 성공:", sendID);
      res.json({ success: true, message: '로그인 성공' });
  } catch (err) {
      console.error("서버 오류 발생:", err);
      res.status(500).json({ success: false, message: '서버 오류 발생', error: err.message });
  }
});


// 사용자 회원가입 API
app.post('/api/register', async (req: Request, res: Response) => {
  const { userId, password, email, name } = req.body as { userId: string; password: string; email: string; name: string;};
  console.log("받은 데이터:", { userId, password, email, name });

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
          'INSERT INTO user (userId, email, password, plain_password, name) VALUES (?, ?, ?, ?, ?)',
          [userId, email, hashedPassword, password, name]
      );
      console.log("사용자 삽입 결과:", result);

      res.status(201).json({ success: true, message: '사용자가 성공적으로 등록되었습니다' });
  } catch (err) {
      console.error("서버 오류 발생:", err);
      res.status(500).json({ success: false, message: '서버 오류 발생', error: err.message });
  }
});

//사용자 닉네임 조회 API
app.get('/api/user-info', async (req: Request, res: Response) => {
  const { sendID } = req.query;

  if (!sendID) {
      return res.status(400).json({ success: false, message: '이메일 혹은 아이디가 필요합니다.' });
  }

  try {
      const rows: any[] = await db.query('SELECT name FROM user WHERE email = ? or userId = ?', [sendID, sendID]);
      if (rows.length === 0) {
          return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      }

      const user = rows[0];
      res.json({ success: true, message: `${user.name}님 환영합니다!`, nickname: user.name });
  } catch (err) {
      console.error("서버 오류 발생:", err);
      res.status(500).json({ success: false, message: '서버 오류 발생', error: err.message });
  }
});



