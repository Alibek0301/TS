import { Router } from 'express';
import {
  getTransfers,
  getTransfer,
  createTransfer,
  updateTransfer,
  deleteTransfer,
} from '../controllers/transfer.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getTransfers);
router.get('/:id', getTransfer);
router.post('/', requireRole('ADMIN', 'DISPATCHER'), createTransfer);
router.put('/:id', requireRole('ADMIN', 'DISPATCHER'), updateTransfer);
router.delete('/:id', requireRole('ADMIN'), deleteTransfer);

export default router;
