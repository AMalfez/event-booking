require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 3000;

const start = async () => {
  await connectDB();

  // Optionally start workers in-process in development.
  // In production, run workers as a separate process: `npm run worker`
  if (process.env.NODE_ENV !== 'production') {
    require('./workers/index');
  }

  app.listen(PORT, () => {
    console.log(`[SERVER] 🚀 Running on http://localhost:${PORT}`);
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

start();
