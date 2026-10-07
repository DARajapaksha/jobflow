import { Router } from 'express';
import * as ctrl from '../controllers/meController.js';
import * as jobCtrl from '../controllers/jobController.js';
import * as profileCtrl from '../controllers/profileController.js';
import * as images from '../controllers/imageController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadImage, uploadResume } from '../middleware/upload.js';

// Mounted at /api/me: the logged-in user's own data
const router = Router();
const seeker = [authenticate, requireRole('seeker')];
const employer = [authenticate, requireRole('employer')];

router.patch('/profile', authenticate, requireRole('seeker', 'employer'), profileCtrl.update);

router.put('/avatar', ...seeker, uploadImage, images.uploadAvatar); // multipart/form-data, field "image"
router.delete('/avatar', ...seeker, images.deleteAvatar);
router.put('/logo', ...employer, uploadImage, images.uploadLogo);
router.delete('/logo', ...employer, images.deleteLogo);

router.put('/resume', ...seeker, uploadResume, ctrl.uploadResume); // multipart/form-data, field "resume"
router.get('/resume', ...seeker, ctrl.downloadResume);
router.delete('/resume', ...seeker, ctrl.deleteResume);

router.get('/saved-jobs', ...seeker, jobCtrl.listSaved);

export default router;
