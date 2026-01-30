import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

interface JwtPayload {
  userId: number;
  email: string;
}

function isValidJwtPayload(obj: unknown): obj is JwtPayload {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "userId" in obj &&
    typeof (obj as Record<string, unknown>).userId === "number" &&
    "email" in obj &&
    typeof (obj as Record<string, unknown>).email === "string"
  );
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "No token provided" });
      return;
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (!isValidJwtPayload(decoded)) {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: "Invalid token" });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Token expired" });
    } else {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  }
};