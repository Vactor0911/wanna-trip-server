class BoardSocket {
  /**
   * 보드 추가 이벤트 처리
   * @param socket 소켓 객체
   * @param boardUuid 보드 uuid
   * @param dayNumber 보드 일차
   */
  static async addBoard(socket: any, boardUuid: string, dayNumber: number) {
    try {
      const templateUuid = socket.data.templateUuid;
      const userUuid = socket.data.userUuid;

      // 보드 생성 메시지 전송
      socket.to(`template:${templateUuid}`).emit("board:add", {
        userUuid,
        boardUuid,
        dayNumber,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Board add error:", error);
      socket.emit("error", {
        message: "보드 추가 중 오류가 발생했습니다.",
      });
    }
  }

  /**
   * 보드 복제 이벤트 처리
   * @param socket 소켓 객체
   * @param boardUuid 복사할 보드 uuid
   * @param newBoardUuid 새 보드 uuid
   */
  static async copyBoard(socket: any, boardUuid: string, newBoardUuid: string) {
    try {
      const templateUuid = socket.data.templateUuid;
      const userUuid = socket.data.userUuid;

      // 보드 복제 메시지 전송
      socket.to(`template:${templateUuid}`).emit("board:copy", {
        userUuid,
        boardUuid,
        newBoardUuid,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Board copy error:", error);
      socket.emit("error", {
        message: "보드 복제 중 오류가 발생했습니다.",
      });
    }
  }

  /**
   * 보드 삭제 이벤트 처리
   * @param socket 소켓 객체
   * @param boardUuid 보드 uuid
   */
  static async deleteBoard(socket: any, boardUuid: string) {
    try {
      const templateUuid = socket.data.templateUuid;
      const userUuid = socket.data.userUuid;

      // 보드 삭제 메시지 전송
      socket.to(`template:${templateUuid}`).emit("board:delete", {
        userUuid,
        boardUuid,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Board delete error:", error);
      socket.emit("error", {
        message: "보드 삭제 중 오류가 발생했습니다.",
      });
    }
  }
}

export default BoardSocket;
