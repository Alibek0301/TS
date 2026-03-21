import { Router } from 'express';
import {
  getTransfers,
  getTransfer,
  createTransfer,
  createRecurringTransfers,
  updateTransfer,
  deleteTransfer,
  updateMyTransferStatus,
  getRecentTransferHistory,
  getTransferFilterPresets,
  saveTransferFilterPreset,
  deleteTransferFilterPreset,
  renameTransferFilterPreset,
  setTransferFilterPresetDefault,
  clearTransferFilterPresetDefault,
} from '../controllers/transfer.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/history/recent', requireRole('ADMIN', 'DISPATCHER'), getRecentTransferHistory);
router.get('/presets', getTransferFilterPresets);
router.post('/presets', saveTransferFilterPreset);
router.patch('/presets/default/clear', clearTransferFilterPresetDefault);
router.patch('/presets/:id/default', setTransferFilterPresetDefault);
router.patch('/presets/:id/rename', renameTransferFilterPreset);
router.delete('/presets/:id', deleteTransferFilterPreset);
router.get('/', getTransfers);
router.post('/recurring', requireRole('ADMIN', 'DISPATCHER'), createRecurringTransfers);
router.get('/:id', getTransfer);
router.patch('/:id/my-status', requireRole('DRIVER'), updateMyTransferStatus);
router.post('/', requireRole('ADMIN', 'DISPATCHER'), createTransfer);
router.put('/:id', requireRole('ADMIN', 'DISPATCHER'), updateTransfer);
router.delete('/:id', requireRole('ADMIN'), deleteTransfer);

export default router;
