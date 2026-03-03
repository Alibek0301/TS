import { Router } from 'express';
import { getDrivers, getDriver, createDriver, updateDriver, deleteDriver } from '../controllers/driver.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getDrivers);
router.get('/:id', getDriver);
router.post('/', requireRole('ADMIN', 'DISPATCHER'), createDriver);
router.put('/:id', requireRole('ADMIN', 'DISPATCHER'), updateDriver);
router.delete('/:id', requireRole('ADMIN'), deleteDriver);

export default router;
