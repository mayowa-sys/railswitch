import { app } from './app.js';
import './workers/billing.worker.js';
import { retryPendingDeliveries } from './webhooks/emitter.js';

const PORT = process.env.PORT || 3001;

// Retry pending webhook deliveries every 5 minutes
setInterval(() => {
  retryPendingDeliveries().catch(err => console.error('[webhook-retry] error:', err));
}, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Engine running on port ${PORT}`);
});
