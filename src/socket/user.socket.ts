import { Socket } from "socket.io";
import { getActiveUsers } from ".";

class UserSocket {
  /**
   * 활성 사용자 목록 조회
   * @param socket 소켓 객체
   * @returns 활성 사용자 목록
   */
  static async getUserList(socket: Socket) {
    const templateUuid = socket.data.templateUuid;
    if (!templateUuid) {
      return;
    }

    const users = getActiveUsers(templateUuid);
    socket.emit("users:list", {
      users: users.map((u) => ({
        userUuid: u.userUuid,
        userName: u.userName,
        profileImage: u.profileImage,
      })),
    });
  }
}

export default UserSocket;

