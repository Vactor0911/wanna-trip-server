import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { clamp } from "../utils";

// 새 카드 생성
export const addCard = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection(); // DB 연결 가져오기

  try {
    await connection.beginTransaction(); // 트랜잭션 시작

    const userId = req.user.userId; // 요청한 사용자 ID
    const { boardId, index } = req.params; // URL 파라미터 (보드ID, 인덱스)
    const { content, startTime, endTime, isLocked } = req.body; // 카드 내용, 시작 시간, 종료 시간, 잠금 여부

    // 보드 소유자 확인
    const boards = await connection.query(
      `SELECT b.* FROM board b
      JOIN template t ON b.template_id = t.template_id
      WHERE b.board_id = ? AND t.user_id = ?`,
      [boardId, userId]
    );

    // 보드 접근 권한 없음
    if (boards.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "보드를 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    let orderIndex: number;

    // 해당 보드의 최대 order_index 조회
    const maxOrderResult = await connection.query(
      "SELECT COALESCE(MAX(order_index), -1) as maxOrder FROM card WHERE board_id = ?",
      [boardId]
    );

    // 인덱스가 주어진 경우
    if (index !== undefined) {
      // 인덱스를 정수로 캐스팅
      orderIndex = parseInt(index, 10);

      // 인덱스 범위 조정
      orderIndex = clamp(orderIndex, 0, maxOrderResult[0].maxOrder + 1);

      // 해당 인덱스 이후의 카드들의 order_index를 1씩 증가
      await connection.query(
        "UPDATE card SET order_index = order_index + 1 WHERE board_id = ? AND order_index >= ?",
        [boardId, orderIndex]
      );
    } else {
      // 최대 order_index + 1로 설정
      orderIndex = maxOrderResult[0].maxOrder + 1;
    }

    // 새 카드 저장 (지정된 위치에)
    const result = await connection.query(
      "INSERT INTO card (board_id, content, start_time, end_time, order_index, locked) VALUES (?, ?, ?, ?, ?, ?)",
      [boardId, content, startTime, endTime, orderIndex, isLocked]
    );

    await connection.commit(); // 트랜잭션 커밋

    // 성공 응답
    res.status(200).json({
      success: true,
      message: "카드가 성공적으로 생성되었습니다.",
      cardId: Number(result.insertId),
    });
    return;
  } catch (err) {
    await connection.rollback(); // 트랜잭션 롤백

    // 오류 로그 출력
    console.error("카드 생성 오류:", err);
    res.status(500).json({
      success: false,
      message: "카드를 생성하는 중 오류가 발생했습니다.",
    });
  } finally {
    connection.release(); // DB 연결 해제
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

export const moveCard = async (req: Request, res: Response) => {
  const connection = await dbPool.getConnection(); // DB 연결 가져오기

  try {
    await connection.beginTransaction(); // 트랜잭션 시작

    const userId = req.user.userId; // 요청한 사용자 ID
    const {
      sourceBoardId,
      sourceOrderIndex,
      destinationBoardId,
      destinationOrderIndex,
    } = req.body; // 원본 보드 ID, 원본 카드의 순서 인덱스, 대상 보드 ID, 대상 카드의 순서 인덱스

    // 보드 소유자 확인
    const boards = await connection.query(
      `SELECT b.* FROM board b
      JOIN template t ON b.template_id = t.template_id
      WHERE b.board_id = ? AND t.user_id = ?`,
      [sourceBoardId, userId]
    );

    // 보드 접근 권한 없음
    if (boards.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: "보드를 찾을 수 없거나 접근 권한이 없습니다.",
      });
      return;
    }

    // 같은 보드로 이동하는 경우
    if (sourceBoardId === destinationBoardId) {
      // 이동할 카드 order_index를 -1로 설정
      await connection.query(
        "UPDATE card SET order_index = -1 WHERE board_id = ? AND order_index = ?",
        [sourceBoardId, sourceOrderIndex]
      );

      // 카드 order_index 정렬
      if (sourceOrderIndex > destinationOrderIndex) {
        // 대상 카드 이후의 카드들의 order_index를 1씩 증가
        await connection.query(
          "UPDATE card SET order_index = order_index + 1 WHERE board_id = ? AND order_index >= ? AND order_index < ?",
          [destinationBoardId, destinationOrderIndex, sourceOrderIndex]
        );
      } else {
        // 대상 카드 이전의 카드들의 order_index를 1씩 감소
        await connection.query(
          "UPDATE card SET order_index = order_index - 1 WHERE board_id = ? AND order_index > ? AND order_index <= ?",
          [destinationBoardId, sourceOrderIndex, destinationOrderIndex]
        );
      }

      // 카드 order_index 업데이트
      await connection.query(
        "UPDATE card SET order_index = ? WHERE board_id = ? AND order_index < 0",
        [destinationOrderIndex, sourceBoardId]
      );
    } else {
      // 다른 보드로 이동하는 경우
      // 대상 보드에서 해당 위치 이후의 카드들의 order_index를 1씩 증가
      await connection.query(
        "UPDATE card SET order_index = order_index + 1 WHERE board_id = ? AND order_index >= ?",
        [destinationBoardId, destinationOrderIndex]
      );

      // 대상 보드에서 해당 위치에 카드 삽입
      const result = await connection.query(
        `INSERT INTO card (board_id, content, start_time, end_time, order_index, locked)
         SELECT ?, content, start_time, end_time, ?, locked
         FROM card
         WHERE board_id = ? AND order_index = ?`,
        [
          destinationBoardId,
          destinationOrderIndex,
          sourceBoardId,
          sourceOrderIndex,
        ]
      );

      // 원본 보드에서 해당 카드 삭제
      await connection.query(
        "DELETE FROM card WHERE board_id = ? AND order_index = ?",
        [sourceBoardId, sourceOrderIndex]
      );

      // 원본 보드에서 해당 카드 이후의 카드들의 order_index를 1씩 감소
      await connection.query(
        "UPDATE card SET order_index = order_index - 1 WHERE board_id = ? AND order_index > ?",
        [sourceBoardId, sourceOrderIndex]
      );
    }

    await connection.commit(); // 트랜잭션 커밋

    res.status(200).json({
      success: true,
      message: "카드가 성공적으로 이동되었습니다.",
    });
  } catch (err) {
    await connection.rollback();
    console.error("카드 이동 오류:", err);
    res.status(500).json({
      success: false,
      message: "카드를 이동하는 중 오류가 발생했습니다.",
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
