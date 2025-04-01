import express from "express";
import { csrfToken } from "../controllers/csrfController";

const csrfRoute = express.Router();

csrfRoute.get("/csrfToken", csrfToken);

export default csrfRoute;
