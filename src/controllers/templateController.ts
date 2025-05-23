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
  try {
    const userId = req.user.userId;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: "템플릿 이름이 필요합니다.",
      });
      return;
    }

    // 새 템플릿 저장
    const result = await dbPool.query(
      "INSERT INTO template (user_id, name) VALUES (?, ?)",
      [userId, name]
    );

    const templateId = result.insertId;

    // 초기 보드 생성 (Day 1)
    await dbPool.query(
      "INSERT INTO board (template_id, day_number) VALUES (?, ?)",
      [templateId, 1]
    );

    res.status(201).json({
      success: true,
      message: "템플릿이 성공적으로 생성되었습니다.",
    });
  } catch (err) {
    console.error("템플릿 생성 오류:", err);
    res.status(500).json({
      success: false,
      message: "템플릿을 생성하는 중 오류가 발생했습니다.",
    });
  }
};

//TODO: 회원가입 시 기본 템플릿 생성해줄지 선택해야함.
// 회원가입 시 기본 템플릿 생성
// export const createDefaultTemplate = async (
//   userId: number
// ): Promise<number> => {
//   try {
//     // 새 템플릿 저장
//     const result = await dbPool.query(
//       "INSERT INTO template (user_id, name) VALUES (?, ?)",
//       [userId, "나의 첫 번째 여행"]
//     );

//     const templateId = result.insertId;

//     // 초기 보드 생성 (Day 1)
//     await dbPool.query(
//       "INSERT INTO board (template_id, day_number) VALUES (?, ?)",
//       [templateId, 1]
//     );

//     return templateId;
//   } catch (err) {
//     console.error("기본 템플릿 생성 오류:", err);
//     throw err;
//   }
// };

// 특정 템플릿 상세 조회 (보드와 카드 포함)
export const getTemplateDetail = async (req: Request, res: Response) => {
  try {
    const userId = req.user.userId;
    const { templateId } = req.params;

    // 템플릿 기본 정보 조회
    const templates = await dbPool.query(
      "SELECT * FROM template WHERE template_id = ? AND user_id = ?",
      [templateId, userId]
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
      [templateId]
    );

    // 각 보드의 카드 정보 조회
    for (let board of boards) {
      const cards = await dbPool.query(
        "SELECT * FROM card WHERE board_id = ? ORDER BY start_time",
        [board.board_id]
      );
      board.cards = cards;
    }

    template.boards = boards;

    res.status(200).json({
      success: true,
      template,
    });
  } catch (err) {
    console.error("템플릿 상세 조회 오류:", err);
    res.status(500).json({
      success: false,
      message: "템플릿 정보를 불러오는 중 오류가 발생했습니다.",
    });
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

// 템플릿 수정
export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const userId = req.user.userId;
    const { templateId } = req.params;
    const { name } = req.body;

    // 템플릿 소유자 확인
    const templates = await dbPool.query(
      "SELECT * FROM template WHERE template_id = ? AND user_id = ?",
      [templateId, userId]
    );

    if (templates.length === 0) {
      res.status(404).json({
        success: false,
        message: "템플릿을 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    // 템플릿 이름 업데이트
    await dbPool.query(
      "UPDATE template SET name = ?, updated_at = NOW() WHERE template_id = ?",
      [name, templateId]
    );

    res.status(200).json({
      success: true,
      message: "템플릿이 성공적으로 업데이트되었습니다.",
    });
  } catch (err) {
    console.error("템플릿 수정 오류:", err);
    res.status(500).json({
      success: false,
      message: "템플릿을 수정하는 중 오류가 발생했습니다.",
    });
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
