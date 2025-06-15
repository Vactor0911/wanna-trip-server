import { Request, Response } from "express";
import { dbPool } from "../config/db";

// 사용자별 템플릿 목록 조회
export const getUserTemplates = async (req: Request, res: Response) => {
  try {
    const userId = req.user.userId; // 인증 미들웨어에서 설정한 사용자 ID

    const templates = await dbPool.query(
      "SELECT * FROM template WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    res.status(200).json({
      success: true,
      templates,
    });
  } catch (err) {
    console.error("템플릿 목록 조회 오류:", err);
    res.status(500).json({
      success: false,
      message: "템플릿 목록을 불러오는 중 오류가 발생했습니다.",
    });
  }
};

// 새 템플릿 생성
export const createTemplate = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection(); // 커넥션 획득

  try {
    await connection.beginTransaction(); // 트랜잭션 시작

    const userId = req.user.userId;
    const { title } = req.body;

    if (!title) {
      await connection.rollback(); // 롤백 추가
      res.status(400).json({
        success: false,
        message: "템플릿 이름이 필요합니다.",
      });
      return;
    }

    // 새 템플릿 저장
    const result = await connection.query(
      "INSERT INTO template (user_id, title) VALUES (?, ?)",
      [userId, title]
    );

    const templateId = result.insertId;

    // 새로 생성된 템플릿의 UUID 조회
    const templates = await connection.query(
      "SELECT template_uuid FROM template WHERE template_id = ?",
      [templateId]
    );

    const templateUuid = templates[0].template_uuid;

    // 초기 보드 생성 (Day 1)
    await connection.query(
      "INSERT INTO board (template_id, day_number, template_uuid) VALUES (?, ?, ?)",
      [templateId, 1, templateUuid]
    );

    await connection.commit(); // 트랜잭션 커밋

    res.status(201).json({
      success: true,
      message: "템플릿이 성공적으로 생성되었습니다.",
    });
  } catch (err) {
    await connection.rollback(); // 오류 시 롤백
    console.error("템플릿 생성 오류:", err);
    res.status(500).json({
      success: false,
      message: "템플릿을 생성하는 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release(); // 커넥션 반환
  }
};

// UUID로 템플릿 조회 (프론트에서 URL 접근 시 사용)
export const getTemplateByUuid = async (req: Request, res: Response) => {
  try {
    const userId = req.user.userId;
    const { templateUuid } = req.params;

    // 템플릿 기본 정보 조회
    const templates = await dbPool.query(
      "SELECT * FROM template WHERE template_uuid = ? AND user_id = ?",
      [templateUuid, userId]
    );

    if (templates.length === 0) {
      res.status(404).json({
        success: false,
        message: "템플릿을 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    const template = templates[0];

    // 보드 정보 조회
    const boards = await dbPool.query(
      "SELECT * FROM board WHERE template_id = ? ORDER BY day_number",
      [template.template_id]
    );

    // 각 보드의 카드 정보 조회
    // 모든 보드 ID를 배열로 추출
    const boardIds = boards.map((board) => board.board_id);

    // 카드 조회 부분
    const cards = await dbPool.query(
      `SELECT * FROM card WHERE board_id IN (?) ORDER BY board_id, order_index`,
      [boardIds]
    );

    // 자바스크립트에서 카드를 보드별로 그룹화
    const cardsByBoardId = cards.reduce((acc, card) => {
      if (!acc[card.board_id]) {
        acc[card.board_id] = [];
      }
      acc[card.board_id].push(card);
      return acc;
    }, {});

    // 각 보드 객체에 카드 배열 할당 부분에 정렬 추가
    boards.forEach((board) => {
      board.cards = (cardsByBoardId[board.board_id] || []).sort(
        (a, b) => a.order_index - b.order_index
      );
    });

    // 템플릿에 보드 정보 추가
    template.boards = boards;

    res.status(200).json({
      success: true,
      template,
    });
  } catch (err) {
    console.error("UUID 템플릿 조회 오류:", err);
    res.status(500).json({
      success: false,
      message: "템플릿 정보를 불러오는 중 오류가 발생했습니다.",
    });
  }
};

// UUID로 템플릿 수정 (제목 변경)
export const updateTemplateByUuid = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection(); // 커넥션 획득

  try {
    await connection.beginTransaction(); // 트랜잭션 시작

    const userId = req.user.userId;
    const { templateUuid } = req.params;
    const { title } = req.body;

    // 템플릿 소유자 확인
    const templates = await connection.query(
      "SELECT * FROM template WHERE template_uuid = ? AND user_id = ?",
      [templateUuid, userId]
    );

    if (templates.length === 0) {
      await connection.rollback(); // 롤백 추가
      res.status(404).json({
        success: false,
        message: "템플릿을 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    // 템플릿 이름 업데이트
    await connection.query(
      "UPDATE template SET title = ?, updated_at = NOW() WHERE template_uuid = ?",
      [title, templateUuid]
    );

    await connection.commit(); // 트랜잭션 커밋

    res.status(200).json({
      success: true,
      message: "템플릿이 성공적으로 업데이트되었습니다.",
    });
  } catch (err) {
    await connection.rollback(); // 오류 시 롤백
    console.error("UUID로 템플릿 수정 오류:", err);
    res.status(500).json({
      success: false,
      message: "템플릿을 수정하는 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release(); // 커넥션 반환
  }
};

// 템플릿 삭제 (관련 보드와 카드도 모두 삭제)
export const deleteTemplate = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction(); // 트랜잭션 시작

    const userId = req.user.userId;
    const { templateId } = req.params;

    // 템플릿 소유자 확인
    const templates = await connection.query(
      "SELECT * FROM template WHERE template_id = ? AND user_id = ?",
      [templateId, userId]
    );

    if (templates.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "템플릿을 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    // 보드 ID 조회
    const boards = await connection.query(
      "SELECT board_id FROM board WHERE template_id = ?",
      [templateId]
    );

    // 각 보드에 속한 카드 삭제
    for (const board of boards) {
      await connection.query("DELETE FROM card WHERE board_id = ?", [
        board.board_id,
      ]);
    }

    // 보드 삭제
    await connection.query("DELETE FROM board WHERE template_id = ?", [
      templateId,
    ]);

    // 템플릿 삭제
    await connection.query("DELETE FROM template WHERE template_id = ?", [
      templateId,
    ]);

    await connection.commit(); // 트랜잭션 커밋

    res.status(200).json({
      success: true,
      message: "템플릿이 성공적으로 삭제되었습니다.",
    });
  } catch (err) {
    await connection.rollback(); // 오류 시 롤백
    console.error("템플릿 삭제 오류:", err);
    res.status(500).json({
      success: false,
      message: "템플릿을 삭제하는 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release(); // 커넥션 반환
  }
};

// 계정 연동 시 템플릿 병합
export const mergeTemplates = async (
  sourceUserId: number,
  targetUserId: number
): Promise<boolean> => {
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();

    // 소스 사용자의 템플릿을 타겟 사용자로 이전
    await connection.query(
      "UPDATE template SET user_id = ? WHERE user_id = ?",
      [targetUserId, sourceUserId]
    );

    await connection.commit();
    return true;
  } catch (err) {
    await connection.rollback();
    console.error("템플릿 병합 오류:", err);
    return false;
  } finally {
    connection.release();
  }
};
