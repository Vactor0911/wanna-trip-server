import { Request, Response } from "express";

// Request 타입 확장
declare module "express" {
    export interface Request {
      csrfToken?: () => string; // csrfToken 메서드 정의
    }
  }

// CSRF 토큰 요청
export const csrfToken = (req: Request, res: Response) => {
    try {
        const csrfToken = req.csrfToken?.(); // csrfToken 메서드 사용
        res.json({
          csrfToken: csrfToken,
        }); // csrfToken 메서드 사용
      } catch (err) {
        console.error("CSRF 토큰 생성 중 오류 발생:", err);
        res.status(500).json({
          success: false,
          message: "CSRF 토큰 생성 중 오류가 발생했습니다.",
        });
      }
};
