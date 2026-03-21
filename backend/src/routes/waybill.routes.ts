import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
  getWaybills,
  getWaybillById,
  autoGenerateWaybills,
  exportWaybillsCsv,
  updateWaybill,
  markWaybillPrinted,
  bulkUpdateWaybillStatus,
  bulkMarkWaybillPrinted,
} from '../controllers/waybill.controller';

const router = Router();

router.use(authenticate);

router.get('/', getWaybills);
router.get('/export.csv', exportWaybillsCsv);
router.get('/:id', getWaybillById);
router.post('/auto-generate', requireRole('ADMIN', 'DISPATCHER'), autoGenerateWaybills);
router.patch('/bulk/status', requireRole('ADMIN', 'DISPATCHER'), bulkUpdateWaybillStatus);
router.patch('/bulk/printed', requireRole('ADMIN', 'DISPATCHER'), bulkMarkWaybillPrinted);
router.patch('/:id', requireRole('ADMIN', 'DISPATCHER'), updateWaybill);
router.patch('/:id/printed', requireRole('ADMIN', 'DISPATCHER'), markWaybillPrinted);

export default router;
