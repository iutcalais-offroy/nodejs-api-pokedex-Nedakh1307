import { Router } from "express";
import { deckController } from "../controllers/decks.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Toutes les routes de ce fichier seront protégées
router.use(authMiddleware);

router.post("/decks", deckController.create);
router.get("/decks/mine", deckController.getMine);
router.get("/decks/:id", deckController.getOne);
router.patch("/decks/:id", deckController.update);
router.delete("/decks/:id", deckController.delete);

export default router;