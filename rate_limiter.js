//fixed window algorithm
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
    await redisClient.hset(userId, "createdAt", currentTime, "count", 1);
    return next();
  }

  if (result) {
    const diff = currentTime - result["createdAt"];
    if (diff > RATELIMIT_DURATION_IN_SECONDS) {
      await redisClient.hset(userId, "createdAt", currentTime, "count", 1);
      return next();
    }
  }

  if (parseInt(result["count"], 10) >= NUMBER_OF_REQUEST_ALLOWED) {
    return res.status(429).json({ message: "Too many incoming requests" });
  } else {
    await redisClient.hset(userId, "count", parseInt(result["count"], 10) + 1);
    return next();
  }
};

module.exports = ratelimiter;
