import { Router } from "express";
import { getAllCards } from "../controllers/cards.controller";

const router = Router();

router.get("/", getAllCards);

export default router;