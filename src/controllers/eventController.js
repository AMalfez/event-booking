const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const { eventUpdateQueue } = require('../queues');

// GET /api/events — public, browse all upcoming events
exports.getAllEvents = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [events, total] = await Promise.all([
      Event.find(filter)
        .populate('organizer', 'name email')
        .sort({ date: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Event.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: events,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/events/:id — public
exports.getEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id).populate('organizer', 'name email');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

// POST /api/events — organizer only
exports.createEvent = async (req, res, next) => {
  try {
    const event = await Event.create({ ...req.body, organizer: req.user._id });
    res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/events/:id — organizer only (own events)
exports.updateEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    // Ensure the requesting organizer owns this event
    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only update your own events.' });
    }

    // Prevent direct manipulation of remainingTickets via this route
    delete req.body.remainingTickets;

    // If totalTickets is being updated, adjust remainingTickets accordingly
    if (req.body.totalTickets) {
      const soldTickets = event.totalTickets - event.remainingTickets;
      const newRemaining = req.body.totalTickets - soldTickets;
      if (newRemaining < 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot reduce totalTickets below already sold tickets (${soldTickets}).`,
        });
      }
      req.body.remainingTickets = newRemaining;
    }

    const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    // Find all customers with tickets to this event and queue notifications
    const bookedTickets = await Ticket.find({ event: req.params.id, status: 'confirmed' })
      .populate('customer', 'name email');

    if (bookedTickets.length > 0) {
      await eventUpdateQueue.add('notify-customers', {
        eventId: updatedEvent._id.toString(),
        eventTitle: updatedEvent.title,
        updatedFields: Object.keys(req.body),
        customers: bookedTickets.map((t) => ({
          id: t.customer._id.toString(),
          name: t.customer.name,
          email: t.customer.email,
        })),
      });
    }

    res.status(200).json({ success: true, data: updatedEvent });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/events/:id — organizer only (own events)
exports.deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own events.' });
    }

    await Event.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Event deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// GET /api/events/my — organizer: see all events they created
exports.getMyEvents = async (req, res, next) => {
  try {
    const events = await Event.find({ organizer: req.user._id }).sort({ date: 1 });
    res.status(200).json({ success: true, count: events.length, data: events });
  } catch (err) {
    next(err);
  }
};
