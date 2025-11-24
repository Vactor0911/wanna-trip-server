import { dbPool } from "../config/db";
import UserModel from "../models/user.model";
import TransactionHandler from "../utils/transactionHandler";

class UserService {
  /**
   * 사용자 검색
   * @param keyword 검색 키워드
   * @returns 검색된 사용자 목록
   */
  static async searchUsers(keyword: string) {
    // 사용자 검색 결과
    let users: {
      user_uuid: string;
      email: string;
      name: string;
    }[] = [];

    // 이메일로 검색
    const emailResult = await UserModel.searchByEmail(keyword, dbPool);
    users = users.concat(emailResult);

    // 이름으로 검색
    const nameResult = await UserModel.searchByName(keyword, dbPool);
    users = users.concat(nameResult);

    // 중복 제거
    const uniqueUsers = Array.from(
      new Map(users.map((user) => [user["user_uuid"], user])).values()
    );

    // 결과 반환
    return uniqueUsers;
  }
}

export default UserService;
