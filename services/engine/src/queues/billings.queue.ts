import { Queue } from 'bullmq';
import { queueOptions } from '../config/queue.config.js';

let BillingsQueue: Queue | null = null;

if (process.env.REDIS_URL) {
  BillingsQueue = new Queue('billings', queueOptions);
  BillingsQueue.add('poll_subscriptions', {}, { repeat: { pattern: '0 * * * *' } });
}

export { BillingsQueue };
