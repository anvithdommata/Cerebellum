import dotenv from 'dotenv';
import path from 'path';
// Load .env first, then .env.local on top (matches the file the in-app
// Settings tab writes to) so locally-saved keys always take precedence.
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env.local'), override: true });

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { startIngestionJobs } from './src/server/ingestion/scheduler.js';
import { getIngestionStatus, triggerIngestion } from './src/server/ingestion/status.js';
import { apiRouter } from './src/server/api/routes.js';
import { settingsRouter } from './src/server/settings/routes.js';
import { rebaseKronosWeights } from './src/server/metamodel/weights.js';

async function startServer() {
  rebaseKronosWeights();
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/ingestion/status', (req, res) => {
    res.json(getIngestionStatus());
  });

  app.post('/api/ingestion/trigger/:source', (req, res) => {
    const source = req.params.source;
    triggerIngestion(source);
    res.json({ message: `Triggered ingestion for ${source}` });
  });

  app.use('/api', apiRouter);
  app.use('/api/settings', settingsRouter);

  // Start background jobs
  startIngestionJobs();

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
