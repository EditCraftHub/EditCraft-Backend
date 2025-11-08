import express from "express";
import { getReportList, madeRepost } from "../../Controllers/userHelper/Helping.Controller.js";
import { authMiddleware } from "../../Middleware/authMiddleware.js";

export const ReportRouter = express.Router();
ReportRouter.post("/create-report",authMiddleware(["user"]), madeRepost);
ReportRouter.get("/get-reports",authMiddleware(["user"]), getReportList);