import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'engine' });
});

app.listen(PORT, () => {
  console.log(`Engine running on port ${PORT}`);
});
