import { db } from "../db/client.js";
import { DrizzleSubscriptionRepository } from "../db/drizzle-repository.js";
import { createLogger } from "../utils/logger.js";
import { SubscriptionWrapper } from "../wrapper/subscription-wrapper.js";
import { BillingHandler } from "./billing-handler.js";
import { MockNombaClient } from "./mock-nomba-client.js";
import { RealNombaClient } from "./real-nomba-client.js";
import { RailOrchestrator } from "./orchestrator.js";
import type { NombaClient } from "./nomba-client.js";

const logger = createLogger("billing-handler");

function createNombaClient(): NombaClient {
  if (process.env.NOMBA_CLIENT_ID && process.env.NOMBA_CLIENT_SECRET && process.env.NOMBA_ACCOUNT_ID) {
    logger.info("Using RealNombaClient (sandbox)");
    return new RealNombaClient({
      clientId: process.env.NOMBA_CLIENT_ID,
      clientSecret: process.env.NOMBA_CLIENT_SECRET,
      accountId: process.env.NOMBA_ACCOUNT_ID,
      baseUrl: process.env.NOMBA_BASE_URL ?? "https://sandbox.nomba.com",
    });
  }
  logger.info("Using MockNombaClient (no Nomba credentials in env)");
  return new MockNombaClient();
}

const nomba = createNombaClient();
const orchestrator = new RailOrchestrator({ nomba, logger });

export function createBillingHandler(merchantId: string) {
  const repo = new DrizzleSubscriptionRepository(db, merchantId);
  const wrapper = new SubscriptionWrapper({ repo, logger });

  return new BillingHandler(wrapper, orchestrator);
}
