import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'engine' });
});

app.listen(PORT, () => {
  console.log(`Engine running on port ${PORT}`);
});
