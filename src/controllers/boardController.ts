import { Request, Response } from "express";
import { dbPool } from "../config/db";

// 새 보드 생성 (맨 뒤에 생성)
export const createBoard = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection(); // 커넥션 획득

  try {
    await connection.beginTransaction(); // 트랜잭션 시작

    const userId = req.user.userId;
    const { templateUuid } = req.params;

    // 템플릿 소유자 확인 및 template_id 조회
    const templates = await connection.query(
      "SELECT template_id FROM template WHERE template_uuid = ? AND user_id = ?",
      [templateUuid, userId]
    );

    if (!templates || templates.length === 0) {
      await connection.rollback(); // 롤백 추가
      res.status(404).json({
        success: false,
        message: "템플릿을 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    const templateId = templates[0].template_id;

    // 현재 가장 큰 day_number 조회
    const maxDayResult = await connection.query(
      "SELECT MAX(day_number) as maxDay FROM board WHERE template_id = ?",
      [templateId]
    );

    const dayNumber = (maxDayResult[0].maxDay || 0) + 1;

    // 새 보드 저장 (template_id와 template_uuid 둘 다 저장)
    const result = await connection.query(
      "INSERT INTO board (template_id, template_uuid, day_number) VALUES (?, ?, ?)",
      [templateId, templateUuid, dayNumber]
    );

    await connection.commit(); // 트랜잭션 커밋

    res.status(201).json({
      success: true,
      message: "보드가 성공적으로 생성되었습니다.",
      boardId: Number(result.insertId),
      dayNumber,
    });
  } catch (err) {
    await connection.rollback(); // 오류 시 롤백
    console.error("보드 생성 오류:", err);
    res.status(500).json({
      success: false,
      message: "보드를 생성하는 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release(); // 커넥션 반환
  }
};

// 특정 보드 다음에 새 보드 생성
export const createBoardAfter = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();
    const userId = req.user.userId;
    const { boardId } = req.params;

    // 원본 보드 조회 (소유자 확인)
    const boards = await connection.query(
      `SELECT b.*
      FROM board b
      JOIN template t ON b.template_id = t.template_id
      WHERE b.board_id = ? AND t.user_id = ?`,
      [boardId, userId]
    );

    if (boards.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "보드를 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    const referenceBoard = boards[0];
    const templateId = referenceBoard.template_id;
    const templateUuid = referenceBoard.template_uuid;
    const referenceDayNumber = referenceBoard.day_number;

    // 새 보드 뒤에 올 보드들의 day_number 증가
    await connection.query(
      "UPDATE board SET day_number = day_number + 1 WHERE template_id = ? AND day_number > ?",
      [templateId, referenceDayNumber]
    );

    const newDayNumber = referenceDayNumber + 1;

    // 새 보드 생성 (template_uuid 포함)
    const result = await connection.query(
      "INSERT INTO board (template_id, template_uuid, day_number) VALUES (?, ?, ?)",
      [templateId, templateUuid, newDayNumber]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "보드가 성공적으로 생성되었습니다.",
      boardId: Number(result.insertId),
      dayNumber: newDayNumber,
    });
  } catch (err) {
    await connection.rollback();
    console.error("보드 생성 오류:", err);
    res.status(500).json({
      success: false,
      message: "보드를 생성하는 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release();
  }
};

// 보드 삭제
export const deleteBoard = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();
    const userId = req.user.userId;
    const { boardId } = req.params;

    // 원본 보드 조회 (소유자 확인)
    const boards = await connection.query(
      `SELECT b.* 
      FROM board b
      JOIN template t ON b.template_id = t.template_id
      WHERE b.board_id = ? AND t.user_id = ?`,
      [boardId, userId]
    );

    if (boards.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "보드를 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    const board = boards[0];
    const templateId = board.template_id;
    const dayNumber = board.day_number;

    // 보드에 속한 카드 삭제
    await connection.query("DELETE FROM card WHERE board_id = ?", [boardId]);

    // 보드 삭제
    await connection.query("DELETE FROM board WHERE board_id = ?", [boardId]);

    // 삭제된 보드보다 날짜가 큰 보드들의 day_number 감소
    await connection.query(
      "UPDATE board SET day_number = day_number - 1 WHERE template_id = ? AND day_number > ?",
      [templateId, dayNumber]
    );

    // 트랜잭션 커밋
    await connection.commit();

    res.status(200).json({
      success: true,
      message: "보드가 성공적으로 삭제되었습니다.",
    });
  } catch (err) {
    await connection.rollback();
    console.error("보드 삭제 오류:", err);
    res.status(500).json({
      success: false,
      message: "보드를 삭제하는 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release();
  }
};

// 보드의 모든 카드 삭제 (보드는 유지)
export const clearBoard = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection(); // 커넥션 획득

  try {
    await connection.beginTransaction(); // 트랜잭션 시작

    const userId = req.user.userId;
    const { boardId } = req.params;

    // 보드 소유자 확인
    const boards = await connection.query(
      `SELECT b.* 
      FROM board b
      JOIN template t ON b.template_id = t.template_id
      WHERE b.board_id = ? AND t.user_id = ?`,
      [boardId, userId]
    );

    if (boards.length === 0) {
      await connection.rollback(); // 롤백 추가
      res.status(404).json({
        success: false,
        message: "보드를 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    // 보드에 속한 모든 카드 삭제
    await connection.query("DELETE FROM card WHERE board_id = ?", [boardId]);

    await connection.commit(); // 트랜잭션 커밋

    res.status(200).json({
      success: true,
      message: "보드의 모든 카드가 성공적으로 삭제되었습니다.",
    });
  } catch (err) {
    await connection.rollback(); // 오류 시 롤백
    console.error("보드 카드 삭제 오류:", err);
    res.status(500).json({
      success: false,
      message: "보드의 카드를 삭제하는 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release(); // 커넥션 반환
  }
};

// 보드 복제 함수 (바로 다음 위치에 복제)
export const duplicateBoard = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();
    const userId = req.user.userId;
    const { boardId } = req.params;

    // 원본 보드 조회 (소유자 확인)
    const boards = await connection.query(
      `SELECT b.*
      FROM board b
      JOIN template t ON b.template_id = t.template_id
      WHERE b.board_id = ? AND t.user_id = ?`,
      [boardId, userId]
    );

    if (boards.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "보드를 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    const originalBoard = boards[0];
    const originalDayNumber = originalBoard.day_number;
    const templateId = originalBoard.template_id;
    const templateUuid = originalBoard.template_uuid;

    // 복제된 보드 뒤에 올 보드들의 day_number 증가
    await connection.query(
      "UPDATE board SET day_number = day_number + 1 WHERE template_id = ? AND day_number > ?",
      [templateId, originalDayNumber]
    );

    const newDayNumber = originalDayNumber + 1;

    // 새 보드 생성 (원본 바로 다음 위치)
    const newBoardResult = await connection.query(
      "INSERT INTO board (template_id, template_uuid, day_number) VALUES (?, ?, ?)",
      [templateId, templateUuid, newDayNumber]
    );

    const newBoardId = newBoardResult.insertId;

    // 원본 보드의 카드 조회 (order_index 순으로 정렬)
    const cards = await connection.query(
      "SELECT * FROM card WHERE board_id = ? ORDER BY order_index ASC",
      [boardId]
    );

    // 카드 복제 (순서대로 0부터 재할당)
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      await connection.query(
        "INSERT INTO card (board_id, content, start_time, end_time, order_index, locked) VALUES (?, ?, ?, ?, ?, ?)",
        [
          newBoardId,
          card.content,
          card.start_time,
          card.end_time,
          i, // 순서대로 0, 1, 2, 3... 재할당
          card.locked,
        ]
      );
    }

    // 트랜잭션 커밋
    await connection.commit();

    res.status(201).json({
      success: true,
      message: "보드가 성공적으로 복제되었습니다.",
      newBoardId: Number(newBoardId),
      dayNumber: newDayNumber,
    });
  } catch (err) {
    await connection.rollback();
    console.error("보드 복제 오류:", err);
    res.status(500).json({
      success: false,
      message: "보드를 복제하는 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release();
  }
};

// 보드 이동 함수
export const moveBoard = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection(); // DB 연결 가져오기

  try {
    await connection.beginTransaction(); // 트랜잭션 시작

    const userId = req.user.userId; // 요청한 사용자 ID
    const { templateUuid, sourceDay, destinationDay } =
      req.body; // 원본 보드의 인덱스, 대상 보드의 인덱스

    // 보드 소유자 확인
    const boards = await connection.query(
      `SELECT b.* FROM board b
      JOIN template t ON b.template_id = t.template_id
      WHERE b.day_number IN (?, ?) AND t.user_id = ? AND t.template_uuid = ?`,
      [sourceDay, destinationDay, userId, templateUuid]
    );

    // 보드 접근 권한 없음
    if (boards.length !== 2) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "보드를 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    // 이동할 보드 day_number를 -1로 설정
    await connection.query(
      "UPDATE board SET day_number = -1 WHERE template_uuid = ? AND day_number = ?",
      [templateUuid, sourceDay]
    );

    // 보드 day_number 정렬
    if (sourceDay > destinationDay) {
      // 대상 보드 이후의 보드들의 day_number를 1씩 증가
      await connection.query(
        "UPDATE board SET day_number = day_number + 1 WHERE template_uuid = ? AND day_number >= ? AND day_number < ?",
        [templateUuid, destinationDay, sourceDay]
      );
    } else {
      // 대상 보드 이전의 보드들의 day_number를 1씩 감소
      await connection.query(
        "UPDATE board SET day_number = day_number - 1 WHERE template_uuid = ? AND day_number > ? AND day_number <= ?",
        [templateUuid, sourceDay, destinationDay]
      );
    }

    // 보드 day_number 업데이트
    await connection.query(
      "UPDATE board SET day_number = ? WHERE template_uuid = ? AND day_number < 0",
      [destinationDay, templateUuid]
    );

    await connection.commit(); // 트랜잭션 커밋

    res.status(200).json({
      success: true,
      message: "보드가 성공적으로 이동되었습니다.",
    });
  } catch (err) {
    await connection.rollback();
    console.error("보드 이동 오류:", err);
    res.status(500).json({
      success: false,
      message: "보드를 이동하는 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release();
  }
};
