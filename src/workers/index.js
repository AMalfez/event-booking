const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');

// ─── Worker 1: Booking Confirmation ──────────────────────────────────────────
const bookingConfirmationWorker = new Worker(
  'booking-confirmation',
  async (job) => {
    const {
      ticketId,
      customerName,
      customerEmail,
      eventTitle,
      eventDate,
      eventVenue,
      quantity,
      totalPrice,
    } = job.data;

    // Simulate sending a booking confirmation email
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[EMAIL] 📧 Booking Confirmation Email');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  To:       ${customerName} <${customerEmail}>`);
    console.log(`  Subject:  Booking Confirmed – ${eventTitle}`);
    console.log(`  Ticket ID: ${ticketId}`);
    console.log(`  Event:    ${eventTitle}`);
    console.log(`  Date:     ${new Date(eventDate).toDateString()}`);
    console.log(`  Venue:    ${eventVenue}`);
    console.log(`  Tickets:  ${quantity}`);
    console.log(`  Total:    ₹${totalPrice}`);
    console.log('  Status:   ✅ Confirmed');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  },
  {
    connection: redisConnection,
    concurrency: 5, // process up to 5 emails at a time
  }
);

bookingConfirmationWorker.on('completed', (job) => {
  console.log(`[WORKER] booking-confirmation job ${job.id} completed`);
});

bookingConfirmationWorker.on('failed', (job, err) => {
  console.error(`[WORKER] booking-confirmation job ${job.id} failed: ${err.message}`);
});

// ─── Worker 2: Event Update Notification ─────────────────────────────────────
const eventUpdateWorker = new Worker(
  'event-update-notification',
  async (job) => {
    const { eventTitle, updatedFields, customers } = job.data;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[EMAIL] 📢 Event Update Notification');
    console.log(`  Event:          ${eventTitle}`);
    console.log(`  Updated Fields: ${updatedFields.join(', ')}`);
    console.log(`  Notifying ${customers.length} customer(s)...`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Notify each booked customer one by one
    for (const customer of customers) {
      console.log(`  → Sending update email to: ${customer.name} <${customer.email}>`);
      // Simulate a small async delay per email (e.g. SMTP call)
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.log(`  ✅ All ${customers.length} customer(s) notified for "${eventTitle}"`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

eventUpdateWorker.on('completed', (job) => {
  console.log(`[WORKER] event-update-notification job ${job.id} completed`);
});

eventUpdateWorker.on('failed', (job, err) => {
  console.error(`[WORKER] event-update-notification job ${job.id} failed: ${err.message}`);
});

console.log('[WORKER] 🚀 Workers started — listening for jobs...');
console.log('[WORKER]   • booking-confirmation (concurrency: 5)');
console.log('[WORKER]   • event-update-notification (concurrency: 2)');

module.exports = { bookingConfirmationWorker, eventUpdateWorker };
