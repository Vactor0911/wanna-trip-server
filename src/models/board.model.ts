import { Pool, PoolConnection } from "mariadb";
import { dbPool } from "../config/db";

type CreateBoardParams = {
  boardUuid: string;
  templateId: string;
  dayNumber: number;
};

class BoardModel {
  /**
   * 보드 id로 보드 조회
   * @param boardId 보드 id
   * @returns 조회된 보드
   */
  static async findById(boardId: string) {
    const boards = await dbPool.execute(
      `
        SELECT * FROM board
        WHERE board_id = ?
        LIMIT 1
      `,
      [boardId]
    );
    return boards && boards.length > 0 ? boards[0] : null;
  }

  /**
   * 보드 uuid로 보드 조회
   * @param boardUuid 보드 uuid
   * @returns 조회된 보드
   */
  static async findByUuid(boardUuid: string) {
    const boards = await dbPool.execute(
      `
        SELECT * FROM board
        WHERE board_uuid = ?
        LIMIT 1
      `,
      [boardUuid]
    );
    return boards && boards.length > 0 ? boards[0] : null;
  }

  /**
   * 템플릿 id와 일차로 보드 조회
   * @param templateId 템플릿 id
   * @param dayNumber 일차
   * @returns 조회된 보드
   */
  static async findByTemplateIdAndDayNumber(
    templateId: string,
    dayNumber: number
  ) {
    const boards = await dbPool.execute(
      `
        SELECT * FROM board
        WHERE template_id = ? AND day_number = ?
        LIMIT 1
      `,
      [templateId, dayNumber]
    );
    return boards && boards.length > 0 ? boards[0] : null;
  }

  /**
   * 템플릿 id로 보드 전체 조회
   * @param templateId 템플릿 id
   * @returns 조회된 보드 목록
   */
  static async findAllByTemplateId(templateId: string) {
    const boards = await dbPool.execute(
      `
        SELECT * FROM board
        WHERE template_id = ?
        ORDER BY day_number ASC
      `,
      [templateId]
    );
    return boards;
  }

  /**
   * 보드 id로 템플릿 조회
   * @param boardId 보드 id
   * @returns 조회된 템플릿
   */
  static async findTemplateById(boardId: string) {
    const templates = await dbPool.execute(
      `
        SELECT t.*
        FROM board b
        JOIN template t ON b.template_id = t.template_id
        WHERE b.board_id = ?
        LIMIT 1
      `,
      [boardId]
    );
    return templates && templates.length > 0 ? templates[0] : null;
  }

  /**
   * 보드 uuid로 템플릿 조회
   * @param boardUuid 보드 uuid
   * @returns 조회된 템플릿
   */
  static async findTemplateByUuid(boardUuid: string) {
    const templates = await dbPool.execute(
      `
        SELECT t.*
        FROM board b
        JOIN template t ON b.template_id = t.template_id
        WHERE b.board_uuid = ?
        LIMIT 1
      `,
      [boardUuid]
    );
    return templates && templates.length > 0 ? templates[0] : null;
  }

  /**
   * 보드 생성
   * @param params 보드 생성 파라미터
   * @param connection 데이터베이스 연결 객체
   * @returns 생성 결과
   */
  static async create(
    params: CreateBoardParams,
    connection: PoolConnection | Pool = dbPool
  ) {
    const { boardUuid, templateId, dayNumber } = params;

    const result = await connection.execute(
      `INSERT INTO board (board_uuid, template_id, day_number) VALUES (?, ?, ?)`,
      [boardUuid, templateId, dayNumber]
    );
    return result;
  }

  /**
   * 보드 id로 보드 삭제
   * @param boardId 보드 id
   * @param connection 데이터베이스 연결 객체
   * @returns 삭제 결과
   */
  static async deleteById(
    boardId: string,
    connection: PoolConnection | Pool = dbPool
  ) {
    const result = await connection.execute(
      `
        DELETE FROM board
        WHERE board_id = ?
      `,
      [boardId]
    );
    return result;
  }

  /**
   * 보드 uuid로 보드 삭제
   * @param boardUuid 보드 uuid
   * @param connection 데이터베이스 연결 객체
   * @returns 삭제 결과
   */
  static async deleteByUuid(
    boardUuid: string,
    connection: PoolConnection | Pool = dbPool
  ) {
    const result = await connection.execute(
      `
        DELETE FROM board
        WHERE board_uuid = ?
      `,
      [boardUuid]
    );
    return result;
  }

  /**
   * 보드 일차 이동
   * @param dayNumber 보드 일차
   * @param boardId 보드 id
   * @param connection 데이터베이스 연결 객체
   * @returns 일차 이동 결과
   */
  static async moveBoard(
    dayNumber: number,
    boardId: string,
    connection: PoolConnection | Pool = dbPool
  ) {
    const result = await connection.execute(
      `
        UPDATE board
        SET day_number = ?
        WHERE board_id = ?
      `,
      [dayNumber, boardId]
    );
    return result;
  }

  /**
   * 범위 내 보드 일차 이동
   * @param fromDayNumber 시작 일차
   * @param toDayNumber 종료 일차
   * @param shiftBy 이동 방향
   * @param templateId 템플릿 id
   * @param connection 데이터베이스 연결 객체
   * @returns 보드 이동 결과
   */
  static async shiftBoards(
    fromDayNumber: number,
    toDayNumber: number,
    shiftBy: "left" | "right",
    templateId: string,
    connection: PoolConnection | Pool = dbPool
  ) {
    const direction = shiftBy === "right" ? 1 : -1;
    const result = await connection.execute(
      `
        UPDATE board
        SET day_number = day_number + ?
        WHERE day_number BETWEEN ? AND ? AND template_id = ?
      `,
      [direction, fromDayNumber, toDayNumber, templateId]
    );
    return result;
  }
}

export default BoardModel;
