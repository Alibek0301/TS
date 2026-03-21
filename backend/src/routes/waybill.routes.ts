import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
  getWaybills,
  getWaybillById,
  autoGenerateWaybills,
  updateWaybill,
  markWaybillPrinted,
} from '../controllers/waybill.controller';

const router = Router();

router.use(authenticate);

router.get('/', getWaybills);
router.get('/:id', getWaybillById);
router.post('/auto-generate', requireRole('ADMIN', 'DISPATCHER'), autoGenerateWaybills);
router.patch('/:id', requireRole('ADMIN', 'DISPATCHER'), updateWaybill);
router.patch('/:id/printed', requireRole('ADMIN', 'DISPATCHER'), markWaybillPrinted);

export default router;
