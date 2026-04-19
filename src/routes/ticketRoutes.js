const express = require('express');
const router = express.Router();
const {
  bookTickets,
  getMyTickets,
  getTicket,
  cancelTicket,
  getEventTickets,
} = require('../controllers/ticketController');
const { protect, restrictTo } = require('../middleware/auth');

// All ticket routes require authentication
router.use(protect);

// Customer routes
router.post('/book', restrictTo('customer'), bookTickets);
router.get('/my', restrictTo('customer'), getMyTickets);
router.get('/:id', restrictTo('customer'), getTicket);
router.patch('/:id/cancel', restrictTo('customer'), cancelTicket);

// Organizer routes
router.get('/event/:eventId', restrictTo('organizer'), getEventTickets);

module.exports = router;
