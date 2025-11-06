import { NextFunction, Request, Response } from "express";
import { ZodError, ZodObject } from "zod";
import { BadRequestError } from "../errors/CustomErrors";

const formatZodError = (error: ZodError<any>) => {
  return error.issues
    .map((err) => `${err.path.join(".")}: ${err.message}`)
    .join(", ");
};

/**
 * request body 검증 미들웨어
 * @param schema zod 스키마
 * @returns 미들웨어 함수
 */
export const validateBody = (schema: ZodObject) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 스키마 검증 및 파싱
      const validated = schema.safeParse(req.body);
      if (!validated.success) {
        const formattedError = formatZodError(validated.error);
        throw new BadRequestError(
          `요청 데이터가 유효하지 않습니다: ${formattedError}`
        );
      }

      // 검증된 데이터로 body 교체
      req.body = validated.data;

      // 다음 미들웨어로 이동
      next();
    } catch (error) {
      // 에러 핸들링 미들웨어로 전달
      next(error);
    }
  };
};

/**
 * request params 검증 미들웨어
 * @param schema zod 스키마
 * @returns 미들웨어 함수
 */
export const validateParams = (schema: ZodObject) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 스키마 검증 및 파싱
      const validated = schema.safeParse(req.params);
      if (!validated.success) {
        const formattedError = formatZodError(validated.error);
        throw new BadRequestError(
          `요청 데이터가 유효하지 않습니다: ${formattedError}`
        );
      }

      // 검증된 데이터로 params 교체
      req.params = validated.data as any;

      // 다음 미들웨어로 이동
      next();
    } catch (error) {
      // 에러 핸들링 미들웨어로 전달
      next(error);
    }
  };
};

/**
 * request query 검증 미들웨어
 * @param schema zod 스키마
 * @returns 미들웨어 함수
 */
export const validateQuery = (schema: ZodObject) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 스키마 검증 및 파싱
      const validated = schema.safeParse(req.query);
      if (!validated.success) {
        const formattedError = formatZodError(validated.error);
        throw new BadRequestError(
          `요청 데이터가 유효하지 않습니다: ${formattedError}`
        );
      }

      // 검증된 데이터로 query 교체
      req.query = validated.data as any;

      // 다음 미들웨어로 이동
      next();
    } catch (error) {
      // 에러 핸들링 미들웨어로 전달
      next(error);
    }
  };
};
