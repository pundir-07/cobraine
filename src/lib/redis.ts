import { createClient } from "redis";

const redis = createClient({
    url: process.env.REDIS_SERVER_URL ?? "redis://127.0.0.1:6379",
});

redis.on("error", (error) => {
    console.error("Redis Error:", error);
});

export async function connectRedis() {
    if (!redis.isOpen) {
        await redis.connect();
    }

    return redis;
}

export async function disconnectRedis() {
    if (redis.isOpen) {
        await redis.close();
    }
}
