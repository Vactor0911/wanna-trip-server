class BoardSocket {
  static async addBoard(socket: any, boardUuid: string, dayNumber: number) {
    try {
      const templateUuid = socket.data.templateUuid;
      const userUuid = socket.data.userUuid;

      // 템플릿 수정 메시지 전송
      socket.to(`template:${templateUuid}`).emit("board:add", {
        userUuid,
        boardUuid,
        dayNumber,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Template update error:", error);
      socket.emit("error", {
        message: "템플릿 수정 중 오류가 발생했습니다.",
      });
    }
  }
}

export default BoardSocket;
