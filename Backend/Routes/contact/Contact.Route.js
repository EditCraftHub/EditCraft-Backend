import express from "express";
import { contactList, contactus } from "../../Controllers/userHelper/Contact.Controller.js";
import { authMiddleware } from "../../Middleware/authMiddleware.js";
export const ContactRouter = express.Router();

ContactRouter.post("/create-contact", contactus);
ContactRouter.get("/get-contacts", authMiddleware(["admin"]), contactList);