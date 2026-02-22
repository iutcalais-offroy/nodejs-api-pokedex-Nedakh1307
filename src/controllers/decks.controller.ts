import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { prisma } from '../database'

export const deckController = {
  create: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, cards } = req.body
      const userId = req.user?.userId

      if (!name) {
        res.status(400).json({ error: 'Name is required' })
        return
      }
      if (!cards || !Array.isArray(cards) || cards.length !== 10) {
        res.status(400).json({ error: 'A deck must have exactly 10 cards' })
        return
      }

      const existingCards = await prisma.card.findMany({
        where: { id: { in: cards } },
      })
      if (existingCards.length !== 10) {
        res.status(400).json({ error: 'One or more card IDs are invalid' })
        return
      }

      const newDeck = await prisma.deck.create({
        data: {
          name,
          userId: userId!,
          cards: { create: cards.map((cardId: number) => ({ cardId })) },
        },
        include: { cards: { include: { card: true } } },
      })

      res.status(201).json(newDeck)
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  },

  getMine: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const decks = await prisma.deck.findMany({
        where: { userId: req.user?.userId },
        include: { cards: { include: { card: true } } },
      })
      res.json(decks)
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  },

  getOne: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const deck = await prisma.deck.findFirst({
        where: { id: Number(req.params.id), userId: req.user?.userId },
        include: { cards: { include: { card: true } } },
      })
      if (!deck) {
        res.status(404).json({ error: 'Deck not found' })
        return
      }
      res.json(deck)
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  },

  update: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, cards } = req.body
      const deckId = Number(req.params.id)
      const userId = req.user?.userId

      const existingDeck = await prisma.deck.findFirst({
        where: { id: deckId, userId },
      })
      if (!existingDeck) {
        res.status(404).json({ error: 'Deck not found' })
        return
      }

      if (cards) {
        if (!Array.isArray(cards) || cards.length !== 10) {
          res.status(400).json({ error: 'A deck must have exactly 10 cards' })
          return
        }
        const validCards = await prisma.card.findMany({
          where: { id: { in: cards } },
        })
        if (validCards.length !== 10) {
          res.status(400).json({ error: 'Invalid card IDs' })
          return
        }
      }

      const updatedDeck = await prisma.$transaction(async (tx) => {
        if (cards) {
          await tx.deckCard.deleteMany({ where: { deckId } })
        }
        return tx.deck.update({
          where: { id: deckId },
          data: {
            name: name ?? undefined,
            cards: cards
              ? { create: cards.map((id: number) => ({ cardId: id })) }
              : undefined,
          },
          include: { cards: { include: { card: true } } },
        })
      })

      res.json(updatedDeck)
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  },

  delete: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const deckId = Number(req.params.id)
      const deck = await prisma.deck.findFirst({
        where: { id: deckId, userId: req.user?.userId },
      })
      if (!deck) {
        res.status(404).json({ error: 'Deck not found' })
        return
      }
      await prisma.deck.delete({ where: { id: deckId } })
      res.json({ message: 'Deck deleted successfully' })
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  },
}
