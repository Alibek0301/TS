import { Router } from 'express';
import {
  getClients,
  getDriverAnalytics,
  getCarAnalytics,
  getClientAnalytics,
} from '../controllers/analytics.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole('ADMIN', 'DISPATCHER'));

router.get('/clients', getClients);
router.get('/drivers/:id', getDriverAnalytics);
router.get('/cars/:id', getCarAnalytics);
router.get('/clients/:name', getClientAnalytics);

export default router;
