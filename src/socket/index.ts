import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { socketHandler } from "../middleware/socketHandler";
import UserSocket from "./user.socket";
import TemplateSocket from "./template.socket";
import CardSocket from "./card.socket";
import NotificationSocket from "./notification.socket";

// Socket.io 서버 인스턴스
let io: Server;

// 사용자 정보 인터페이스
interface SocketUser {
  userUuid: string;
  socketId: string;
  templateUuid: string;
  userName: string;
  profileImage: string;
}

// 템플릿별 활성 사용자 관리
const activeUsers = new Map<string, SocketUser[]>();

/**
 * Socket.io 서버 초기화
 * @param httpServer Express HTTP 서버
 */
export const initializeSocketServer = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin:
        process.env.NODE_ENV === "production"
          ? "https://vactor0911.github.io"
          : "http://localhost:8080",
      credentials: true,
    },
    // 연결 설정
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // 인증 미들웨어
  io.use(socketHandler);

  // 소켓 연결 처리
  io.on("connection", (socket: Socket) => {
    /**
     * 연결 이벤트
     */

    // 알림 Room 연결 (로그인된 사용자)
    NotificationSocket.joinNotificationRoom(socket);

    // 템플릿 Room 연결
    socket.on("template:join", (data: { templateUuid: string }) => {
      TemplateSocket.joinTemplate(socket, data.templateUuid);
    });

    // 활성 사용자 목록 요청
    socket.on("users:list", () => {
      UserSocket.getUserList(socket);
    });

    //템플릿 Room 퇴장
    socket.on("template:leave", () => {
      const templateUuid = socket.data.templateUuid;
      if (!templateUuid) {
        return;
      }

      handleUserLeave(socket, templateUuid);
    });

    // 소켓 연결 해제
    socket.on("disconnect", () => {
      // 알림 Room 퇴장
      NotificationSocket.leaveNotificationRoom(socket);

      const templateUuid = socket.data.templateUuid;
      if (templateUuid) {
        handleUserLeave(socket, templateUuid);
      }
    });

    // 템플릿 패치 요청
    socket.on("template:fetch", () => {
      TemplateSocket.fetchTemplate(socket);
    });

    // 카드 편집 시작 이벤트
    socket.on("card:editing:start", (data: { cardUuid: string }) =>
      CardSocket.lockCard(socket, data.cardUuid)
    );

    // 카드 편집 종료 이벤트
    socket.on("card:editing:end", (data: { cardUuid: string }) =>
      CardSocket.unlockCard(socket, data.cardUuid)
    );
  });

  return io;
};

/**
 * 활성 사용자 추가
 */
export const addActiveUser = (templateUuid: string, user: SocketUser) => {
  const users = activeUsers.get(templateUuid) || [];

  // 기존 사용자 제거 (중복 방지)
  const filteredUsers = users.filter((u) => u.userUuid !== user.userUuid);

  // 새 사용자 추가
  filteredUsers.push(user);
  activeUsers.set(templateUuid, filteredUsers);
};

/**
 * 활성 사용자 제거
 * @param templateUuid 템플릿 uuid
 * @param socketId 소켓 id
 */
const removeActiveUser = (templateUuid: string, socketId: string) => {
  const users = activeUsers.get(templateUuid) || [];
  const filteredUsers = users.filter((u) => u.socketId !== socketId);

  if (filteredUsers.length === 0) {
    activeUsers.delete(templateUuid);
  } else {
    activeUsers.set(templateUuid, filteredUsers);
  }
};

/**
 * 활성 사용자 목록 조회
 * @param templateUuid 템플릿 uuid
 * @returns 활성 사용자 목록
 */
export const getActiveUsers = (templateUuid: string): SocketUser[] => {
  return activeUsers.get(templateUuid) || [];
};

/**
 * 사용자 퇴장 처리
 * @param socket 소켓 객체
 * @param templateUuid 템플릿 uuid
 */
const handleUserLeave = (socket: Socket, templateUuid: string) => {
  // 활성 사용자 목록 조회
  const users = getActiveUsers(templateUuid);

  // 퇴장하는 사용자가 목록에 있는지 확인
  const user = users.find((u) => u.socketId === socket.id);
  if (!user) {
    return;
  }

  // Room 퇴장
  socket.leave(`template:${templateUuid}`);

  // 활성 사용자 목록에서 제거
  removeActiveUser(templateUuid, socket.id);

  // 다른 사용자들에게 퇴장 알림
  socket.to(`template:${templateUuid}`).emit("user:left", {
    userId: socket.data.userId,
    userName: socket.data.userName,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Socket.io 인스턴스 가져오기
 */
export const getSocketIO = () => {
  if (!io) {
    throw new Error("Socket.io가 초기화되지 않았습니다.");
  }
  return io;
};
