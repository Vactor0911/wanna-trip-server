import { Pool, PoolConnection } from "mariadb";

class AuthModel {
  /**
   * 사용자 id로 사용자 조회
   * @param userId 사용자 id
   * @param connection 데이터베이스 연결 객체
   * @returns 조회된 사용자 정보
   */
  static async findById(userId: number, connection: PoolConnection | Pool) {
    const [user] = await connection.execute(
      `
        SELECT *
        FROM user
        WHERE user_id = ?
      `,
      [userId]
    );
    return user;
  }

  /**
   * 사용자 uuid로 사용자 조회
   * @param userUuid 사용자 uuid
   * @param connection 데이터베이스 연결 객체
   * @returns 조회된 사용자 정보
   */
  static async findByUuid(userUuid: string, connection: PoolConnection | Pool) {
    const [user] = await connection.execute(
      `
        SELECT *
        FROM user
        WHERE user_uuid = ?
      `,
      [userUuid]
    );
    return user;
  }
}

export default AuthModel;
