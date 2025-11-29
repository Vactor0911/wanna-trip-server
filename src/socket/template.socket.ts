import { Socket } from "socket.io";
import UserModel from "../models/user.model";
import { dbPool } from "../config/db";
import TemplateService from "../services/template.service";
import { addActiveUser, getActiveUsers } from ".";

class TemplateSocket {
  /**
   * 템플릿 Room 입장
   * @param socket 소켓 객체
   * @param templateUuid 템플릿 uuid
   */
  static async joinTemplate(socket: Socket, templateUuid: string) {
    try {
      const userUuid = socket.data.userUuid;

      // 사용자 조회
      const user = await UserModel.findByUuid(userUuid, dbPool);
      if (!user) {
        socket.emit("error", {
          message: "사용자를 찾을 수 없습니다.",
        });
        return;
      }

      // 템플릿 편집 권한 확인
      try {
        await TemplateService.validateEditPermissionByUuid(
          user.user_id,
          templateUuid
        );
      } catch {
        socket.emit("error", {
          message: "템플릿 접근 권한이 없습니다.",
        });
        return;
      }

      // Room 입장
      socket.join(`template:${templateUuid}`);
      socket.data.templateUuid = templateUuid;

      // 활성 사용자 목록에 추가
      addActiveUser(templateUuid, {
        userUuid: userUuid,
        socketId: socket.id,
        templateUuid,
        userName: socket.data.userName,
        profileImage: user.profile_image,
      });

      // 다른 사용자들에게 새 사용자 입장 알림
      socket.to(`template:${templateUuid}`).emit("user:joined", {
        userUuid,
        userName: socket.data.userName,
        timestamp: new Date().toISOString(),
      });

      // 현재 활성 사용자 목록 전송
      const users = getActiveUsers(templateUuid);
      socket.emit("users:list", {
        users: users.map((u) => ({
          userUuid: u.userUuid,
          userName: u.userName,
          profileImage: u.profileImage,
        })),
      });
    } catch (error) {
      console.error("Template join error:", error);
      socket.emit("error", {
        message: "템플릿 입장 중 오류가 발생했습니다.",
      });
    }
  }

  /**
   * 템플릿 패치 알림 전송
   * @param socket 소켓 객체
   */
  static async fetchTemplate(socket: Socket) {
    try {
      const templateUuid = socket.data.templateUuid;
      const userUuid = socket.data.userUuid;

      // 템플릿 수정 메시지 전송
      socket.to(`template:${templateUuid}`).emit("template:fetch", {
        userUuid,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Template fetch error:", error);
      socket.emit("error", {
        message: "템플릿 패치 중 오류가 발생했습니다.",
      });
    }
  }
}

export default TemplateSocket;
