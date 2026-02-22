import { describe, it, expect, vi } from 'vitest'
import { deckController } from '../src/controllers/decks.controller'
import { prismaMock } from './vitest.setup'

describe('Deck Controller', () => {
  const makeRes = () =>
    ({
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }) as any

  // ─── getMine ───────────────────────────────────────────────
  describe('getMine', () => {
    it('should return user decks', async () => {
      prismaMock.deck.findMany.mockResolvedValue([
        { id: 1, name: 'Deck 1' },
      ] as any)
      const req = { user: { userId: 1 } } as any
      const res = makeRes()
      await deckController.getMine(req, res)
      expect(res.json).toHaveBeenCalled()
    })

    it('should return 500 on database error', async () => {
      prismaMock.deck.findMany.mockRejectedValue(new Error('DB'))
      const req = { user: { userId: 1 } } as any
      const res = makeRes()
      await deckController.getMine(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  // ─── getOne ────────────────────────────────────────────────
  describe('getOne', () => {
    it('should return a single deck', async () => {
      prismaMock.deck.findFirst.mockResolvedValue({
        id: 1,
        name: 'Deck 1',
      } as any)
      const req = { params: { id: '1' }, user: { userId: 1 } } as any
      const res = makeRes()
      await deckController.getOne(req, res)
      expect(res.json).toHaveBeenCalled()
    })

    it('should return 404 if deck not found', async () => {
      prismaMock.deck.findFirst.mockResolvedValue(null)
      const req = { params: { id: '999' }, user: { userId: 1 } } as any
      const res = makeRes()
      await deckController.getOne(req, res)
      expect(res.status).toHaveBeenCalledWith(404)
    })

    it('should return 500 on database error', async () => {
      prismaMock.deck.findFirst.mockRejectedValue(new Error('DB'))
      const req = { params: { id: '1' }, user: { userId: 1 } } as any
      const res = makeRes()
      await deckController.getOne(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  // ─── create ────────────────────────────────────────────────
  describe('create', () => {
    it('should create a deck successfully', async () => {
      prismaMock.card.findMany.mockResolvedValue(
        new Array(10).fill({ id: 1 }) as any,
      )
      prismaMock.deck.create.mockResolvedValue({ id: 1, name: 'OK' } as any)
      const req = {
        body: { name: 'OK', cards: new Array(10).fill(1) },
        user: { userId: 1 },
      } as any
      const res = makeRes()
      await deckController.create(req, res)
      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('should return 400 if name is missing', async () => {
      const req = {
        body: { cards: new Array(10).fill(1) },
        user: { userId: 1 },
      } as any
      const res = makeRes()
      await deckController.create(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if cards is not an array', async () => {
      const req = {
        body: { name: 'Fail', cards: 'notanarray' },
        user: { userId: 1 },
      } as any
      const res = makeRes()
      await deckController.create(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if cards count is not 10', async () => {
      const req = {
        body: { name: 'Fail', cards: [1, 2, 3] },
        user: { userId: 1 },
      } as any
      const res = makeRes()
      await deckController.create(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if some card IDs are invalid', async () => {
      prismaMock.card.findMany.mockResolvedValue(
        new Array(5).fill({ id: 1 }) as any,
      )
      const req = {
        body: { name: 'Bad', cards: new Array(10).fill(99) },
        user: { userId: 1 },
      } as any
      const res = makeRes()
      await deckController.create(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 500 on database error', async () => {
      prismaMock.card.findMany.mockRejectedValue(new Error('DB'))
      const req = {
        body: { name: 'OK', cards: new Array(10).fill(1) },
        user: { userId: 1 },
      } as any
      const res = makeRes()
      await deckController.create(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  // ─── update ────────────────────────────────────────────────
  describe('update', () => {
    it('should update name only (no cards)', async () => {
      prismaMock.deck.findFirst.mockResolvedValue({
        id: 1,
        userId: 1,
        name: 'Old',
      } as any)
      prismaMock.$transaction.mockResolvedValue({
        id: 1,
        name: 'NewName',
        userId: 1,
        cards: [],
      } as any)
      const req = {
        params: { id: '1' },
        body: { name: 'NewName' },
        user: { userId: 1 },
      } as any
      const res = makeRes()
      await deckController.update(req, res)
      expect(res.json).toHaveBeenCalled()
    })

    it('should update with cards successfully', async () => {
      prismaMock.deck.findFirst.mockResolvedValue({
        id: 1,
        userId: 1,
        name: 'Old',
      } as any)
      prismaMock.card.findMany.mockResolvedValue(
        new Array(10).fill({ id: 1 }) as any,
      )
      prismaMock.$transaction.mockResolvedValue({
        id: 1,
        name: 'Updated',
        userId: 1,
        cards: [],
      } as any)
      const req = {
        params: { id: '1' },
        body: { name: 'Updated', cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        user: { userId: 1 },
      } as any
      const res = makeRes()
      await deckController.update(req, res)
      expect(res.json).toHaveBeenCalled()
    })

    it('should return 404 if deck not found', async () => {
      prismaMock.deck.findFirst.mockResolvedValue(null)
      const req = { params: { id: '1' }, body: {}, user: { userId: 1 } } as any
      const res = makeRes()
      await deckController.update(req, res)
      expect(res.status).toHaveBeenCalledWith(404)
    })

    it('should return 400 if cards count is not 10', async () => {
      prismaMock.deck.findFirst.mockResolvedValue({
        id: 1,
        userId: 1,
        name: 'Old',
      } as any)
      const req = {
        params: { id: '1' },
        body: { cards: [1, 2, 3] },
        user: { userId: 1 },
      } as any
      const res = makeRes()
      await deckController.update(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if card IDs are invalid', async () => {
      prismaMock.deck.findFirst.mockResolvedValue({
        id: 1,
        userId: 1,
        name: 'Old',
      } as any)
      prismaMock.card.findMany.mockResolvedValue(
        new Array(5).fill({ id: 1 }) as any,
      )
      const req = {
        params: { id: '1' },
        body: { cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        user: { userId: 1 },
      } as any
      const res = makeRes()
      await deckController.update(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 500 on database error', async () => {
      prismaMock.deck.findFirst.mockRejectedValue(new Error('DB'))
      const req = { params: { id: '1' }, body: {}, user: { userId: 1 } } as any
      const res = makeRes()
      await deckController.update(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  // ─── delete ────────────────────────────────────────────────
  describe('delete', () => {
    it('should delete successfully', async () => {
      prismaMock.deck.findFirst.mockResolvedValue({ id: 1, userId: 1 } as any)
      prismaMock.deck.delete.mockResolvedValue({
        id: 1,
        name: 'Deleted',
      } as any)
      const req = { params: { id: '1' }, user: { userId: 1 } } as any
      const res = makeRes()
      await deckController.delete(req, res)
      expect(res.json).toHaveBeenCalledWith({
        message: 'Deck deleted successfully',
      })
    })

    it('should return 404 if deck not found', async () => {
      prismaMock.deck.findFirst.mockResolvedValue(null)
      const req = { params: { id: '1' }, user: { userId: 1 } } as any
      const res = makeRes()
      await deckController.delete(req, res)
      expect(res.status).toHaveBeenCalledWith(404)
    })

    it('should return 500 on database error', async () => {
      prismaMock.deck.findFirst.mockRejectedValue(new Error('DB'))
      const req = { params: { id: '1' }, user: { userId: 1 } } as any
      const res = makeRes()
      await deckController.delete(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
    })
  })
})
