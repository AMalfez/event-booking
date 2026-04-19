const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

// Queue for booking confirmation emails
const bookingConfirmationQueue = new Queue('booking-confirmation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 100, // keep last 100 completed jobs
    removeOnFail: 200,
  },
});

// Queue for event update notifications
const eventUpdateQueue = new Queue('event-update-notification', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

module.exports = { bookingConfirmationQueue, eventUpdateQueue };
