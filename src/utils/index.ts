import csurf from "csurf";

// CSRF 미들웨어 초기화
// 원하는 경로에만 csrfProtection를 추가
// 예시 app.post("/users/logout", csrfProtection, (req: Request, res: Response) => {
export const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: true, // HTTPS 환경에서는 true로 설정
    sameSite: "none", // CSRF 보호를 위한 설정
  },
});
