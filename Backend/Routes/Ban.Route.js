import express from 'express'
import { banUser, unbanUser } from '../Controllers/Ban.Controller.js'
import { authMiddleware } from '../Middleware/authMiddleware.js'

export const BanRouter = express.Router()

BanRouter.put('/ban/:id',authMiddleware(["admin","super_admin"]),banUser)
BanRouter.put('/unban/:id',authMiddleware(["admin","super_admin"]),unbanUser)