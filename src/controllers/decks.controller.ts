import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { prisma } from "../database"; // Assure-toi que c'est le bon chemin vers ton instance Prisma

export const deckController = {
  // POST /api/decks
  create: async (req: AuthRequest, res: Response) => {
    try {
      const { name, cards } = req.body;
      const userId = req.user?.userId;

      if (!name) return res.status(400).json({ error: "Name is required" });
      if (!cards || !Array.isArray(cards) || cards.length !== 10) {
        return res.status(400).json({ error: "A deck must have exactly 10 cards" });
      }

      // Vérifier si toutes les cartes existent
      const existingCards = await prisma.card.findMany({
        where: { id: { in: cards } }
      });

      if (existingCards.length !== 10) {
        return res.status(400).json({ error: "One or more card IDs are invalid" });
      }

      // Création du deck et des associations
      const newDeck = await prisma.deck.create({
        data: {
          name,
          userId: userId!,
          cards: {
            create: cards.map((cardId: number) => ({ cardId }))
          }
        },
        include: { cards: { include: { card: true } } }
      });

      res.status(201).json(newDeck);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // GET /api/decks/mine
  getMine: async (req: AuthRequest, res: Response) => {
    try {
      const decks = await prisma.deck.findMany({
        where: { userId: req.user?.userId },
        include: { cards: { include: { card: true } } }
      });
      res.json(decks);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // GET /api/decks/:id
  getOne: async (req: AuthRequest, res: Response) => {
    try {
      const deck = await prisma.deck.findFirst({
        where: { id: Number(req.params.id), userId: req.user?.userId },
        include: { cards: { include: { card: true } } }
      });

      if (!deck) return res.status(404).json({ error: "Deck not found" });
      res.json(deck);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // PATCH /api/decks/:id
  update: async (req: AuthRequest, res: Response) => {
    try {
      const { name, cards } = req.body;
      const deckId = Number(req.params.id);
      const userId = req.user?.userId;

      // Vérifier l'existence et la propriété
      const existingDeck = await prisma.deck.findFirst({
        where: { id: deckId, userId }
      });
      if (!existingDeck) return res.status(404).json({ error: "Deck not found" });

      if (cards) {
        if (!Array.isArray(cards) || cards.length !== 10) {
          return res.status(400).json({ error: "A deck must have exactly 10 cards" });
        }
        const validCards = await prisma.card.findMany({ where: { id: { in: cards } } });
        if (validCards.length !== 10) return res.status(400).json({ error: "Invalid card IDs" });
      }

      // Transaction : Supprimer les anciennes cartes et mettre à jour
      const updatedDeck = await prisma.$transaction(async (tx) => {
        if (cards) {
          await tx.deckCard.deleteMany({ where: { deckId } });
        }

        return tx.deck.update({
          where: { id: deckId },
          data: {
            name: name ?? undefined,
            cards: cards ? { create: cards.map((id: number) => ({ cardId: id })) } : undefined
          },
          include: { cards: { include: { card: true } } }
        });
      });

      res.json(updatedDeck);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },

  // DELETE /api/decks/:id
  delete: async (req: AuthRequest, res: Response) => {
    try {
      const deckId = Number(req.params.id);
      const deck = await prisma.deck.findFirst({
        where: { id: deckId, userId: req.user?.userId }
      });

      if (!deck) return res.status(404).json({ error: "Deck not found" });

      await prisma.deck.delete({ where: { id: deckId } });
      res.json({ message: "Deck deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
};