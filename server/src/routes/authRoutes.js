import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Slow down password guessing: only failed attempts count toward the limit.
const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts, try again later' } },
});

router.post('/register', ctrl.register);
router.post('/login', credentialsLimiter, ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/me', authenticate, ctrl.me);

export default router;
