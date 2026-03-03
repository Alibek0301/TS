import { Router } from 'express';
import { getCars, getCar, createCar, updateCar, deleteCar } from '../controllers/car.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getCars);
router.get('/:id', getCar);
router.post('/', requireRole('ADMIN', 'DISPATCHER'), createCar);
router.put('/:id', requireRole('ADMIN', 'DISPATCHER'), updateCar);
router.delete('/:id', requireRole('ADMIN'), deleteCar);

export default router;
