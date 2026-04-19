const mongoose = require('mongoose');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const { bookingConfirmationQueue } = require('../queues');

// POST /api/tickets/book — customer only
exports.bookTickets = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { eventId, quantity } = req.body;

    if (!eventId || !quantity || quantity < 1) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'eventId and a valid quantity are required.' });
    }

    // Atomically decrement remainingTickets only if enough are available
    const event = await Event.findOneAndUpdate(
      { _id: eventId, remainingTickets: { $gte: quantity }, status: 'upcoming' },
      { $inc: { remainingTickets: -quantity } },
      { new: true, session }
    );

    if (!event) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Not enough tickets available or event is not open for booking.',
      });
    }

    const ticket = await Ticket.create(
      [
        {
          event: eventId,
          customer: req.user._id,
          quantity,
          totalPrice: event.ticketPrice * quantity,
          status: 'confirmed',
        },
      ],
      { session }
    );

    await session.commitTransaction();

    // Queue background job for booking confirmation email
    await bookingConfirmationQueue.add('send-confirmation', {
      ticketId: ticket[0]._id.toString(),
      customerId: req.user._id.toString(),
      customerName: req.user.name,
      customerEmail: req.user.email,
      eventId: event._id.toString(),
      eventTitle: event.title,
      eventDate: event.date,
      eventVenue: event.venue,
      quantity,
      totalPrice: event.ticketPrice * quantity,
    });

    res.status(201).json({
      success: true,
      message: 'Tickets booked successfully! A confirmation will be sent to your email shortly.',
      data: ticket[0],
    });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

// GET /api/tickets/my — customer: see their own bookings
exports.getMyTickets = async (req, res, next) => {
  try {
    const tickets = await Ticket.find({ customer: req.user._id })
      .populate('event', 'title date venue ticketPrice status')
      .sort({ bookedAt: -1 });

    res.status(200).json({ success: true, count: tickets.length, data: tickets });
  } catch (err) {
    next(err);
  }
};

// GET /api/tickets/:id — customer: see one ticket (must own it)
exports.getTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate(
      'event',
      'title date venue ticketPrice status organizer'
    );

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    if (ticket.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.status(200).json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/tickets/:id/cancel — customer: cancel a booking
exports.cancelTicket = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const ticket = await Ticket.findById(req.params.id).session(session);

    if (!ticket) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    if (ticket.customer.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (ticket.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Ticket is already cancelled.' });
    }

    // Return tickets back to the event's remaining pool
    await Event.findByIdAndUpdate(
      ticket.event,
      { $inc: { remainingTickets: ticket.quantity } },
      { session }
    );

    ticket.status = 'cancelled';
    await ticket.save({ session });

    await session.commitTransaction();
    res.status(200).json({ success: true, message: 'Ticket cancelled successfully.', data: ticket });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

// GET /api/tickets/event/:eventId — organizer: see all bookings for their event
exports.getEventTickets = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const tickets = await Ticket.find({ event: req.params.eventId })
      .populate('customer', 'name email')
      .sort({ bookedAt: -1 });

    res.status(200).json({ success: true, count: tickets.length, data: tickets });
  } catch (err) {
    next(err);
  }
};
