import {createServer} from "http";
import {env} from "./env";
import express from "express";
import { Server } from "socket.io";
import cors from "cors";
import authRoutes from "./routes/auth.routes"; 
import { authMiddleware, AuthRequest } from "./middlewares/auth.middleware"; 
import decksRoutes from "./routes/decks.routes";
import cardsRoutes from "./routes/cards.routes";

// Create Express app
export const app = express();

// Middlewares
app.use(
    cors({
        origin: true,  // Autorise toutes les origines
        credentials: true,
    }),
);


app.use(express.json());

// Routes

app.use("/api", cardsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", decksRoutes);
app.use(express.static('public'));



// Route de test protégée pour valider le middleware
app.get("/api/me", authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ user: req.user });
});

// Serve static files
app.use(express.static('public'));

// Health check endpoint
app.get("/api/health", (_req, res) => {
    res.json({status: "ok", message: "TCG Backend Server is running"});
});


if (require.main === module) {
    // Create HTTP server
    const httpServer = createServer(app);

    // Initialisation de Socket.io
    const io = new Server(httpServer, {
        cors: { origin: "*" }
    });

    // Log de test
    io.on("connection", (socket) => {
        console.log(`✅ Client connecté au Socket: ${socket.id}`);
    });

    // Start server
    try {
        httpServer.listen(env.PORT, () => {
            console.log(`\n🚀 Server is running on http://localhost:${env.PORT}`);
            console.log(`🧪 Socket.io Test Client available at http://localhost:${env.PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}
