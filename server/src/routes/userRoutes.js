import { Router } from 'express';
import * as images from '../controllers/imageController.js';
import { authenticate } from '../middleware/auth.js';

// Mounted at /api/users
const router = Router();
router.get('/:id/avatar', authenticate, images.userAvatar); // the seeker, or an employer they applied to
export default router;
