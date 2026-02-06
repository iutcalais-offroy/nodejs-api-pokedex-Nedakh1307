import { Router } from "express";
import { getAllCards } from "../controllers/cards.controller";

const router = Router();

// Endpoint public pour toutes les cartes
router.get("/cards", getAllCards);

export default router;
