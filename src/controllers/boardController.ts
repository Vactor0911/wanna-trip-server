import { Request, Response } from "express";
import { dbPool } from "../config/db";

// 새 보드 생성 (맨 뒤에 생성)
export const createBoard = async (req: Request, res: Response) => {
  try {
    const userId = req.user.userId;
    const { templateId } = req.params;
    const { title } = req.body;

    // 템플릿 소유자 확인
    const [templates] = await dbPool.query(
      "SELECT * FROM template WHERE template_id = ? AND user_id = ?",
      [templateId, userId]
    );

    if (templates.length === 0) {
      res.status(404).json({
        success: false,
        message: "템플릿을 찾을 수 없거나 접근 권한이 없습니다."
      });
      return;
    }

    // 현재 가장 큰 day_number 조회
    const [maxDayResult] = await dbPool.query(
      "SELECT MAX(day_number) as maxDay FROM board WHERE template_id = ?",
      [templateId]
    );
    
    const dayNumber = (maxDayResult[0].maxDay || 0) + 1;

    // 보드 고유 UUID 생성
    const boardUuid = require('crypto').randomUUID();

    // 새 보드 저장
    const [result] = await dbPool.query(
      "INSERT INTO board (template_id, board_uuid, day_number, title) VALUES (?, ?, ?, ?)",
      [templateId, boardUuid, dayNumber, title || `Day ${dayNumber}`]
    );

    res.status(201).json({
      success: true,
      message: "보드가 성공적으로 생성되었습니다.",
      boardId: result.insertId,
      boardUuid,
      dayNumber
    });
  } catch (err) {
    console.error("보드 생성 오류:", err);
    res.status(500).json({
      success: false,
      message: "보드를 생성하는 중 오류가 발생했습니다."
    });
  }
};

// 특정 보드 다음에 새 보드 생성
export const createBoardAfter = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection();
  
  try {
    await connection.beginTransaction();
    const userId = req.user.userId;
    const { boardId } = req.params;
    const { title } = req.body;
    
    // 기준 보드 조회 (소유자 확인)
    const [boards] = await connection.query(
      `SELECT b.*, t.template_id FROM board b
      JOIN template t ON b.template_id = t.template_id
      WHERE b.board_id = ? AND t.user_id = ?`,
      [boardId, userId]
    );

    if (boards.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "보드를 찾을 수 없거나 접근 권한이 없습니다."
      });
      return;
    }

    const referenceBoard = boards[0];
    const templateId = referenceBoard.template_id;
    const referenceDayNumber = referenceBoard.day_number;
    
    // 새 보드 뒤에 올 보드들의 day_number 증가
    await connection.query(
      "UPDATE board SET day_number = day_number + 1 WHERE template_id = ? AND day_number > ?",
      [templateId, referenceDayNumber]
    );
    
    // 새 보드 UUID 생성
    const boardUuid = require('crypto').randomUUID();
    const newDayNumber = referenceDayNumber + 1;
    
    // 새 보드 생성
    const [result] = await connection.query(
      "INSERT INTO board (template_id, board_uuid, day_number, title) VALUES (?, ?, ?, ?)",
      [templateId, boardUuid, newDayNumber, title || `Day ${newDayNumber}`]
    );
    
    await connection.commit();
    
    res.status(201).json({
      success: true,
      message: "보드가 성공적으로 생성되었습니다.",
      boardId: result.insertId,
      boardUuid
    });
  } catch (err) {
    await connection.rollback();
    console.error("보드 생성 오류:", err);
    res.status(500).json({
      success: false,
      message: "보드를 생성하는 중 오류가 발생했습니다."
    });
  } finally {
    connection.release();
  }
};

// 특정 보드 조회
export const getBoardDetail = async (req: Request, res: Response) => {
  try {
    const userId = req.user.userId;
    const { boardId } = req.params;

    // 보드 정보 조회 (템플릿 소유자 확인 포함)
    const boards = await dbPool.query(
      `SELECT b.* FROM board b
      JOIN template t ON b.template_id = t.template_id
      WHERE b.board_id = ? AND t.user_id = ?`,
      [boardId, userId]
    );

    if (boards.length === 0) {
      res.status(404).json({
        success: false,
        message: "보드를 찾을 수 없거나 접근 권한이 없습니다."
      });
      return;
    }

    const board = boards[0];

    // 보드에 속한 카드 조회
    const cards = await dbPool.query(
      "SELECT * FROM card WHERE board_id = ? ORDER BY order_index ASC",
      [boardId]
    );

    board.cards = cards;

    res.status(200).json({
      success: true,
      board
    });
  } catch (err) {
    console.error("보드 조회 오류:", err);
    res.status(500).json({
      success: false,
      message: "보드 정보를 불러오는 중 오류가 발생했습니다."
    });
  }
};

// 보드 수정
export const updateBoard = async (req: Request, res: Response) => {
  try {
    const userId = req.user.userId;
    const { boardId } = req.params;
    const { title, dayNumber } = req.body;

    // 보드 소유자 확인
    const boards = await dbPool.query(
      `SELECT b.* FROM board b
      JOIN template t ON b.template_id = t.template_id
      WHERE b.board_id = ? AND t.user_id = ?`,
      [boardId, userId]
    );

    if (boards.length === 0) {
      res.status(404).json({
        success: false,
        message: "보드를 찾을 수 없거나 접근 권한이 없습니다."
      });
      return;
    }

    // 보드 업데이트
    await dbPool.query(
      "UPDATE board SET title = ?, day_number = ? WHERE board_id = ?",
      [title, dayNumber, boardId]
    );

    res.status(200).json({
      success: true,
      message: "보드가 성공적으로 업데이트되었습니다."
    });
  } catch (err) {
    console.error("보드 수정 오류:", err);
    res.status(500).json({
      success: false,
      message: "보드를 수정하는 중 오류가 발생했습니다."
    });
  }
};

