import { Router } from 'express'
import { register, login } from '../controllers/auth.controller'

/**
 * @module AuthRoutes
 * @description Routes pour l'authentification des utilisateurs
 */
const router = Router()

/**
 * @route POST /api/auth/sign-up
 * @description Inscription d'un nouvel utilisateur
 * @param {string} req.body.email - Email de l'utilisateur
 * @param {string} req.body.username - Nom d'utilisateur
 * @param {string} req.body.password - Mot de passe (min 6 caractères)
 * @returns {201} Token JWT et informations utilisateur
 * @returns {400} Champs manquants ou utilisateur déjà existant
 * @returns {500} Erreur serveur
 */
router.post('/sign-up', register)

/**
 * @route POST /api/auth/sign-in
 * @description Connexion d'un utilisateur existant
 * @param {string} req.body.email - Email de l'utilisateur
 * @param {string} req.body.password - Mot de passe
 * @returns {200} Token JWT et informations utilisateur
 * @returns {400} Champs manquants ou identifiants invalides
 * @returns {500} Erreur serveur
 */
router.post('/sign-in', login)

export default router
