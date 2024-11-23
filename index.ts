import express from "express";
import cors from "cors";
const PORT = 3000; // 서버가 실행될 포트 번호

const app = express();
app.use(cors());

// 기본 라우트 설정
app.get("/", (req, res) => {
  res.send("Hello, World!");
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
