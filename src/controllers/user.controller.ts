import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import UserService from "../services/user.service";

class UserController {
  /**
   * 사용자 검색
   */
  static searchUsers = asyncHandler(async (req: Request, res: Response) => {
    const { keyword } = req.body;

    // 사용자 검색
    const users = await UserService.searchUsers(keyword);

    // 응답 반환
    res.status(200).json({
      success: true,
      message: "사용자 검색이 성공적으로 완료되었습니다.",
      users,
    });
  });
}

export default UserController;
