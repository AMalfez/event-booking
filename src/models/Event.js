const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    venue: {
      type: String,
      required: [true, 'Venue is required'],
    },
    totalTickets: {
      type: Number,
      required: [true, 'Total tickets count is required'],
      min: 1,
    },
    remainingTickets: {
      type: Number,
      min: 0,
    },
    ticketPrice: {
      type: Number,
      required: [true, 'Ticket price is required'],
      min: 0,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
    },
  },
  { timestamps: true }
);

// Set remainingTickets = totalTickets on first save
eventSchema.pre('save', function (next) {
  if (this.isNew) {
    this.remainingTickets = this.totalTickets;
  }
  next();
});

module.exports = mongoose.model('Event', eventSchema);
