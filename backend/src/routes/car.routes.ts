import { Router } from 'express';
import {
	getCars,
	getMaintenanceLog,
	getCar,
	createCar,
	updateCar,
	deleteCar,
	getCarMaintenance,
	addCarMaintenance,
} from '../controllers/car.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('ADMIN', 'DISPATCHER'), getCars);
router.get('/maintenance/log', requireRole('ADMIN', 'DISPATCHER'), getMaintenanceLog);
router.get('/:id', requireRole('ADMIN', 'DISPATCHER'), getCar);
router.get('/:id/maintenance', requireRole('ADMIN', 'DISPATCHER'), getCarMaintenance);
router.post('/', requireRole('ADMIN', 'DISPATCHER'), createCar);
router.put('/:id', requireRole('ADMIN', 'DISPATCHER'), updateCar);
router.post('/:id/maintenance', requireRole('ADMIN', 'DISPATCHER'), addCarMaintenance);
router.delete('/:id', requireRole('ADMIN'), deleteCar);

export default router;
