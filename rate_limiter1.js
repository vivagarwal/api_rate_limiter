const { createClient } = require('redis');
const moment = require('moment');
require('dotenv').config(); // Load environment variables

// Load configuration from environment variables
const RATELIMIT_DURATION_IN_SECONDS = parseInt(process.env.RATELIMIT_DURATION_IN_SECONDS, 10) || 60;
const NUMBER_OF_REQUEST_ALLOWED = parseInt(process.env.NUMBER_OF_REQUEST_ALLOWED, 10) || 5;

// Initialize Redis Client using environment variables
const client = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10),
  },
});

client.on('error', (err) => console.log('Redis Client Error', err));

// Connect Redis Client
(async () => {
  await client.connect();
})();

// Middleware Definition
const ratelimiter = async (req, res, next) => {
  const userId = req.headers['user_id']||req.query.user_id;
  if (!userId) {
    return res.status(400).json({ message: 'Missing user_id in headers or query parameters' });
  }

  const currentTime = moment().unix();
  const result = await client.hGetAll(userId);

  if (Object.keys(result).length === 0) {
    let timestampArray = [];
    timestampArray.push(currentTime);
    await client.hSet(userId, 'createdAt', JSON.stringify(timestampArray), 'count', 1);
    await client.expire(userId, RATELIMIT_DURATION_IN_SECONDS + 10);
    return next();
  }

  if (result) {
    const existingArray = JSON.parse(result['createdAt']);
    let timestampArray = [...existingArray];

    // Remove timestamps outside the valid window
    timestampArray = timestampArray.filter(
      (timestamp) => currentTime - timestamp <= RATELIMIT_DURATION_IN_SECONDS
    );

    if (timestampArray.length >= NUMBER_OF_REQUEST_ALLOWED) {
      return res.status(429).json({ message: 'Too many incoming requests' });
    }

    // Add the current request's timestamp and update the count
    timestampArray.push(currentTime);
    await client.hSet(
      userId,
      'createdAt',
      JSON.stringify(timestampArray),
      'count',
      timestampArray.length
    );
    await client.expire(userId, RATELIMIT_DURATION_IN_SECONDS + 10);
    return next();
  }

  return res.status(500).json({ message: 'Unexpected error occurred' });
};

module.exports = ratelimiter;
