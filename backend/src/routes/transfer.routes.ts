import { Router } from 'express';
import {
  getTransfers,
  getTransfer,
  createTransfer,
  updateTransfer,
  deleteTransfer,
  updateMyTransferStatus,
  getRecentTransferHistory,
} from '../controllers/transfer.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/history/recent', requireRole('ADMIN', 'DISPATCHER'), getRecentTransferHistory);
router.get('/', getTransfers);
router.get('/:id', getTransfer);
router.patch('/:id/my-status', requireRole('DRIVER'), updateMyTransferStatus);
router.post('/', requireRole('ADMIN', 'DISPATCHER'), createTransfer);
router.put('/:id', requireRole('ADMIN', 'DISPATCHER'), updateTransfer);
router.delete('/:id', requireRole('ADMIN'), deleteTransfer);

export default router;
