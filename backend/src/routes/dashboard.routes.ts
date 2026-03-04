import { Router } from 'express';
import { getDashboard } from '../controllers/dashboard.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/', requireRole('ADMIN', 'DISPATCHER', 'DRIVER'), getDashboard);

export default router;
