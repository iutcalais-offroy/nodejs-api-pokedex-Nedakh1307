import { Router } from 'express'
import { deckController } from '../controllers/decks.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

/**
 * @module DecksRoutes
 * @description Routes pour la gestion des decks (protégées par JWT)
 */
const router = Router()

router.use(authMiddleware)

/**
 * @route POST /api/decks
 * @description Crée un nouveau deck pour l'utilisateur connecté
 * @param {string} req.body.name - Nom du deck
 * @param {number[]} req.body.cards - Tableau de 10 IDs de cartes
 * @returns {201} Le deck créé avec ses cartes
 * @returns {400} Nom manquant, nombre de cartes invalide ou IDs invalides
 * @returns {401} Token JWT manquant ou invalide
 * @returns {500} Erreur serveur
 */
router.post('/decks', deckController.create)

/**
 * @route GET /api/decks/mine
 * @description Récupère tous les decks de l'utilisateur connecté
 * @returns {200} Liste des decks de l'utilisateur
 * @returns {401} Token JWT manquant ou invalide
 * @returns {500} Erreur serveur
 */
router.get('/decks/mine', deckController.getMine)

/**
 * @route GET /api/decks/:id
 * @description Récupère un deck spécifique par son ID
 * @param {string} req.params.id - ID du deck
 * @returns {200} Le deck avec ses cartes
 * @returns {401} Token JWT manquant ou invalide
 * @returns {404} Deck non trouvé
 * @returns {500} Erreur serveur
 */
router.get('/decks/:id', deckController.getOne)

/**
 * @route PATCH /api/decks/:id
 * @description Met à jour un deck existant
 * @param {string} req.params.id - ID du deck
 * @param {string} [req.body.name] - Nouveau nom du deck
 * @param {number[]} [req.body.cards] - Nouveau tableau de 10 IDs de cartes
 * @returns {200} Le deck mis à jour
 * @returns {400} Nombre de cartes invalide ou IDs invalides
 * @returns {401} Token JWT manquant ou invalide
 * @returns {404} Deck non trouvé
 * @returns {500} Erreur serveur
 */
router.patch('/decks/:id', deckController.update)

/**
 * @route DELETE /api/decks/:id
 * @description Supprime un deck existant
 * @param {string} req.params.id - ID du deck
 * @returns {200} Message de confirmation
 * @returns {401} Token JWT manquant ou invalide
 * @returns {404} Deck non trouvé
 * @returns {500} Erreur serveur
 */
router.delete('/decks/:id', deckController.delete)

export default router
