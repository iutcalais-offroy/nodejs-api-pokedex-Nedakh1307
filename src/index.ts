import { fileURLToPath } from 'url'
import { createServer } from 'http'
import { env } from './env'
import express from 'express'
import { Server } from 'socket.io' 
import cors from 'cors'
import jwt from 'jsonwebtoken'
import authRoutes from './routes/auth.routes'
import { authMiddleware, AuthRequest } from './middlewares/auth.middleware'
import decksRoutes from './routes/decks.routes'
import cardsRoutes from './routes/cards.routes' 
import { setupSwagger } from './docs/index'

// Create Express app
export const app = express()

// Middlewares
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
)

// Middleware pour parser le JSON
app.use(express.json())

setupSwagger(app)

// Routes
app.use('/api', cardsRoutes)
app.use('/api/auth', authRoutes)
app.use('/api', decksRoutes)
app.use(express.static('public'))

// Route de test protégée pour valider le middleware
app.get('/api/me', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  res.json({ user: req.user })
})

// Serve static files (Socket.io test client)
app.use(express.static('public'))

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'TCG Backend Server is running' })
})

// Start server only if this file is run directly (not imported for tests)
// @ts-ignore
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Create HTTP server
  const httpServer = createServer(app)

  // Initialisation de Socket.io (Indispensable pour le Ticket 5)
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  })

  // Socket.io JWT authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token

    if (!token) {
      return next(new Error('No token provided'))
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: number; email: string }

      if (!decoded.userId || !decoded.email) {
        return next(new Error('Invalid token payload'))
      }

      socket.data.userId = decoded.userId
      socket.data.email = decoded.email

      next()
    } catch {
      next(new Error('Invalid or expired token'))
    }
  })

  // Log de test pour confirmer la connexion
  io.on('connection', (socket) => {
    console.log(`✅ Client connecté au Socket: ${socket.id} | user: ${socket.data.email}`)

    // GET_ROOMS
    socket.on('getRooms', () => {
      const rooms = [...io.sockets.adapter.rooms.entries()]
        .filter(([key]) => !io.sockets.sockets.has(key))
        .map(([key, value]) => ({ id: key, players: value.size }))
      socket.emit('roomsList', rooms)
    })

    // CREATE_ROOM
    socket.on('createRoom', ({ deckId }: { deckId: string }) => {
      const roomId = `room-${Date.now()}`
      socket.join(roomId)
      socket.data.deckId = deckId
      socket.emit('roomCreated', { roomId })
      io.emit('roomsList', [...io.sockets.adapter.rooms.entries()]
        .filter(([key]) => !io.sockets.sockets.has(key))
        .map(([key, value]) => ({ id: key, players: value.size })))
    })

    // JOIN_ROOM
    socket.on('joinRoom', ({ roomId, deckId }: { roomId: string; deckId: string }) => {
      const room = io.sockets.adapter.rooms.get(roomId)
      if (!room) {
        socket.emit('error', { message: 'Room not found' })
        return
      }
      socket.join(roomId)
      socket.data.deckId = deckId
      socket.emit('roomJoined', { roomId })
      io.to(roomId).emit('gameState', {
        roomId,
        players: [...room].map((id) => ({
          id,
          userId: io.sockets.sockets.get(id)?.data.userId,
          email: io.sockets.sockets.get(id)?.data.email,
        })),
      })
    })

    // DRAW_CARDS
    socket.on('drawCards', ({ roomId }: { roomId: string }) => {
      const hand = Array.from({ length: 5 }, (_, i) => ({ cardIndex: i }))
      socket.emit('cardsDrawn', { hand })
      io.to(roomId).emit('gameState', { roomId, action: 'drawCards', player: socket.data.email })
    })

    // PLAY_CARD
    socket.on('playCard', ({ roomId, cardIndex }: { roomId: string; cardIndex: number }) => {
      io.to(roomId).emit('cardPlayed', { player: socket.data.email, cardIndex })
      io.to(roomId).emit('gameState', { roomId, action: 'playCard', player: socket.data.email, cardIndex })
    })

    // ATTACK
    socket.on('attack', ({ roomId }: { roomId: string }) => {
      io.to(roomId).emit('attacked', { player: socket.data.email })
      io.to(roomId).emit('gameState', { roomId, action: 'attack', player: socket.data.email })
    })

    // END_TURN
    socket.on('endTurn', ({ roomId }: { roomId: string }) => {
      io.to(roomId).emit('turnEnded', { player: socket.data.email })
      io.to(roomId).emit('gameState', { roomId, action: 'endTurn', player: socket.data.email })
    })

    socket.on('disconnect', () => {
      console.log(`❌ Client déconnecté: ${socket.id}`)
    })
  })

  // Start server
  try {
    httpServer.listen(env.PORT, () => {
      console.log(`\n🚀 Server is running on http://localhost:${env.PORT}`)
      console.log(
        `🧪 Socket.io Test Client available at http://localhost:${env.PORT}`,
      )
      console.log(`📄 Swagger UI available at http://localhost:${env.PORT}/api-docs`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}
