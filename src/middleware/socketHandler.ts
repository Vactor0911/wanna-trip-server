import jwt from "jsonwebtoken";
import { ExtendedError, Socket } from "socket.io";

export const socketHandler = async (
  socket: Socket,
  next: (err?: ExtendedError) => void
) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("인증 토큰이 필요합니다."));
    }

    // JWT 검증
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any;

    // 소켓에 사용자 정보 저장
    socket.data.userUuid = decoded.userUuid;
    socket.data.userName = decoded.name;

    next();
  } catch (error) {
    next(new Error("유효하지 않은 토큰입니다."));
  }
};
