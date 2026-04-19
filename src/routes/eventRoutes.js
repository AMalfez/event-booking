const express = require('express');
const router = express.Router();
const {
  getAllEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getMyEvents,
} = require('../controllers/eventController');
const { protect, restrictTo } = require('../middleware/auth');

// Public routes
router.get('/', getAllEvents);
router.get('/:id', getEvent);

// Organizer-only routes
router.use(protect, restrictTo('organizer'));
router.get('/organizer/my', getMyEvents);
router.post('/', createEvent);
router.patch('/:id', updateEvent);
router.delete('/:id', deleteEvent);

module.exports = router;
