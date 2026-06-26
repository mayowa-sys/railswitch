import { Queue } from 'bullmq';
import { queueOptions } from '../config/queue.config';
import { createBillingHandler } from '../rails/billing-handler-dependencies';

export const BillingsQueue = new Queue('billings', queueOptions);

// add a job to poll the subscriptions table and get the all the pending subscriptions, and schedule them to be paid
// run at minute 0 of every hour
BillingsQueue.add('poll_subscriptions', {}, { repeat: { pattern: '0 * * * *' } });
export const billingHandler = createBillingHandler();