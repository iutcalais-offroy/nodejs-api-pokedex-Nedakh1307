import { Request, Response } from "express";
import { prisma } from "../database";

export const getAllCards = async (_req: Request, res: Response): Promise<void> => {
  try {
    const cards = await prisma.card.findMany({
      orderBy: {
        pokedexNumber: 'asc',
      },
    });

    res.status(200).json(cards);
  } catch (error) {
    console.error("Erreur lors de la récupération des cartes:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};