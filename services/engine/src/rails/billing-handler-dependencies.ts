import { db } from "../db/client.js";
import { DrizzleSubscriptionRepository } from "../db/drizzle-repository.js";
import { createLogger } from "../utils/logger.js";
import { SubscriptionWrapper } from "../wrapper/subscription-wrapper.js";
import { BillingHandler } from "./billing-handler.js";
import { MockNombaClient } from "./mock-nomba-client.js";
import { RealNombaClient } from "./real-nomba-client.js";
import { RailOrchestrator } from "./orchestrator.js";
import { CascadeCoordinator } from "./cascade-coordinator.js";
import type { NombaClient } from "./nomba-client.js";

const logger = createLogger("billing-handler");

function createNombaClient(): NombaClient {
  console.log(`[NOMBA-CLIENT] Checking env vars: CLIENT_ID=${!!process.env.NOMBA_CLIENT_ID} SECRET=${!!process.env.NOMBA_CLIENT_SECRET} ACCOUNT_ID=${!!process.env.NOMBA_ACCOUNT_ID} BASE_URL=${process.env.NOMBA_BASE_URL || 'default: sandbox'} SUB_ID=${!!process.env.NOMBA_SUB_ACCOUNT_ID}`);
  if (process.env.NOMBA_CLIENT_ID && process.env.NOMBA_CLIENT_SECRET && process.env.NOMBA_ACCOUNT_ID) {
    const baseUrl = process.env.NOMBA_BASE_URL ?? "https://sandbox.nomba.com";
    console.log(`[NOMBA-CLIENT] Using RealNombaClient with baseUrl=${baseUrl}`);
    logger.info("Using RealNombaClient (sandbox)");
    return new RealNombaClient({
      clientId: process.env.NOMBA_CLIENT_ID,
      clientSecret: process.env.NOMBA_CLIENT_SECRET,
      accountId: process.env.NOMBA_ACCOUNT_ID,
      subAccountId: process.env.NOMBA_SUB_ACCOUNT_ID ?? "",
      baseUrl,
    });
  }
  console.log('[NOMBA-CLIENT] Using MockNombaClient - env vars not set');
  logger.info("Using MockNombaClient (no Nomba credentials in env)");
  return new MockNombaClient();
}

let _orchestrator: RailOrchestrator | null = null;

export function getOrchestrator(): RailOrchestrator {
  if (!_orchestrator) {
    const nomba = createNombaClient();
    _orchestrator = new RailOrchestrator({ nomba, logger });
  }
  return _orchestrator;
}

export function createBillingHandler(merchantId: string) {
  const repo = new DrizzleSubscriptionRepository(db, merchantId);
  const wrapper = new SubscriptionWrapper({ repo, logger });

  return new BillingHandler(wrapper, getOrchestrator());
}

export function createCascadeCoordinator(merchantId: string) {
  const repo = new DrizzleSubscriptionRepository(db, merchantId);
  const wrapper = new SubscriptionWrapper({ repo, logger });
  const orchestrator = getOrchestrator();
  const billingHandler = new BillingHandler(wrapper, orchestrator);

  return new CascadeCoordinator({
    billingHandler,
    orchestrator,
    logger,
  });
}
