import { Router } from 'express'
import { register, login } from '../controllers/auth.controller'
const router = Router()
router.post('/sign-up', register)
router.post('/sign-in', login)
export default router
