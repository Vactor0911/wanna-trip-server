import express from "express";
import { limiter } from "../utils";
import { authenticateToken } from "../middleware/authenticate";
import { validateBody, validateParams } from "../middleware/validation";
import {
  addCollaboratorSchema,
  getCollaboratorsSchema,
  removeCollaboratorSchema,
} from "../schema/collaborator.schema";
import CollaboratorController from "../controllers/collaborator.controller";

const collaboratorRoute = express.Router();

// 공동 작업자 목록 조회
collaboratorRoute.get(
  "/:templateUuid",
  limiter,
  authenticateToken,
  validateParams(getCollaboratorsSchema),
  CollaboratorController.getCollaborators
);

// 공동 작업자 추가
collaboratorRoute.post(
  "/",
  limiter,
  authenticateToken,
  validateBody(addCollaboratorSchema),
  CollaboratorController.addCollaborator
);

// 공동 작업자 제거
collaboratorRoute.delete(
  "/",
  limiter,
  authenticateToken,
  validateBody(removeCollaboratorSchema),
  CollaboratorController.removeCollaborator
);

export default collaboratorRoute;
