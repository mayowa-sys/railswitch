import { app } from './app.js';
import { BillingsQueue } from './queues/billings.queue.js';

const PORT = process.env.PORT || 3001;

BillingsQueue.add('process_charge', { customerId: "cus_demo12345", subscriptionId: 'sub_demo12345', merchantId: 'mer_demo12345', planId: 'plan_demo12345', idemKey: 'idem1324' });


app.listen(PORT, () => {
  console.log(`Engine running on port ${PORT}`);
});
