import { db } from '../db/client.js';
import { DrizzleSubscriptionRepository } from '../db/drizzle-repository.js';
import { createLogger } from '../utils/logger.js';
import { SubscriptionWrapper } from '../wrapper/subscription-wrapper.js';
import { BillingHandler } from './billing-handler.js';
import { MockNombaClient } from './mock-nomba-client.js';
import { RailOrchestrator } from './orchestrator.js';

export function createBillingHandler() {
  const merchantId = process.env.DEFAULT_MERCHANT_ID ?? 'default_merchant';
  const logger = createLogger('billing-handler');
  const repo = new DrizzleSubscriptionRepository(db, merchantId);
  const wrapper = new SubscriptionWrapper({ repo, logger });
  const nomba = new MockNombaClient();
  const orchestrator = new RailOrchestrator({ nomba, logger });

  return new BillingHandler(wrapper, orchestrator);
}
