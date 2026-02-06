import { createServer } from "http";
import { env } from "./env";
import express from "express";
import { Server } from "socket.io"; 
import cors from "cors";
import cardsRoutes from "./routes/cards.routes";
import authRoutes from "./routes/auth.routes"; 
import decksRoutes from "./routes/decks.routes"; 
import { authMiddleware, AuthRequest } from "./middlewares/auth.middleware"; 

// Create Express app
export const app = express();

// Middlewares
app.use(
    cors({
        origin: true,
        credentials: true,
    }),
);

// Middleware pour parser le JSON
app.use(express.json());

// Serve static files
app.use(express.static('public'));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/cards", cardsRoutes);
app.use("/api/decks", decksRoutes);
