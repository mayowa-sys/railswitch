import { Queue } from "bullmq"
import { queueOptions } from "./config/queue.config"

export const BillingsQueue = new Queue("billings", queueOptions);