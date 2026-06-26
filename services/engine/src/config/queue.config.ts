import { QueueOptions } from "bullmq";
import { WorkerOptions } from "bullmq";

const isProduction = process.env.NODE_ENV === "production"

export const queueOptions: QueueOptions = {
    connection: {
        url: process.env.REDIS_URL!
    }
};

export const queueConfig = {
  defaultJobOptions: {
    attempts: isProduction ? 3 : 1,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
    },
  },
};

export const workerConfig: WorkerOptions  = {
  connection: queueOptions, 
  removeOnComplete: {count: 0}, 
  removeOnFail: {count: 0},
}