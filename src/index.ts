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
import { calculateDamage } from './utils/rules.util'
import { PokemonType } from './generated/prisma/client'

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

// Types
interface CardData {
  id: number
  name: string
  hp: number
  attack: number
  type: PokemonType
  currentHp: number
}

interface PlayerState {
  socketId: string
  userId: number
  email: string
  username: string
  hand: CardData[]
  deck: CardData[]
  activeCard: CardData | null
  score: number
}

interface GameState {
  roomId: string
  players: [PlayerState, PlayerState]
  currentPlayerSocketId: string
  started: boolean
}

// Stockage des rooms en mémoire
const waitingRooms = new Map<
  string,
  {
    roomId: string
    hostSocketId: string
    hostUserId: number
    hostEmail: string
    hostUsername: string
    hostDeckId: number
    hostDeck: object[]
  }
>()

// Stockage des parties en cours
const activeGames = new Map<string, GameState>()

// Fonctions utilitaires
function getOpponent(game: GameState, socketId: string): PlayerState {
  return game.players[0].socketId === socketId
    ? game.players[1]
    : game.players[0]
}

function getPlayer(game: GameState, socketId: string): PlayerState {
  return game.players[0].socketId === socketId
    ? game.players[0]
    : game.players[1]
}

function buildGameStateView(game: GameState, socketId: string) {
  const player = getPlayer(game, socketId)
  const opponent = getOpponent(game, socketId)
  return {
    roomId: game.roomId,
    currentPlayerSocketId: game.currentPlayerSocketId,
    isMyTurn: game.currentPlayerSocketId === socketId,
    me: {
      userId: player.userId,
      email: player.email,
      username: player.username,
      hand: player.hand,
      activeCard: player.activeCard,
      score: player.score,
      deckSize: player.deck.length,
    },
    opponent: {
      userId: opponent.userId,
      email: opponent.email,
      username: opponent.username,
      handSize: opponent.hand.length,
      activeCard: opponent.activeCard,
      score: opponent.score,
      deckSize: opponent.deck.length,
    },
  }
}

function emitGameState(io: Server, game: GameState) {
  for (const player of game.players) {
    io.to(player.socketId).emit(
      'gameStateUpdated',
      buildGameStateView(game, player.socketId),
    )
  }
}

