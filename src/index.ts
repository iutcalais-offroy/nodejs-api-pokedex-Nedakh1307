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
import { prisma } from './database'

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

// Stockage des rooms en mémoire
const waitingRooms = new Map<string, {
  roomId: string
  hostSocketId: string
  hostUserId: number
  hostEmail: string
  hostUsername: string
  hostDeckId: number
  hostDeck: object[]
}>()

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

    // GET_ROOMS - Retourne uniquement les rooms en attente
    socket.on('getRooms', () => {
      const rooms = [...waitingRooms.values()].map((room) => ({
        roomId: room.roomId,
        host: {
          userId: room.hostUserId,
          email: room.hostEmail,
          username: room.hostUsername,
        },
      }))
      socket.emit('roomsList', rooms)
    })

    // CREATE_ROOM - Vérifie le deck en BDD et crée la room
    socket.on('createRoom', async ({ deckId: rawDeckId }: { deckId: number | string }) => {
    const deckId = Number(rawDeckId)
      try {
        // Vérifier que le deck appartient à l'utilisateur et a 10 cartes
        const deck = await prisma.deck.findFirst({
          where: { id: deckId, userId: socket.data.userId },
          include: { cards: true },
        })

        if (!deck) {
          socket.emit('error', { message: 'Deck not found or does not belong to you' })
          return
        }

        if (deck.cards.length !== 10) {
          socket.emit('error', { message: 'Deck must have exactly 10 cards' })
          return
        }

        // Récupérer l'username
        const user = await prisma.user.findUnique({
          where: { id: socket.data.userId },
        })

        const roomId = `room-${Date.now()}`
        socket.join(roomId)
        socket.data.deckId = deckId

        // Stocker la room en attente
        waitingRooms.set(roomId, {
          roomId,
          hostSocketId: socket.id,
          hostUserId: socket.data.userId,
          hostEmail: socket.data.email,
          hostUsername: user?.username ?? socket.data.email,
          hostDeckId: deckId,
          hostDeck: deck.cards,
        })

        // Confirmation au créateur
        socket.emit('roomCreated', {
          roomId,
          host: {
            userId: socket.data.userId,
            email: socket.data.email,
            username: user?.username,
          },
        })

        // Broadcast liste mise à jour à tous
        const rooms = [...waitingRooms.values()].map((r) => ({
          roomId: r.roomId,
          host: {
            userId: r.hostUserId,
            email: r.hostEmail,
            username: r.hostUsername,
          },
        }))
        io.emit('roomsListUpdated', rooms)

      } catch (error) {
        socket.emit('error', { message: 'Internal server error' })
      }
    })

    // JOIN_ROOM - Vérifie le deck, rejoint la room et démarre la partie
    socket.on('joinRoom', async ({ roomId, deckId: rawDeckId }: { roomId: string; deckId: number | string }) => {
    const deckId = Number(rawDeckId)
      try {
        const room = waitingRooms.get(roomId)

        if (!room) {
          socket.emit('error', { message: 'Room not found' })
          return
        }

        if (room.hostSocketId === socket.id) {
          socket.emit('error', { message: 'You cannot join your own room' })
          return
        }

        // Vérifier que le deck appartient à l'utilisateur et a 10 cartes
        const deck = await prisma.deck.findFirst({
          where: { id: deckId, userId: socket.data.userId },
          include: { cards: { include: { card: true } } },
        })

        if (!deck) {
          socket.emit('error', { message: 'Deck not found or does not belong to you' })
          return
        }

        if (deck.cards.length !== 10) {
          socket.emit('error', { message: 'Deck must have exactly 10 cards' })
          return
        }

        // Récupérer le deck du host avec les cartes complètes
        const hostDeck = await prisma.deck.findFirst({
          where: { id: room.hostDeckId },
          include: { cards: { include: { card: true } } },
        })

        const user = await prisma.user.findUnique({
          where: { id: socket.data.userId },
        })

        socket.join(roomId)
        socket.data.deckId = deckId

        // Retirer la room de la liste d'attente
        waitingRooms.delete(roomId)

        // Mélanger les cartes (5 premières = main initiale)
        const guestHand = deck.cards.slice(0, 5)
        const hostHand = hostDeck?.cards.slice(0, 5) ?? []

        // Envoyer gameStarted au host (sa main visible, main adversaire cachée)
        io.to(room.hostSocketId).emit('gameStarted', {
          roomId,
          yourHand: hostHand,
          opponent: {
            userId: socket.data.userId,
            email: socket.data.email,
            username: user?.username,
            handSize: guestHand.length,
          },
        })

        // Envoyer gameStarted au guest (sa main visible, main adversaire cachée)
        socket.emit('gameStarted', {
          roomId,
          yourHand: guestHand,
          opponent: {
            userId: room.hostUserId,
            email: room.hostEmail,
            username: room.hostUsername,
            handSize: hostHand.length,
          },
        })

        // Broadcast liste mise à jour (room retirée)
        const rooms = [...waitingRooms.values()].map((r) => ({
          roomId: r.roomId,
          host: {
            userId: r.hostUserId,
            email: r.hostEmail,
            username: r.hostUsername,
          },
        }))
        io.emit('roomsListUpdated', rooms)

      } catch (error) {
        console.error('createRoom error:', error)
        socket.emit('error', { message: 'Internal server error' })
      }
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
      // Nettoyer les rooms si le host se déconnecte
      for (const [roomId, room] of waitingRooms.entries()) {
        if (room.hostSocketId === socket.id) {
          waitingRooms.delete(roomId)
          const rooms = [...waitingRooms.values()].map((r) => ({
            roomId: r.roomId,
            host: { userId: r.hostUserId, email: r.hostEmail, username: r.hostUsername },
          }))
          io.emit('roomsListUpdated', rooms)
        }
      }
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