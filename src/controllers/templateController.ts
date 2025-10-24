import { Request, Response } from "express";
import { TemplateSerice } from "../services/template.service";
import z from "zod";
import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";
import { BoardService } from "../services/board.service";

// 사용자별 템플릿 목록 조회
export const getUserTemplates = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id; // 인증 미들웨어에서 설정한 사용자 ID

    // 사용자의 템플릿 목록 조회
    const templates = await TemplateSerice.getTemplateByUserId(userId);

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
const createTemplateSchema = z.object({
  title: z.string().min(1, "템플릿 이름이 필요합니다."),
});
export const createTemplate = async (req: Request, res: Response) => {
  const userId = req.user.userId;

  // 요청 데이터 검증
  const parsed = createTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.message,
    });
  }

  // 검증된 데이터 추출
  const { title } = parsed.data;

  // DB 커넥션 획득
  const connection = await dbPool.getConnection();

  try {
    // 트랜잭션 시작
    await connection.beginTransaction();

    // 새 템플릿 uuid 생성
    const templateUuid = uuidv4();

    // 새 템플릿 저장
    const result = await TemplateSerice.createTemplate(
      { userId, title, templateUuid },
      connection
    );
    const templateId = result.insertId;

    // 1일차 초기 보드 생성
    await BoardService.createBoard({ templateId, dayNumber: 1 }, connection);

    // 트랜잭션 커밋
    await connection.commit();

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
    // 커넥션 반환
    connection.release();
  }
};

// UUID로 템플릿 조회 (프론트에서 URL 접근 시 사용)
export const getTemplateByUuid = async (req: Request, res: Response) => {
  try {
    const userId = req.user.userId;
    const { templateUuid } = req.params;

    // "AND user_id = ?" 조건 제거 - 다른 사용자의 템플릿도 조회 가능하게
    const templates = await dbPool.query(
      "SELECT * FROM template WHERE template_uuid = ?",
      [templateUuid]
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
      `
  SELECT c.*, l.title AS location_title, l.thumbnail_url AS location_thumbnail_url, l.latitude, l.longitude, l.address, l.category
  FROM card c 
  LEFT JOIN location l ON c.card_id = l.card_id 
  WHERE c.board_id IN (?) 
  ORDER BY c.board_id, c.order_index
  `,
      [boardIds]
    );

    // 자바스크립트에서 카드를 보드별로 그룹화
    const cardsByBoardId = cards.reduce((acc, card) => {
      if (!acc[card.board_id]) {
        acc[card.board_id] = [];
      }

      // 위치 정보가 있으면 location 객체 생성
      if (card.location_title) {
        card.location = {
          title: card.location_title,
          address: card.address,
          latitude: card.latitude,
          longitude: card.longitude,
          category: card.category,
          thumbnail_url: card.location_thumbnail_url,
        };
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
      isOwner: template.user_id === userId, // 소유자 여부 정보 추가
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

// 인기 템플릿 조회 (공유 수 기준 상위 3개)
export const getPopularTemplates = async (req: Request, res: Response) => {
  try {
    // 공유 수 기준으로 상위 3개 템플릿 조회
    const templates = await dbPool.query(
      `SELECT t.template_id, t.template_uuid, t.title, t.shared_count, u.name AS username 
       FROM template t
       JOIN user u ON t.user_id = u.user_id
       ORDER BY t.shared_count DESC 
       LIMIT 3`
    );

    // 프론트엔드에서 필요한 형식으로 변환
    const formattedTemplates = templates.map((template) => ({
      uuid: template.template_uuid,
      title: template.title,
      username: template.username,
      shared_count: template.shared_count,
    }));

    res.status(200).json({
      success: true,
      templates: formattedTemplates,
    });
  } catch (err) {
    console.error("인기 템플릿 조회 오류:", err);
    res.status(500).json({
      success: false,
      message: "인기 템플릿을 불러오는 중 오류가 발생했습니다.",
    });
  }
};

// 템플릿 내 모든 보드의 카드 정렬
export const sortTemplateCards = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection(); // 커넥션 획득

  try {
    await connection.beginTransaction(); // 트랜잭션 시작

    const userId = req.user.userId;
    const { templateUuid } = req.params;
    const { sortBy } = req.body; // 정렬 기준 (start_time, end_time)

    // 정렬 기준 검증
    const validSortOptions = ["start_time", "end_time"];
    if (!validSortOptions.includes(sortBy)) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message:
          "유효하지 않은 정렬 기준입니다. 'start_time', 'end_time' 중 하나를 사용하세요.",
      });
      return;
    }

    // 템플릿 소유자 확인 및 template_id 조회
    const templates = await connection.query(
      "SELECT template_id FROM template WHERE template_uuid = ? AND user_id = ?",
      [templateUuid, userId]
    );

    if (templates.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "템플릿을 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    const templateId = templates[0].template_id;

    // 해당 템플릿의 모든 보드 가져오기
    const boards = await connection.query(
      "SELECT board_id FROM board WHERE template_id = ? ORDER BY day_number",
      [templateId]
    );

    // 각 보드별로 카드 정렬
    for (const board of boards) {
      const boardId = board.board_id;

      // 해당 보드의 모든 카드 가져오기
      let cards;
      if (sortBy === "start_time") {
        cards = await connection.query(
          "SELECT card_id, start_time FROM card WHERE board_id = ? ORDER BY start_time",
          [boardId]
        );
      } else if (sortBy === "end_time") {
        cards = await connection.query(
          "SELECT card_id, end_time FROM card WHERE board_id = ? ORDER BY end_time",
          [boardId]
        );
      }

      // 카드 순서 업데이트
      for (let i = 0; i < cards.length; i++) {
        await connection.query(
          "UPDATE card SET order_index = ? WHERE card_id = ?",
          [i, cards[i].card_id]
        );
      }
    }

    await connection.commit(); // 트랜잭션 커밋

    res.status(200).json({
      success: true,
      message: "카드가 성공적으로 정렬되었습니다.",
    });
  } catch (err) {
    await connection.rollback(); // 오류 시 롤백
    console.error("카드 정렬 오류:", err);
    res.status(500).json({
      success: false,
      message: "카드를 정렬하는 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release(); // 커넥션 반환
  }
};
