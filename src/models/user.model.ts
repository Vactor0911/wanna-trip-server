import { Pool, PoolConnection } from "mariadb";

class UserModel {
  /**
   * 사용자 id로 사용자 조회
   * @param userId 사용자 id
   * @param connection 데이터베이스 연결 객체
   * @returns
   */
  static async findById(userId: string, connection: PoolConnection | Pool) {
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
   * @returns
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

  /**
   * 이메일로 사용자 검색
   * @param email 이메일
   * @param connection 데이터베이스 연결 객체
   * @returns
   */
  static async searchByEmail(email: string, connection: PoolConnection | Pool) {
    const users = await connection.execute(
      `
        SELECT user_uuid, email, name, profile_image
        FROM user
        WHERE email LIKE ? AND state = 'active'
      `,
      [`%${email}%`]
    );
    return users;
  }

  /**
   * 닉네임으로 사용자 검색
   * @param name 닉네임
   * @param connection 데이터베이스 연결 객체
   * @returns
   */
  static async searchByName(name: string, connection: PoolConnection | Pool) {
    const users = await connection.execute(
      `
        SELECT user_uuid, email, name, profile_image
        FROM user
        WHERE name LIKE ? AND state = 'active'
      `,
      [`%${name}%`]
    );
    return users;
  }
}

export default UserModel;
