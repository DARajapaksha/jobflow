import { Router } from 'express';
import * as ctrl from '../controllers/meController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadResume } from '../middleware/upload.js';

// Mounted at /api/me: the logged-in user's own data
const router = Router();
const seeker = [authenticate, requireRole('seeker')];

router.put('/resume', ...seeker, uploadResume, ctrl.uploadResume); // multipart/form-data, field "resume"
router.get('/resume', ...seeker, ctrl.downloadResume);
router.delete('/resume', ...seeker, ctrl.deleteResume);

export default router;