// Start server only if this file is run directly (not imported for tests)
// @ts-expect-error - import.meta.url not available in commonjs
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
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        userId: number
        email: string
      }

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
    console.log(
      `✅ Client connecté au Socket: ${socket.id} | user: ${socket.data.email}`,
    )

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
    socket.on(
      'createRoom',
      async ({ deckId: rawDeckId }: { deckId: number | string }) => {
        const deckId = Number(rawDeckId)
        try {
          const deck = await prisma.deck.findFirst({
            where: { id: deckId, userId: socket.data.userId },
            include: { cards: { include: { card: true } } },
          })

          if (!deck) {
            socket.emit('error', {
              message: 'Deck not found or does not belong to you',
            })
            return
          }

          if (deck.cards.length !== 10) {
            socket.emit('error', { message: 'Deck must have exactly 10 cards' })
            return
          }

          const user = await prisma.user.findUnique({
            where: { id: socket.data.userId },
          })

          const roomId = `room-${Date.now()}`
          socket.join(roomId)
          socket.data.deckId = deckId

          waitingRooms.set(roomId, {
            roomId,
            hostSocketId: socket.id,
            hostUserId: socket.data.userId,
            hostEmail: socket.data.email,
            hostUsername: user?.username ?? socket.data.email,
            hostDeckId: deckId,
            hostDeck: deck.cards,
          })

          socket.emit('roomCreated', {
            roomId,
            host: {
              userId: socket.data.userId,
              email: socket.data.email,
              username: user?.username,
            },
          })

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
      },
    )

    // JOIN_ROOM - Vérifie le deck, rejoint la room et démarre la partie
    socket.on(
      'joinRoom',
      async ({
        roomId,
        deckId: rawDeckId,
      }: {
        roomId: string
        deckId: number | string
      }) => {
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

          const deck = await prisma.deck.findFirst({
            where: { id: deckId, userId: socket.data.userId },
            include: { cards: { include: { card: true } } },
          })

          if (!deck) {
            socket.emit('error', {
              message: 'Deck not found or does not belong to you',
            })
            return
          }

          if (deck.cards.length !== 10) {
            socket.emit('error', { message: 'Deck must have exactly 10 cards' })
            return
          }

          const hostDeck = await prisma.deck.findFirst({
            where: { id: room.hostDeckId },
            include: { cards: { include: { card: true } } },
          })

          const guestUser = await prisma.user.findUnique({
            where: { id: socket.data.userId },
          })

          socket.join(roomId)
          socket.data.deckId = deckId
          waitingRooms.delete(roomId)

          // Préparer les decks complets
          const toCardData = (c: any): CardData => ({
            id: c.card.id,
            name: c.card.name,
            hp: c.card.hp,
            attack: c.card.attack,
            type: c.card.type as PokemonType,
            currentHp: c.card.hp,
          })

          const hostCards = (hostDeck?.cards ?? []).map(toCardData)
          const guestCards = deck.cards.map(toCardData)

          // Créer l'état de jeu
          const game: GameState = {
            roomId,
            currentPlayerSocketId: room.hostSocketId, // host commence
            started: true,
            players: [
              {
                socketId: room.hostSocketId,
                userId: room.hostUserId,
                email: room.hostEmail,
                username: room.hostUsername,
                hand: hostCards.slice(0, 5),
                deck: hostCards.slice(5),
                activeCard: null,
                score: 0,
              },
              {
                socketId: socket.id,
                userId: socket.data.userId,
                email: socket.data.email,
                username: guestUser?.username ?? socket.data.email,
                hand: guestCards.slice(0, 5),
                deck: guestCards.slice(5),
                activeCard: null,
                score: 0,
              },
            ],
          }

          activeGames.set(roomId, game)
          emitGameState(io, game)

          // Broadcast liste mise à jour
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
          console.error('joinRoom error:', error)
          socket.emit('error', { message: 'Internal server error' })
        }
      },
    )

    // DRAW_CARDS
    socket.on('drawCards', ({ roomId }: { roomId: string }) => {
      const game = activeGames.get(roomId)
      if (!game) {
        socket.emit('error', { message: 'Game not found' })
        return
      }
      if (game.currentPlayerSocketId !== socket.id) {
        socket.emit('error', { message: 'Not your turn' })
        return
      }

      const player = getPlayer(game, socket.id)
      const slots = 5 - player.hand.length

      if (slots <= 0) {
        socket.emit('error', { message: 'Hand is full (5 cards max)' })
        return
      }

      const drawn = player.deck.splice(0, slots)
      player.hand.push(...drawn)

      emitGameState(io, game)
    })

    // PLAY_CARD
    socket.on(
      'playCard',
      ({ roomId, cardIndex }: { roomId: string; cardIndex: number }) => {
        const game = activeGames.get(roomId)
        if (!game) {
          socket.emit('error', { message: 'Game not found' })
          return
        }
        if (game.currentPlayerSocketId !== socket.id) {
          socket.emit('error', { message: 'Not your turn' })
          return
        }

        const player = getPlayer(game, socket.id)

        if (cardIndex < 0 || cardIndex >= player.hand.length) {
          socket.emit('error', { message: 'Invalid card index' })
          return
        }

        if (player.activeCard) {
          socket.emit('error', { message: 'You already have an active card' })
          return
        }

        const [card] = player.hand.splice(cardIndex, 1)
        player.activeCard = card

        emitGameState(io, game)
      },
    )

    // ATTACK
    socket.on('attack', ({ roomId }: { roomId: string }) => {
      const game = activeGames.get(roomId)
      if (!game) {
        socket.emit('error', { message: 'Game not found' })
        return
      }
      if (game.currentPlayerSocketId !== socket.id) {
        socket.emit('error', { message: 'Not your turn' })
        return
      }

      const player = getPlayer(game, socket.id)
      const opponent = getOpponent(game, socket.id)

      if (!player.activeCard) {
        socket.emit('error', { message: 'You have no active card' })
        return
      }

      if (!opponent.activeCard) {
        socket.emit('error', { message: 'Opponent has no active card' })
        return
      }

      // Calculer les dégâts
      const damage = calculateDamage(
        player.activeCard.attack,
        player.activeCard.type,
        opponent.activeCard.type,
      )

      opponent.activeCard.currentHp -= damage

      // Vérifier si la carte adverse est KO
      if (opponent.activeCard.currentHp <= 0) {
        player.score += 1
        opponent.activeCard = null

        // Vérifier la victoire
        if (player.score >= 3) {
          emitGameState(io, game)
          io.to(game.players[0].socketId).emit('gameEnded', {
            winner: {
              userId: player.userId,
              email: player.email,
              username: player.username,
            },
            scores: {
              [player.email]: player.score,
              [opponent.email]: opponent.score,
            },
          })
          io.to(game.players[1].socketId).emit('gameEnded', {
            winner: {
              userId: player.userId,
              email: player.email,
              username: player.username,
            },
            scores: {
              [player.email]: player.score,
              [opponent.email]: opponent.score,
            },
          })
          activeGames.delete(roomId)
          return
        }
      }

      // Changer de tour après l'attaque
      game.currentPlayerSocketId = opponent.socketId
      emitGameState(io, game)
    })

    // END_TURN
    socket.on('endTurn', ({ roomId }: { roomId: string }) => {
      const game = activeGames.get(roomId)
      if (!game) {
        socket.emit('error', { message: 'Game not found' })
        return
      }
      if (game.currentPlayerSocketId !== socket.id) {
        socket.emit('error', { message: 'Not your turn' })
        return
      }

      const opponent = getOpponent(game, socket.id)
      game.currentPlayerSocketId = opponent.socketId

      emitGameState(io, game)
    })

    socket.on('disconnect', () => {
      // Nettoyer les rooms si le host se déconnecte
      for (const [roomId, room] of waitingRooms.entries()) {
        if (room.hostSocketId === socket.id) {
          waitingRooms.delete(roomId)
          const rooms = [...waitingRooms.values()].map((r) => ({
            roomId: r.roomId,
            host: {
              userId: r.hostUserId,
              email: r.hostEmail,
              username: r.hostUsername,
            },
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
      console.log(
        `📄 Swagger UI available at http://localhost:${env.PORT}/api-docs`,
      )
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}
console.log('test')
