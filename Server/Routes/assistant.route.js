import express from "express"
import { askAssistant, getAssistantConfig } from "../Controllers/assistant.controller.js"
import { isAuth } from "../Middleware/isAuth.js"


const assistantRouter = express.Router()

assistantRouter.get("/config/:userId" , getAssistantConfig)
assistantRouter.post("/ask", isAuth, askAssistant)

export default assistantRouter