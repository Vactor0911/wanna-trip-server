import { Request, Response } from "express";
import { dbPool } from "../config/db";

// 새 카드 생성
export const createCard = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();
    const userId = req.user.userId;
    const { boardId } = req.params;
    const { content, startTime, endTime, locked } = req.body;

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
        message: "보드를 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    // 해당 보드의 최대 order_index 조회하여 그 다음 번호로 설정
    const maxOrderResult = await connection.query(
      "SELECT COALESCE(MAX(order_index), -1) as maxOrder FROM card WHERE board_id = ?",
      [boardId]
    );
    const orderIndex = maxOrderResult[0].maxOrder + 1;

    // 새 카드 저장 (맨 마지막 위치에)
    const result = await connection.query(
      "INSERT INTO card (board_id, content, start_time, end_time, order_index, locked) VALUES (?, ?, ?, ?, ?, ?)",
      [boardId, content, startTime, endTime, orderIndex, locked]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "카드가 성공적으로 생성되었습니다.",
      cardId: Number(result.insertId),
    });
  } catch (err) {
    await connection.rollback();
    console.error("카드 생성 오류:", err);
    res.status(500).json({
      success: false,
      message: "카드를 생성하는 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release();
  }
};

// 카드 수정 (텍스트 에디터 내용 업데이트 포함)
export const updateCard = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();
    const userId = req.user.userId;
    const { cardId } = req.params;
    const { content, startTime, endTime, orderIndex, locked } = req.body;
    const isOrderIndexSpecified = orderIndex !== undefined;

    // 카드 소유자 확인 및 기존 정보 조회
    const cards = await connection.query(
      `SELECT c.* FROM card c
      JOIN board b ON c.board_id = b.board_id
      JOIN template t ON b.template_id = t.template_id
      WHERE c.card_id = ? AND t.user_id = ?`,
      [cardId, userId]
    );

    if (cards.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "카드를 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    const originalCard = cards[0];

    // order_index가 명시적으로 제공되고, 기존 값과 다른 경우만 순서 변경
    if (isOrderIndexSpecified && orderIndex !== originalCard.order_index) {
      const oldIndex = originalCard.order_index;
      const newIndex = orderIndex;

      if (newIndex > oldIndex) {
        // 뒤로 이동: 사이에 있는 카드들을 앞으로 이동
        await connection.query(
          "UPDATE card SET order_index = order_index - 1 WHERE board_id = ? AND order_index > ? AND order_index <= ?",
          [originalCard.board_id, oldIndex, newIndex]
        );
      } else {
        // 앞으로 이동: 사이에 있는 카드들을 뒤로 이동
        await connection.query(
          "UPDATE card SET order_index = order_index + 1 WHERE board_id = ? AND order_index >= ? AND order_index < ?",
          [originalCard.board_id, newIndex, oldIndex]
        );
      }
    }

    // 카드 업데이트 - 명시적으로 제공된 값만 사용
    const updateQuery = "UPDATE card SET ";
    const updateParams: any[] = []; // 타입 지정
    const updateFields: string[] = []; // 타입 지정

    if (content !== undefined) {
      updateFields.push("content = ?");
      updateParams.push(content);
    }

    if (startTime !== undefined) {
      updateFields.push("start_time = ?");
      updateParams.push(startTime);
    }

    if (endTime !== undefined) {
      updateFields.push("end_time = ?");
      updateParams.push(endTime);
    }

    if (isOrderIndexSpecified) {
      updateFields.push("order_index = ?");
      updateParams.push(orderIndex);
    }

    if (locked !== undefined) {
      updateFields.push("locked = ?");
      updateParams.push(locked);
    }

    updateParams.push(cardId);

    if (updateFields.length > 0) {
      await connection.query(
        updateQuery + updateFields.join(", ") + " WHERE card_id = ?",
        updateParams
      );
    }

    await connection.commit();

    res.status(200).json({
      success: true,
      message: "카드가 성공적으로 업데이트되었습니다.",
    });
  } catch (err) {
    await connection.rollback();
    console.error("카드 수정 오류:", err);
    res.status(500).json({
      success: false,
      message: "카드를 수정하는 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release();
  }
};

// 카드 복제
export const duplicateCard = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();
    const userId = req.user.userId;
    const { cardId } = req.params;

    // 원본 카드 조회 (소유자 확인 포함)
    const cards = await connection.query(
      `SELECT c.* FROM card c
      JOIN board b ON c.board_id = b.board_id
      JOIN template t ON b.template_id = t.template_id
      WHERE c.card_id = ? AND t.user_id = ?`,
      [cardId, userId]
    );

    if (cards.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "카드를 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    const originalCard = cards[0];
    const newOrderIndex = originalCard.order_index + 1;

    // 복제할 위치 이후의 모든 카드들의 order_index를 1씩 증가
    await connection.query(
      "UPDATE card SET order_index = order_index + 1 WHERE board_id = ? AND order_index >= ?",
      [originalCard.board_id, newOrderIndex]
    );

    // 새 카드 생성 (원본 카드 바로 다음 위치에)
    const result = await connection.query(
      "INSERT INTO card (board_id, content, start_time, end_time, order_index, locked) VALUES (?, ?, ?, ?, ?, ?)",
      [
        originalCard.board_id,
        originalCard.content,
        originalCard.start_time,
        originalCard.end_time,
        newOrderIndex,
        originalCard.locked,
      ]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "카드가 성공적으로 복제되었습니다.",
      cardId: Number(result.insertId),
    });
  } catch (err) {
    await connection.rollback();
    console.error("카드 복제 오류:", err);
    res.status(500).json({
      success: false,
      message: "카드를 복제하는 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release();
  }
};

// 카드 삭제
export const deleteCard = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();
    const userId = req.user.userId;
    const { cardId } = req.params;

    // 카드 소유자 확인 및 정보 조회
    const cards = await connection.query(
      `SELECT c.* FROM card c
      JOIN board b ON c.board_id = b.board_id
      JOIN template t ON b.template_id = t.template_id
      WHERE c.card_id = ? AND t.user_id = ?`,
      [cardId, userId]
    );

    if (cards.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "카드를 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    const cardToDelete = cards[0];

    // 카드 삭제
    await connection.query("DELETE FROM card WHERE card_id = ?", [cardId]);

    // 삭제된 카드 이후의 모든 카드들의 order_index를 1씩 감소
    await connection.query(
      "UPDATE card SET order_index = order_index - 1 WHERE board_id = ? AND order_index > ?",
      [cardToDelete.board_id, cardToDelete.order_index]
    );

    await connection.commit();

    res.status(200).json({
      success: true,
      message: "카드가 성공적으로 삭제되었습니다.",
    });
  } catch (err) {
    await connection.rollback();
    console.error("카드 삭제 오류:", err);
    res.status(500).json({
      success: false,
      message: "카드를 삭제하는 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release();
  }
};

// // 특정 카드 조회
// export const getCard = async (req: Request, res: Response) => {
//   try {
//     const userId = req.user.userId;
//     const { cardId } = req.params;

//     // 카드 정보 조회 (소유자 확인 포함)
//     const cards = await dbPool.query(
//       `SELECT c.* FROM card c
//       JOIN board b ON c.board_id = b.board_id
//       JOIN template t ON b.template_id = t.template_id
//       WHERE c.card_id = ? AND t.user_id = ?`,
//       [cardId, userId]
//     );

//     if (cards.length === 0) {
//       res.status(404).json({
//         success: false,
//         message: "카드를 찾을 수 없거나 접근 권한이 없습니다."
//       });
//       return;
//     }

//     res.status(200).json({
//       success: true,
//       card: cards[0]
//     });
//   } catch (err) {
//     console.error("카드 조회 오류:", err);
//     res.status(500).json({
//       success: false,
//       message: "카드 정보를 불러오는 중 오류가 발생했습니다."
//     });
//   }
// };

// // 카드 순서 변경
// export const reorderCards = async (req: Request, res: Response) => {
//   const connection = await dbPool.getConnection();

//   try {
//     await connection.beginTransaction();
//     const userId = req.user.userId;
//     const { boardId } = req.params;
//     const { cardOrder } = req.body; // [{cardId: 1, orderIndex: 0}, {cardId: 2, orderIndex: 1}]

//     // 보드 소유자 확인
//     const boards = await connection.query(
//       `SELECT b.* FROM board b
//       JOIN template t ON b.template_id = t.template_id
//       WHERE b.board_id = ? AND t.user_id = ?`,
//       [boardId, userId]
//     );

//     if (boards.length === 0) {
//       await connection.rollback();
//       res.status(404).json({
//         success: false,
//         message: "보드를 찾을 수 없거나 접근 권한이 없습니다."
//       });
//       return;
//     }

//     // 각 카드의 순서 업데이트
//     for (const item of cardOrder) {
//       await connection.query(
//         "UPDATE card SET order_index = ? WHERE card_id = ? AND board_id = ?",
//         [item.orderIndex, item.cardId, boardId]
//       );
//     }

//     // 트랜잭션 커밋
//     await connection.commit();

//     res.status(200).json({
//       success: true,
//       message: "카드 순서가 성공적으로 업데이트되었습니다."
//     });
//   } catch (err) {
//     await connection.rollback();
//     console.error("카드 순서 변경 오류:", err);
//     res.status(500).json({
//       success: false,
//       message: "카드 순서를 변경하는 중 오류가 발생했습니다."
//     });
//   } finally {
//     connection.release();
//   }
// };

// // 카드 이동
// export const moveCard = async (req: Request, res: Response) => {
//   try {
//     const userId = req.user.userId;
//     const { cardId } = req.params;
//     const { targetBoardId, newOrderIndex } = req.body;

//     // 카드 소유자 확인
//     const [cards] = await dbPool.query(
//       `SELECT c.* FROM card c
//       JOIN board b ON c.board_id = b.board_id
//       JOIN template t ON b.template_id = t.template_id
//       WHERE c.card_id = ? AND t.user_id = ?`,
//       [cardId, userId]
//     );

//     if (cards.length === 0) {
//       res.status(404).json({
//         success: false,
//         message: "카드를 찾을 수 없거나 접근 권한이 없습니다."
//       });
//       return;
//     }

//     // 대상 보드 소유자 확인
//     const [targetBoards] = await dbPool.query(
//       `SELECT b.* FROM board b
//       JOIN template t ON b.template_id = t.template_id
//       WHERE b.board_id = ? AND t.user_id = ?`,
//       [targetBoardId, userId]
//     );

//     if (targetBoards.length === 0) {
//       res.status(404).json({
//         success: false,
//         message: "대상 보드를 찾을 수 없거나 접근 권한이 없습니다."
//       });
//       return;
//     }

//     // 카드 이동
//     await dbPool.query(
//       "UPDATE card SET board_id = ?, order_index = ? WHERE card_id = ?",
//       [targetBoardId, newOrderIndex, cardId]
//     );

//     res.status(200).json({
//       success: true,
//       message: "카드가 성공적으로 이동되었습니다."
//     });
//   } catch (err) {
//     console.error("카드 이동 오류:", err);
//     res.status(500).json({
//       success: false,
//       message: "카드를 이동하는 중 오류가 발생했습니다."
//     });
//   }
// };

// // 카드 검색
// export const searchCards = async (req: Request, res: Response) => {
//   try {
//     const userId = req.user.userId;
//     const { templateId } = req.params;
//     const { keyword } = req.query;

//     // 템플릿 소유자 확인
//     const [templates] = await dbPool.query(
//       "SELECT * FROM template WHERE template_id = ? AND user_id = ?",
//       [templateId, userId]
//     );

//     if (templates.length === 0) {
//       res.status(404).json({
//         success: false,
//         message: "템플릿을 찾을 수 없거나 접근 권한이 없습니다."
//       });
//       return;
//     }

//     // 키워드로 카드 검색 (제목과 내용에서)
//     const [cards] = await dbPool.query(
//       `SELECT c.*, b.title as board_title, b.day_number
//       FROM card c
//       JOIN board b ON c.board_id = b.board_id
//       WHERE b.template_id = ? AND (c.title LIKE ? OR c.content LIKE ?)
//       ORDER BY b.day_number ASC, c.order_index ASC`,
//       [templateId, `%${keyword}%`, `%${keyword}%`]
//     );

//     res.status(200).json({
//       success: true,
//       cards
//     });
//   } catch (err) {
//     console.error("카드 검색 오류:", err);
//     res.status(500).json({
//       success: false,
//       message: "카드를 검색하는 중 오류가 발생했습니다."
//     });
//   }
// };
