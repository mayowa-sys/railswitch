import { app } from './app.js';
import './workers/billing.worker.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Engine running on port ${PORT}`);
});
