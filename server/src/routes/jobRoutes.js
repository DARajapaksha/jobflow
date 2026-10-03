import { Router } from 'express';
import * as ctrl from '../controllers/jobController.js';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';

// Mounted at /api
const router = Router();
const employer = [authenticate, requireRole('employer')];

router.get('/categories', ctrl.categories);

router.get('/jobs', ctrl.search);
router.get('/jobs/:id', optionalAuth, ctrl.getOne); // owners can also see their drafts / closed jobs
router.post('/jobs', ...employer, ctrl.create);
router.patch('/jobs/:id', ...employer, ctrl.update);
router.delete('/jobs/:id', ...employer, ctrl.remove);

router.get('/employer/jobs', ...employer, ctrl.listMine);

export default router;
