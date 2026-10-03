import { Router } from 'express';
import * as ctrl from '../controllers/applicationController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadResume } from '../middleware/upload.js';

// Mounted at /api
const router = Router();
const seeker = [authenticate, requireRole('seeker')];
const employer = [authenticate, requireRole('employer')];

router.post('/jobs/:id/applications', ...seeker, uploadResume, ctrl.apply); // multipart: coverLetter + optional resume PDF
router.get('/jobs/:id/applications', ...employer, ctrl.listForJob);
router.get('/me/applications', ...seeker, ctrl.listMine);

router.get('/applications/:id', authenticate, ctrl.getOne); // applicant or the employer who owns the job
router.get('/applications/:id/resume', authenticate, ctrl.downloadResume);
router.patch('/applications/:id/status', ...employer, ctrl.updateStatus);

export default router;
