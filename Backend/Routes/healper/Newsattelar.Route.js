import express from "express";
import { newSattelar } from "../../Controllers/userHelper/NewSattelar.Controller.js";
import { authMiddleware } from "../../Middleware/authMiddleware.js";

export const NewSattelarRouter = express.Router();
NewSattelarRouter.post('/create-newsattelar',newSattelar)
NewSattelarRouter.get('/get-newsattelars',authMiddleware(["admin"]),newSattelar)