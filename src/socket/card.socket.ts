import { Socket } from "socket.io";

class CardSocket {
  /**
   * 카드 편집중 상태 등록
   * @param socket 소켓 객체
   * @param cardUuid 카드 uuid
   * @returns
   */
  static async lockCard(socket: Socket, cardUuid: string) {
    const templateUuid = socket.data.templateUuid;
    if (!templateUuid) {
      return;
    }

    const userUuid = socket.data.userUuid;
    const userName = socket.data.userName;

    socket.to(`template:${templateUuid}`).emit("card:editing:started", {
      cardUuid,
      userUuid,
      userName,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 카드 편집중 상태 해제
   * @param socket 소켓 객체
   * @param cardUuid 카드 uuid
   * @returns
   */
  static async unlockCard(socket: Socket, cardUuid: string) {
    const templateUuid = socket.data.templateUuid;
    if (!templateUuid) {
      return;
    }

    const userUuid = socket.data.userUuid;

    socket.to(`template:${templateUuid}`).emit("card:editing:ended", {
      cardUuid,
      userUuid,
      timestamp: new Date().toISOString(),
    });
  }
}

export default CardSocket;
