import { describe, it, expect, vi } from 'vitest'
import * as authController from '../src/controllers/auth.controller'
import { prismaMock } from './vitest.setup'
import bcrypt from 'bcryptjs'

describe('Auth Controller', () => {
  describe('register', () => {
    it('should register a new user successfully', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)
      prismaMock.user.create.mockResolvedValue({
        id: '1',
        email: 't@t.com',
        username: 'u',
        password: 'hashed',
      } as any)
      const req = {
        body: { email: 't@t.com', username: 'u', password: 'password123' },
      } as any
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any
      await authController.register(req, res)
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ token: expect.any(String) }),
      )
    })

    it('should return 400 if email is missing', async () => {
      const req = {
        body: { email: '', username: 'u', password: 'password123' },
      } as any
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any
      await authController.register(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if password is too short', async () => {
      const req = {
        body: { email: 't@t.com', username: 'u', password: '12' },
      } as any
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any
      await authController.register(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if user already exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: '1' } as any)
      const req = {
        body: { email: 't@t.com', username: 'u', password: 'password123' },
      } as any
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any
      await authController.register(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 500 on database crash', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('DB'))
      const req = {
        body: { email: 'a@a.com', username: 'u', password: 'password123' },
      } as any
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any
      await authController.register(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('login', () => {
    it('should login successfully', async () => {
      const hashedPassword = await bcrypt.hash('pass123', 10)
      prismaMock.user.findUnique.mockResolvedValue({
        id: '1',
        email: 't@t.com',
        username: 'u',
        password: hashedPassword,
      } as any)
      const req = { body: { email: 't@t.com', password: 'pass123' } } as any
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any
      await authController.login(req, res)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ token: expect.any(String) }),
      )
    })

    it('should return 400 if email is missing', async () => {
      const req = { body: { email: '', password: 'pass' } } as any
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any
      await authController.login(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if password is missing', async () => {
      const req = { body: { email: 't@t.com', password: '' } } as any
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any
      await authController.login(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)
      const req = { body: { email: 'wrong@t.com', password: 'pass123' } } as any
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any
      await authController.login(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 if password is wrong', async () => {
      const hashed = await bcrypt.hash('realpassword', 10)
      prismaMock.user.findUnique.mockResolvedValue({
        id: '1',
        email: 't@t.com',
        username: 'u',
        password: hashed,
      } as any)
      const req = {
        body: { email: 't@t.com', password: 'wrongpassword' },
      } as any
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any
      await authController.login(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 500 on database crash', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('DB'))
      const req = { body: { email: 't@t.com', password: 'pass123' } } as any
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any
      await authController.login(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
    })
  })
})
