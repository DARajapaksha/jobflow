import { Router } from 'express';
import * as ctrl from '../controllers/jobController.js';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';

// Mounted at /api
const router = Router();
const employer = [authenticate, requireRole('employer')];
const seeker = [authenticate, requireRole('seeker')];

router.get('/categories', ctrl.categories);

router.get('/jobs', optionalAuth, ctrl.search); // logged-in seekers also get a per-job "saved" flag
router.get('/jobs/:id', optionalAuth, ctrl.getOne); // owners can also see their drafts / closed jobs
router.post('/jobs', ...employer, ctrl.create);
router.patch('/jobs/:id', ...employer, ctrl.update);
router.delete('/jobs/:id', ...employer, ctrl.remove);

router.post('/jobs/:id/save', ...seeker, ctrl.save);
router.delete('/jobs/:id/save', ...seeker, ctrl.unsave);

router.get('/employer/jobs', ...employer, ctrl.listMine);

export default router;
