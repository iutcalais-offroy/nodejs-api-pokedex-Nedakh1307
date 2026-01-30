import {createServer} from "http";
import {env} from "./env";
import express from "express";
import cors from "cors";
import cardsRoutes from "./routes/cards.routes";
import authRoutes from "./routes/auth.routes"; 
import { authMiddleware, AuthRequest } from "./middlewares/auth.middleware"; 

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

// Serve static files (Socket.io test client)
app.use(express.static('public'));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/cards", cardsRoutes);

// Route de test protégée pour valider le middleware
app.get("/api/me", authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ user: req.user });
});

// Health check endpoint
app.get("/api/health", (_req, res) => {
    res.json({status: "ok", message: "TCG Backend Server is running"});
});

// Create HTTP server
const httpServer = createServer(app);

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