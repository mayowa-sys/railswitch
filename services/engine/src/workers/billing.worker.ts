import { Worker, Job } from "bullmq";
import { createLogger, GlobalLogger } from "../utils/logger";
import { workerConfig } from "../config/queue.config";
import { getDatabase } from "../db/client";
import { InvoicesTable } from "../schema/invoices.schema";
import { MockNombaClient } from "../rails/mock-nomba-client";

export type ProccessJobData = {
  price: number;
  subscriptionId: string;
  merchantId: string;
};

const logger: GlobalLogger = createLogger("Billing Worker");

async function processSubscriptionCharge(job: Job<ProccessJobData>) {
  const db = await getDatabase(job.data.merchantId);
  if (!db) {
    logger.error("Failed in Getting Database Client");
    throw new Error("Getting Database Client Failed");
  }

  // create an invoice
  const data: typeof InvoicesTable.$inferInsert = {
    subscription_id: job.data.subscriptionId, 
    merchant_id: job.data.merchantId, 
    amount: `${job.data.price}`, 
    due_date: (new Date())
  }
  await db.insert(InvoicesTable).values(data);

  const nombaClient = new MockNombaClient();
  const result = await nombaClient.chargeCard("token", job.data.price, "key");
  if (result.status === "succeeded"){
      
  }
  

  logger.info("Finished working");
  return true;
}

const BillingWorker = new Worker(
  "billings",
  async (job: Job) => {
    switch (job.name) {
      case "process_charge": // TODO: change the name of this later on
        processSubscriptionCharge(job);
        break;
      default:
        throw new Error("Job does not exist");
    }
  },
  workerConfig,
);

export const getBillingWorker = () => BillingWorker;
