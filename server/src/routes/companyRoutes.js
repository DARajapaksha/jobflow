import { Router } from 'express';
import * as ctrl from '../controllers/companyController.js';
import * as images from '../controllers/imageController.js';

// Mounted at /api/companies (public)
const router = Router();
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.get('/:id/logo', images.companyLogo); // public, cached forever (the URL is versioned)
export default router;
