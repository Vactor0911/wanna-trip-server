import { PoolConnection } from "mariadb";
import BoardModel from "../models/board.model";
import {
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from "../errors/CustomErrors";
import { clamp } from "../utils";
import TemplateModel from "../models/template.model";

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
      throw new NotFoundError("보드를 찾을 수 없습니다.");
    } else if (board.userId !== userId) {
      throw new ForbiddenError("권한이 없습니다.");
    }
    return board;
  }

  /**
   * 보드 삽입
   * @param userId 사용자 id
   * @param boardUuid 보드 uuid
   * @param templateUuid 템플릿 uuid
   * @param dayNumber 일차
   * @param connection 데이터베이스 연결 객체
   * @returns 생성 결과
   */
  static async insertBoard(
    userId: string,
    boardUuid: string,
    templateUuid: string,
    dayNumber: number,
    connection: PoolConnection
  ) {
    // 템플릿 소유권 확인
    const template = await TemplateModel.findByUuid(templateUuid);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    } else if (template.user_id !== userId) {
      throw new ForbiddenError("템플릿에 대한 권한이 없습니다.");
    }
    const templateId = template.template_id;

    // 보드 불러오기
    const boards = await BoardModel.findAllByTemplateId(templateId);

    // 보드 개수 검증
    if (boards.length >= 15) {
      throw new ConflictError("보드는 최대 15일차까지 생성할 수 있습니다.");
    }

    // 마지막 일차 추출
    const lastDayNumber = boards[boards.length - 1]?.day_number ?? -1;

    // 보드 일차 조정
    if (dayNumber <= lastDayNumber) {
      try {
        await BoardModel.shiftBoards(
          dayNumber,
          lastDayNumber,
          "right",
          templateId,
          connection
        );
      } catch (error) {
        throw new InternalServerError("보드 생성에 실패했습니다.");
      }
    }

    // 보드 생성
    try {
      const params = {
        boardUuid,
        templateId,
        dayNumber: clamp(dayNumber, 0, lastDayNumber + 1),
      };
      const result = await BoardModel.create(params, connection);
      return result;
    } catch (error) {
      throw new InternalServerError("보드 생성에 실패했습니다.");
    }
  }

  /**
   * 마지막 일차에 보드 추가
   * @param userId 사용자 id
   * @param boardUuid 보드 uuid
   * @param templateUuid 템플릿 uuid
   * @param connection 데이터베이스 연결 객체
   * @returns 생성 결과
   */
  static async appendBoard(
    userId: string,
    boardUuid: string,
    templateUuid: string,
    connection: PoolConnection
  ) {
    // 템플릿 소유권 확인
    const template = await TemplateModel.findByUuid(templateUuid);
    if (!template) {
      throw new NotFoundError("템플릿을 찾을 수 없습니다.");
    } else if (template.user_id !== userId) {
      throw new ForbiddenError("템플릿에 대한 권한이 없습니다.");
    }
    const templateId = template.template_id;

    // 보드 불러오기
    const boards = await BoardModel.findAllByTemplateId(templateId);

    // 보드 개수 검증
    if (boards.length >= 15) {
      throw new ConflictError("보드는 최대 15일차까지 생성할 수 있습니다.");
    }

    // 마지막 일차 추출
    const lastDayNumber = boards[boards.length - 1]?.day_number ?? -1;

    // 보드 생성
    try {
      const params = {
        boardUuid,
        templateId,
        dayNumber: lastDayNumber + 1,
      };
      const result = await BoardModel.create(params, connection);
      return result;
    } catch (error) {
      throw new InternalServerError("보드 생성에 실패했습니다.");
    }
  }
}

export default BoardService;
