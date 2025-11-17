import { Pool, PoolConnection } from "mariadb";

class TransactionHandler {
  /**
   * 트랜잭션 실행 래퍼
   * @param pool 데이터베이스 풀
   * @param callback 트랜잭션 내에서 실행할 콜백 함수
   * @returns 콜백 함수 반환 값
   */
  static async executeInTransaction<T>(
    pool: Pool,
    callback: (connection: PoolConnection) => Promise<T>
  ): Promise<T> {
    const connection = await pool.getConnection();

    try {
      // 트랜잭션 시작
      await connection.beginTransaction();

      // 콜백 실행
      const result = await callback(connection);

      // 트랜잭션 커밋
      await connection.commit();
      return result;
    } catch (error) {
      // 트랜잭션 롤백
      await connection.rollback();
      throw error;
    } finally {
      // 커넥션 반환
      connection.release();
    }
  }
}

export default TransactionHandler;
