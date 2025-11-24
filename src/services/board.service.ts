import { dbPool } from "../config/db";
import { NotFoundError } from "../errors/CustomErrors";
import BoardModel from "../models/board.model";
import TemplateModel from "../models/template.model";
import TransactionHandler from "../utils/transactionHandler";
import TemplateService from "./template.service";

class BoardService {
  /**
   * 보드 생성
   * @param userId 사용자 id
   * @param templateUuid 템플릿 uuid
   * @param dayNumber 보드 일차
   */
  static async createBoard(
    userId: string,
    templateUuid: string,
    dayNumber: number
  ) {
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 템플릿 수정 권한 확인
        await TemplateService.validateEditPermissionByUuid(
          userId,
          templateUuid
        );

        // 템플릿 조회
        const template = await TemplateModel.findByUuid(
          templateUuid,
          connection
        );

        // 보드 생성
        const boardUuid = await BoardModel.create(
          template.template_id,
          dayNumber,
          connection
        );

        // 생성된 보드 UUID 반환
        return boardUuid;
      }
    );
  }

  /**
   * 보드 삭제
   * @param userId 사용자 id
   * @param boardUuid 보드 uuid
   */
  static async deleteBoard(userId: string, boardUuid: string) {
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 보드 조회
        const board = await BoardModel.findByUuid(boardUuid, connection);
        if (!board) {
          throw new NotFoundError("보드를 찾을 수 없습니다.");
        }

        // 템플릿 수정 권한 확인
        await TemplateService.validateEditPermissionById(
          userId,
          board.template_id
        );

        // 보드 삭제
        await BoardModel.delete(boardUuid, connection);

        // 보드 일차 재정렬
        await BoardModel.reorderBoards(board.template_id, connection);
      }
    );
  }

  /**
   * 보드 초기화
   * @param userId 사용자 id
   * @param boardUuid 보드 uuid
   */
  static async clearBoard(userId: string, boardUuid: string) {
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 보드 조회
        const board = await BoardModel.findByUuid(boardUuid, connection);
        if (!board) {
          throw new NotFoundError("보드를 찾을 수 없습니다.");
        }

        // 템플릿 수정 권한 확인
        await TemplateService.validateEditPermissionById(
          userId,
          board.template_id
        );

        // 보드 초기화
        await BoardModel.clear(board.board_id, connection);
      }
    );
  }

  /**
   * 보드 복제
   * @param userId 사용자 id
   * @param boardUuid 보드 uuid
   */
  static async copyBoard(userId: string, boardUuid: string) {
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 보드 조회
        const board = await BoardModel.findByUuid(boardUuid, connection);
        if (!board) {
          throw new NotFoundError("보드를 찾을 수 없습니다.");
        }

        // 템플릿 수정 권한 확인
        await TemplateService.validateEditPermissionById(
          userId,
          board.template_id
        );

        // 보드 복제
        const newBoardUuid = await BoardModel.copy(board.board_id, connection);

        // 생성된 보드 UUID 반환
        return newBoardUuid;
      }
    );
  }

  /**
   * 보드 이동
   * @param userId 사용자 id
   * @param boardUuid 보드 uuid
   * @param dayNumber 이동할 일차
   */
  static async moveBoard(userId: string, boardUuid: string, dayNumber: number) {
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 보드 조회
        const board = await BoardModel.findByUuid(boardUuid, connection);
        if (!board) {
          throw new NotFoundError("보드를 찾을 수 없습니다.");
        }

        // 템플릿 수정 권한 확인
        await TemplateService.validateEditPermissionById(
          userId,
          board.template_id
        );

        // 보드 이동
        await BoardModel.move(boardUuid, dayNumber, connection);

        // 보드 일차 재정렬
        await BoardModel.reorderBoards(board.template_id, connection);
      }
    );
  }

  /**
   * 보드 내 카드 정렬
   * @param userId 사용자 id
   * @param boardUuid 보드 uuid
   */
  static async sortCards(userId: string, boardUuid: string) {
    await TransactionHandler.executeInTransaction(
      dbPool,
      async (connection) => {
        // 보드 조회
        const board = await BoardModel.findByUuid(boardUuid, connection);
        if (!board) {
          throw new NotFoundError("보드를 찾을 수 없습니다.");
        }

        // 템플릿 수정 권한 확인
        await TemplateService.validateEditPermissionById(
          userId,
          board.template_id
        );

        // 보드 내 카드 정렬
        await BoardModel.sortCards(board.board_id, connection);
      }
    );
  }

  /**
   * 보드 객체 포맷팅
   * @param board 보드 객체
   * @returns 포맷팅된 보드 객체
   */
  static formatBoard(board: any) {
    return {
      uuid: board.board_uuid,
      dayNumber: board.day_number,
      createdAt: board.created_at,
      updatedAt: board.updated_at,
    };
  }
}

export default BoardService;
