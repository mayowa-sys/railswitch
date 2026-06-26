import { app } from './app.js';
import { BillingsQueue } from './queues.js';

const PORT = process.env.PORT || 3001;

BillingsQueue.add('process_charge', { price: 30, subscriptionId: 'sub_123', merchantId: 'mer_243' });


app.listen(PORT, () => {
  console.log(`Engine running on port ${PORT}`);
});
