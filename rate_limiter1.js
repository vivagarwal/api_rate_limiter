//sliding window algorithm
const Redis = require("ioredis");
const moment = require("moment");
const redisClient = new Redis({ url: "redis://localhost:6379" });

const RATELIMIT_DURATION_IN_SECONDS = 60;
const NUMBER_OF_REQUEST_ALLOWED = 5;

const ratelimiter = async (req, res, next) => {
  const userId = req.headers["user_id"]; 
  if (!userId) {
    return res.status(400).json({ message: "Missing user_id in headers" });
  }

  const currentTime = moment().unix(); 
  const result = await redisClient.hgetall(userId);

  if (Object.keys(result).length === 0) {
    let timestampArray = [];
    timestampArray.push(currentTime);
    await redisClient.hset(userId, "createdAt", JSON.stringify(timestampArray), "count", 1);
    //await redisClient.expire(userId, RATELIMIT_DURATION_IN_SECONDS + 20);
    return next();
  }

  if (result) {
    const existingArray = JSON.parse(result["createdAt"]);
    let timestampArray = [...existingArray]; // Copy to avoid mutating original array

    // Remove timestamps outside the valid window
    timestampArray = timestampArray.filter(
      (timestamp) => currentTime - timestamp <= RATELIMIT_DURATION_IN_SECONDS
    );

    if (timestampArray.length >= NUMBER_OF_REQUEST_ALLOWED) {
      return res.status(429).json({ message: "Too many incoming requests" });
    }

    // Add the current request's timestamp and update the count
    timestampArray.push(currentTime);
    await redisClient.hset(
      userId,
      "createdAt",
      JSON.stringify(timestampArray),
      "count",
      timestampArray.length
    );
    //await redisClient.expire(userId, RATELIMIT_DURATION_IN_SECONDS + 20); // Reset expiration
    return next();
  }

  return res.status(500).json({ message: "Unexpected error occurred" });
};

module.exports = ratelimiter;
