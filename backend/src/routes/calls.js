import express from 'express';
import { getCallsWithFilters, getCallsCount, createCall, updateCall, deleteCall } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// @route   GET /api/calls
// @desc    Get call history with filters
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      agent = '', 
      team = '', 
      status = '', 
      sentiment = '',
      startDate = '',
      endDate = '',
      search = ''
    } = req.query;
    
    const filters = {
      agent: agent || undefined,
      team: team || undefined,
      status: status || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      search: search || undefined
    };

    // Get calls with filters and pagination
    const calls = await getCallsWithFilters(filters, parseInt(page), parseInt(limit));
    
    // Get total count
    const total = await getCallsCount(filters);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      calls: calls,
      pagination: {
        current: parseInt(page),
        total: totalPages,
        totalRecords: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching calls:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/calls/:id
// @desc    Get call details
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const callId = req.params.id;
    
    // Get call with analysis data
    const { data: call, error } = await supabase
      .from('calls')
      .select(`
        *,
        users (
          name,
          teams (
            name
          )
        ),
        call_analysis (
          *
        )
      `)
      .eq('id', callId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ message: 'Call not found' });
      }
      throw error;
    }

    res.json(call);
  } catch (error) {
    logger.error('Error fetching call details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/calls
// @desc    Create new call
// @access  Private
router.post('/', async (req, res) => {
  try {
    const callData = {
      ...req.body,
      user_id: req.user.id
    };

    const newCall = await createCall(callData);
    res.status(201).json(newCall);
  } catch (error) {
    logger.error('Error creating call:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/calls/:id
// @desc    Update call
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const callId = req.params.id;
    const updates = req.body;

    const updatedCall = await updateCall(callId, updates);
    res.json(updatedCall);
  } catch (error) {
    logger.error('Error updating call:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/calls/:id
// @desc    Delete call
// @access  Private (Admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const callId = req.params.id;
    
    await deleteCall(callId);
    res.json({ message: 'Call deleted successfully' });
  } catch (error) {
    logger.error('Error deleting call:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