// 보드 삭제
export const deleteBoard = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();
    const userId = req.user.userId;
    const { boardId } = req.params;

    // 보드 소유자 확인
    const boards = await connection.query(
      `SELECT b.* FROM board b
      JOIN template t ON b.template_id = t.template_id
      WHERE b.board_id = ? AND t.user_id = ?`,
      [boardId, userId]
    );

    if (boards.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "보드를 찾을 수 없거나 접근 권한이 없습니다."
      });
      return;
    }

    // 보드에 속한 카드 삭제
    await connection.query("DELETE FROM card WHERE board_id = ?", [boardId]);

    // 보드 삭제
    await connection.query("DELETE FROM board WHERE board_id = ?", [boardId]);

    // 트랜잭션 커밋
    await connection.commit();

    res.status(200).json({
      success: true,
      message: "보드가 성공적으로 삭제되었습니다."
    });
  } catch (err) {
    await connection.rollback();
    console.error("보드 삭제 오류:", err);
    res.status(500).json({
      success: false,
      message: "보드를 삭제하는 중 오류가 발생했습니다."
    });
  } finally {
    connection.release();
  }
};

// 보드 순서 변경
export const reorderBoards = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();
    const userId = req.user.userId;
    const { templateId } = req.params;
    const { boardOrder } = req.body; // [{boardId: 1, dayNumber: 1}, {boardId: 2, dayNumber: 2}]

    // 템플릿 소유자 확인
    const templates = await connection.query(
      "SELECT * FROM template WHERE template_id = ? AND user_id = ?",
      [templateId, userId]
    );

    if (templates.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "템플릿을 찾을 수 없거나 접근 권한이 없습니다."
      });
      return;
    }

    // 각 보드의 순서(day_number) 업데이트
    for (const item of boardOrder) {
      await connection.query(
        "UPDATE board SET day_number = ? WHERE board_id = ? AND template_id = ?",
        [item.dayNumber, item.boardId, templateId]
      );
    }

    // 트랜잭션 커밋
    await connection.commit();

    res.status(200).json({
      success: true,
      message: "보드 순서가 성공적으로 업데이트되었습니다."
    });
  } catch (err) {
    await connection.rollback();
    console.error("보드 순서 변경 오류:", err);
    res.status(500).json({
      success: false,
      message: "보드 순서를 변경하는 중 오류가 발생했습니다."
    });
  } finally {
    connection.release();
  }
};

// 보드 복제 함수 업데이트 (바로 다음 위치에 복제)
export const duplicateBoard = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();
    const userId = req.user.userId;
    const { boardId } = req.params;
    const { newTitle } = req.body;

    // 원본 보드 조회 (소유자 확인)
    const [boards] = await connection.query(
      `SELECT b.* FROM board b
      JOIN template t ON b.template_id = t.template_id
      WHERE b.board_id = ? AND t.user_id = ?`,
      [boardId, userId]
    );

    if (boards.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "보드를 찾을 수 없거나 접근 권한이 없습니다."
      });
      return;
    }

    const originalBoard = boards[0];
    const originalDayNumber = originalBoard.day_number;
    
    // 복제된 보드 뒤에 올 보드들의 day_number 증가
    await connection.query(
      "UPDATE board SET day_number = day_number + 1 WHERE template_id = ? AND day_number > ?",
      [originalBoard.template_id, originalDayNumber]
    );
    
    const newBoardUuid = require('crypto').randomUUID();
    const newDayNumber = originalDayNumber + 1;
    
    // 새 보드 생성 (원본 바로 다음 위치)
    const [newBoardResult] = await connection.query(
      "INSERT INTO board (template_id, board_uuid, day_number, title) VALUES (?, ?, ?, ?)",
      [
        originalBoard.template_id, 
        newBoardUuid, 
        newDayNumber, 
        newTitle || `Copy of ${originalBoard.title}`
      ]
    );
    
    const newBoardId = newBoardResult.insertId;

    // 원본 보드의 카드 조회
    const [cards] = await connection.query(
      "SELECT * FROM card WHERE board_id = ?",
      [boardId]
    );

    // 카드 복제
    for (const card of cards) {
      const newCardUuid = require('crypto').randomUUID();
      await connection.query(
        "INSERT INTO card (board_id, card_uuid, title, content, start_time, end_time, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [newBoardId, newCardUuid, card.title, card.content, card.start_time, card.end_time, card.order_index]
      );
    }

    // 트랜잭션 커밋
    await connection.commit();

    res.status(201).json({
      success: true,
      message: "보드가 성공적으로 복제되었습니다.",
      newBoardId,
      newBoardUuid,
      dayNumber: newDayNumber
    });
  } catch (err) {
    await connection.rollback();
    console.error("보드 복제 오류:", err);
    res.status(500).json({
      success: false,
      message: "보드를 복제하는 중 오류가 발생했습니다."
    });
  } finally {
    connection.release();
  }
};