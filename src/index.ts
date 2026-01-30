import {createServer} from "http";
import {env} from "./env";
import express from "express";
import cors from "cors";

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