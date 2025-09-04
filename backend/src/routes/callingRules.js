import express from 'express';
import { CallingRuleController } from '../controllers/CallingRuleController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Get calling rules statistics
router.get('/stats', CallingRuleController.getStats);

// Get all calling rules
router.get('/', CallingRuleController.getAllRules);

// Get calling rules by type (do/don't)
router.get('/type/:type', CallingRuleController.getRulesByType);

// Get a specific calling rule by ID
router.get('/:id', CallingRuleController.getRuleById);

// Create a new calling rule
router.post('/', CallingRuleController.createRule);

// Update a calling rule
router.put('/:id', CallingRuleController.updateRule);

// Delete a calling rule
router.delete('/:id', CallingRuleController.deleteRule);

export default router;
