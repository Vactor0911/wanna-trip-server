import csurf from "csurf";
import rateLimit from "express-rate-limit"; // 요청 제한 미들웨어

// 일반 API용 Rate Limiter
export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 분 제한
  max: 10, // 요청 횟수
  standardHeaders: true, // 최신 표준 헤더 포함
  legacyHeaders: false, // 구형 헤더 비활성화
  // 동적 메시지 생성을 위한 함수 사용
  message: (req, res) => {
    const resetTime = Math.ceil(
      (res.getHeader("RateLimit-Reset") as number) / 60
    ); // 초를 분으로 변환
    return {
      success: false,
      message: `너무 많은 요청이 발생했습니다.\n${resetTime}분 후에 다시 시도해주세요.`,
    };
  },
});

// 토큰 리프레셔용 Rate Limiter (더 관대한 제한)
export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 3000, // 15분간 3000번 요청 가능 (더 많은 요청 허용)
  standardHeaders: true,
  legacyHeaders: false,
  message: (req, res) => {
    const resetTime = Math.ceil(
      (res.getHeader("RateLimit-Reset") as number) / 60
    );
    return {
      success: false,
      message: `토큰 갱신 요청이 너무 많습니다.\n${resetTime}분 후에 다시 시도해주세요.`,
    };
  },
});

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
