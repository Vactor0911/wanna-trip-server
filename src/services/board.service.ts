import { PoolConnection } from "mariadb";
import BoardModel from "../models/board.model";

class BoardService {
  /**
   * 보드 id로 보드 조회
   * @param userId 사용자 id
   * @param boardId 보드 id
   * @returns 조회된 보드
   */
  static async getBoardById(userId: string, boardId: string) {
    const board = await BoardModel.findById(boardId);
    if (!board) {
      throw new Error("보드를 찾을 수 없습니다.", { cause: "NOT_FOUND" });
    } else if (board.userId !== userId) {
      throw new Error("권한이 없습니다.", { cause: "FORBIDDEN" });
    }
    return board;
  }

  /**
   * 보드 생성
   * @param boardUuid 보드 uuid
   * @param templateId 템플릿 id
   * @param dayNumber 일차
   * @param connection 데이터베이스 연결 객체
   * @returns 생성 결과
   */
  static async createBoard(
    boardUuid: string,
    templateId: string,
    dayNumber: number,
    connection: PoolConnection
  ) {
    // 일차 중복 확인
    const existingBoard = await BoardModel.findByTemplateIdAndDayNumber(
      templateId,
      dayNumber
    );
    if (existingBoard) {
      throw new Error("이미 존재하는 일차입니다.", {
        cause: "CONFLICT",
      });
    }

    // 보드 생성
    try {
      const params = {
        boardUuid,
        templateId,
        dayNumber,
      };
      const result = await BoardModel.create(params, connection);
      return result;
    } catch (error) {
      throw new Error("보드 생성에 실패했습니다.", {
        cause: "INTERNAL_SERVER_ERROR",
      });
    }
  }
}

export default BoardService;
