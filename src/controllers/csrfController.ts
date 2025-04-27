import { Request, Response } from "express";

// Request 타입 확장
declare module "express" {
  export interface Request {
    csrfToken?: () => string; // csrfToken 메서드 정의
  }
}

// CSRF 토큰 요청
export const csrfToken = (req: Request, res: Response): void => {
  try {
    const token = req.csrfToken?.();
    if (!token) {
      res.status(500).json({
        success: false,
        message: "CSRF 토큰을 생성할 수 없습니다.",
      });
      return;
    }

    res.json({
      success: true,
      csrfToken: token,
    });
  } catch (err) {
    console.error("CSRF 토큰 생성 중 오류 발생:", err);
    res.status(500).json({
      success: false,
      message: "CSRF 토큰 생성 중 오류가 발생했습니다.",
    });
  }
};