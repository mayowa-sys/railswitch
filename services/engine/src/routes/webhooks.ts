import { Router, type Request, type Response } from 'express';

export const webhooksRouter = Router();

webhooksRouter.post('/nomba', (req: Request, res: Response) => {
  const { event_type, requestId, data: _data } = req.body as {
    event_type: string;
    requestId: string;
    data: Record<string, unknown>;
  };

  if (!event_type || !requestId) {
    res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Missing event_type or requestId' },
    });
    return;
  }

  console.log(
    `[webhook] received event_type=${event_type} requestId=${requestId}`,
  );

  res.status(200).json({ status: 'ok' });
});
