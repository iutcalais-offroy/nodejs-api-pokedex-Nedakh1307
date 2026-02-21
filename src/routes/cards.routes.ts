import { Router } from 'express'
import { getAllCards } from '../controllers/cards.controller'

/**
 * @module CardsRoutes
 * @description Routes pour la consultation des cartes Pokémon
 */
const router = Router()

/**
 * @route GET /api/cards
 * @description Récupère toutes les cartes triées par numéro Pokédex
 * @returns {200} Liste de toutes les cartes
 * @returns {500} Erreur serveur
 */
router.get('/cards', getAllCards)

export default router