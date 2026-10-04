import { Router } from 'express';
import * as ctrl from '../controllers/companyController.js';

// Mounted at /api/companies (public)
const router = Router();
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
export default router;
