# Cerebellum Ingestion Terminal - Project Context

## Overview
This project is a real-time data ingestion terminal designed to monitor and process data from various sources (Mossy Fibers) into a central repository. It currently implements a Node.js backend with an Express server and a React frontend, monitoring four primary data sources:
- **SEC EDGAR**: Corporate filings and financial reports.
- **FMP (Financial Modeling Prep)**: Fundamental stock data (Balance Sheets, Income Statements).
- **SAM.gov**: Government contract awards.
- **Congress**: US Legislative bills.

## Current Tech Stack
- **Frontend**: React 19, Tailwind CSS, Vite, Lucide React (Icons).
- **Backend**: Node.js, Express.js, TypeScript.
- **Scheduling/Rate Limiting**: `node-cron` for background jobs, custom Token Bucket rate limiter.
- **Build Tooling**: `esbuild`, `tsx`.

## Planned Additions & PyTorch Integration
You are planning to implement **PyTorch** for advanced machine learning, neural networks, or NLP tasks on the ingested data. Since PyTorch is a Python library, the following architectural paths can be taken when exporting this context:
1. **Python Microservice Architecture**: Keep this Node.js app as the data ingestion/routing layer, and build a separate Python API (using FastAPI or Flask) that runs PyTorch models. The Node.js app can send the ingested data to the Python service for inference.
2. **Full Python Rewrite**: Use this exported code as a blueprint to rewrite the ingestion pipelines and backend in Python (e.g., using `apscheduler` instead of `node-cron`, `httpx` instead of `fetch`, and `FastAPI` instead of `Express`). This consolidates the stack, making it easier to directly pass data tensors to PyTorch models.

---

## Codebase Export

### src/App.tsx

```
import { useEffect, useState } from 'react';
import { Activity, Database, FileText, Globe, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

interface IngestionState {
  status: 'idle' | 'running' | 'error';
  lastMessage: string;
  lastUpdated: string;
}

type StatusMap = Record<string, IngestionState>;

export default function App() {
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/ingestion/status');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        setStatuses(data);
      } catch (parseError) {
        console.error('Failed to parse JSON. Response was:', text.substring(0, 100));
      }
    } catch (e) {
      console.error('Error fetching status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const trigger = async (source: string) => {
    try {
      const res = await fetch(`/api/ingestion/trigger/${source}`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      await res.json();
    } catch (e) {
      console.error(`Error triggering ${source}:`, e);
    }
    fetchStatus();
  };

  const getIcon = (source: string) => {
    switch(source) {
      case 'SEC': return <FileText className="w-5 h-5 text-slate-400" />;
      case 'FMP': return <Activity className="w-5 h-5 text-slate-400" />;
      case 'SAM': return <Globe className="w-5 h-5 text-slate-400" />;
      case 'CONGRESS': return <Database className="w-5 h-5 text-slate-400" />;
      default: return <Database className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2 font-mono">Cerebellum Ingestion Terminal</h1>
          <p className="text-slate-400">Monitoring real-time data pipelines (Mossy Fibers) across all active signal sources.</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(statuses).map(([source, state]) => (
            <div key={source} className="bg-slate-900 border border-slate-800 rounded-lg p-6 relative overflow-hidden flex flex-col justify-between min-h-[160px]">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  {getIcon(source)}
                  <h2 className="text-xl font-medium font-mono">{source}</h2>
                </div>
                <div>
                  {state.status === 'running' && <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />}
                  {state.status === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                  {state.status === 'idle' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
                </div>
              </div>

              <div className="flex-1">
                <p className="text-sm font-mono text-slate-300 break-words">{state.lastMessage}</p>
                <p className="text-xs text-slate-500 mt-2 font-mono">
                  Updated: {new Date(state.lastUpdated).toLocaleTimeString()}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => trigger(source)}
                  disabled={state.status === 'running'}
                  className="text-xs font-mono px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {state.status === 'running' ? 'INGESTING...' : 'MANUAL TRIGGER'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

```

## src/index.css

```
@import "tailwindcss";

```

## src/main.tsx

```
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

```

## src/server/ingestion/congressClient.ts

```
import { updateIngestionStatus } from './status.js';

export async function runCongressIngestion() {
  updateIngestionStatus('CONGRESS', 'running', 'Starting US Congress API ingestion cycle...');
  
  const apiKey = process.env.CONGRESS_API_KEY;
  if (!apiKey) {
    updateIngestionStatus('CONGRESS', 'error', 'Missing CONGRESS_API_KEY in environment variables.');
    return;
  }

  try {
    updateIngestionStatus('CONGRESS', 'running', `Fetching recent legislative bills...`);
    
    const response = await fetch(`https://api.congress.gov/v3/bill?api_key=${apiKey}&limit=10`);
    
    if (!response.ok) {
       throw new Error(`Congress API error: ${response.status}`);
    }
    
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch(e) {
      throw new Error(`Invalid JSON: ${text.substring(0, 50)}`);
    }
    
    const count = data.bills ? data.bills.length : 0;
    
    updateIngestionStatus('CONGRESS', 'idle', `Successfully parsed ${count} new legislative bills.`);
  } catch (error: any) {
    updateIngestionStatus('CONGRESS', 'error', `Failed Congress ingestion cycle: ${error.message}`);
  }
}

```

## src/server/ingestion/fmpClient.ts

```
import { updateIngestionStatus } from './status.js';

export async function runFMPIngestion() {
  updateIngestionStatus('FMP', 'running', 'Starting FMP (Financial Modeling Prep) ingestion cycle...');
  
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    updateIngestionStatus('FMP', 'error', 'Missing FMP_API_KEY in environment variables.');
    return;
  }

  const targetTickers = ['PLTR', 'NVDA'];
  let processed = 0;

  try {
    for (const ticker of targetTickers) {
      updateIngestionStatus('FMP', 'running', `Fetching fundamentals for ${ticker}...`);
      
      try {
        const response = await fetch(`https://financialmodelingprep.com/api/v3/balance-sheet-statement/${ticker}?period=quarter&limit=1&apikey=${apiKey}`);
        
        if (!response.ok) {
           throw new Error(`FMP API error: ${response.status}`);
        }
        
        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch(e) {
          throw new Error(`Invalid JSON: ${text.substring(0, 50)}`);
        }

        if (data && data.length > 0) {
          processed++;
          updateIngestionStatus('FMP', 'running', `Ingested Q${data[0].period} ${data[0].calendarYear} balance sheet for ${ticker}.`);
        }
      } catch (err: any) {
        console.warn(`[FMP Ingestion] Failed to fetch ticker ${ticker}: ${err.message}`);
      }
    }

    updateIngestionStatus('FMP', 'idle', `Successfully processed ${processed} fundamental reports.`);
  } catch (error: any) {
    updateIngestionStatus('FMP', 'error', `Failed FMP ingestion cycle: ${error.message}`);
  }
}

```

## src/server/ingestion/rateLimiter.ts

```
export class TokenBucketLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // Tokens per millisecond
  private lastRefillTimestamp: number;

  constructor(maxTokens: number, refillRatePerMin: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRatePerMin / 60000;
    this.lastRefillTimestamp = Date.now();
  }

  public async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const delay = (1 - this.tokens) / this.refillRate;
    await new Promise((resolve) => setTimeout(resolve, delay));
    this.refill();
    this.tokens -= 1;
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefillTimestamp;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefillTimestamp = now;
  }
}

```

## src/server/ingestion/samClient.ts

```
import { updateIngestionStatus } from './status.js';

export async function runSAMIngestion() {
  updateIngestionStatus('SAM', 'running', 'Starting SAM.gov contract ingestion cycle...');
  
  const apiKey = process.env.SAM_API_KEY;
  if (!apiKey) {
    updateIngestionStatus('SAM', 'error', 'Missing SAM_API_KEY in environment variables.');
    return;
  }

  try {
    updateIngestionStatus('SAM', 'running', `Fetching recent contract awards from SAM.gov...`);
    
    const response = await fetch(`https://api.sam.gov/contract-awards/v1/search?api_key=${apiKey}&limit=10`);
    
    if (!response.ok) {
       let errorMsg = `SAM API error: ${response.status}`;
       try {
         const errorText = await response.text();
         if (errorText) errorMsg += ` - ${errorText.substring(0, 100)}`;
       } catch (e) {}
       throw new Error(errorMsg);
    }
    
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON response: ${text.substring(0, 50)}`);
    }

    const count = data.awardSummary ? data.awardSummary.length : 0;
    
    updateIngestionStatus('SAM', 'idle', `Successfully parsed ${count} new government contracts.`);
  } catch (error: any) {
    updateIngestionStatus('SAM', 'error', `Failed SAM ingestion cycle: ${error.message}`);
  }
}

```

## src/server/ingestion/scheduler.ts

```
import cron from 'node-cron';
import { triggerIngestion, updateIngestionStatus } from './status.js';

export function startIngestionJobs() {
  console.log('Starting ingestion background jobs...');

  // SEC EDGAR - High frequency polling (every 5 minutes for demo)
  cron.schedule('*/5 * * * *', async () => {
    await triggerIngestion('SEC');
  });

  // FMP - End of Day (6 PM UTC for demo)
  cron.schedule('0 18 * * *', async () => {
    await triggerIngestion('FMP');
  });

  // SAM.gov - Daily Batch (Midnight UTC)
  cron.schedule('0 0 * * *', async () => {
    await triggerIngestion('SAM');
  });

  // Congress - Daily (1 AM UTC)
  cron.schedule('0 1 * * *', async () => {
    await triggerIngestion('CONGRESS');
  });

  updateIngestionStatus('SEC', 'idle', 'Cron scheduler initialized.');
  updateIngestionStatus('FMP', 'idle', 'Cron scheduler initialized.');
  updateIngestionStatus('SAM', 'idle', 'Cron scheduler initialized.');
  updateIngestionStatus('CONGRESS', 'idle', 'Cron scheduler initialized.');
}

```

## src/server/ingestion/secClient.ts

```
import { TokenBucketLimiter } from './rateLimiter.js';
import { updateIngestionStatus } from './status.js';

// SEC max limit is 10 requests per second
const secLimiter = new TokenBucketLimiter(10, 600); // 600 per min = 10 per sec

export async function runSECIngestion() {
  updateIngestionStatus('SEC', 'running', 'Starting SEC EDGAR ingestion cycle...');
  
  // Hardcoded CIKs for MVP demo (e.g., PLTR: 0001321655, NVDA: 0001045810)
  const targetCIKs = ['0001321655', '0001045810'];
  let processed = 0;

  try {
    for (const cik of targetCIKs) {
      updateIngestionStatus('SEC', 'running', `Acquiring rate limit token for CIK ${cik}...`);
      await secLimiter.acquire();
      
      updateIngestionStatus('SEC', 'running', `Fetching data for CIK ${cik}...`);
      
      // We wrap the fetch in a try-catch to simulate without blowing up if no internet or bad agent
      try {
        const response = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
          headers: {
            'User-Agent': 'CerebellumResearch anvith077@gmail.com',
          }
        });

        if (!response.ok) {
          if (response.status === 429) {
             updateIngestionStatus('SEC', 'running', `Rate limited by SEC for CIK ${cik}, applying backoff...`);
             await new Promise(r => setTimeout(r, 2000));
             continue; // Skip for now
          }
          throw new Error(`SEC API error: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch(e) {
          throw new Error(`Invalid JSON: ${text.substring(0, 50)}`);
        }

        processed++;
        updateIngestionStatus('SEC', 'running', `Parsed filing for CIK ${cik} (Name: ${data.name})`);
        
      } catch (err: any) {
        console.warn(`[SEC Ingestion] Failed to fetch CIK ${cik}: ${err.message}`);
      }
    }

    updateIngestionStatus('SEC', 'idle', `Successfully processed ${processed} SEC filings.`);
  } catch (error: any) {
    updateIngestionStatus('SEC', 'error', `Failed SEC ingestion cycle: ${error.message}`);
  }
}

```

## src/server/ingestion/status.ts

```
import { runSECIngestion } from './secClient.js';
import { runFMPIngestion } from './fmpClient.js';
import { runSAMIngestion } from './samClient.js';
import { runCongressIngestion } from './congressClient.js';

export interface IngestionState {
  status: 'idle' | 'running' | 'error';
  lastMessage: string;
  lastUpdated: string;
}

const statusStore: Record<string, IngestionState> = {
  SEC: { status: 'idle', lastMessage: 'Waiting to start...', lastUpdated: new Date().toISOString() },
  FMP: { status: 'idle', lastMessage: 'Waiting to start...', lastUpdated: new Date().toISOString() },
  SAM: { status: 'idle', lastMessage: 'Waiting to start...', lastUpdated: new Date().toISOString() },
  CONGRESS: { status: 'idle', lastMessage: 'Waiting to start...', lastUpdated: new Date().toISOString() },
};

export function updateIngestionStatus(source: string, status: 'idle' | 'running' | 'error', message: string) {
  if (statusStore[source]) {
    statusStore[source] = {
      status,
      lastMessage: message,
      lastUpdated: new Date().toISOString(),
    };
    console.log(`[INGESTION - ${source}] [${status}] ${message}`);
  }
}

export function getIngestionStatus() {
  return statusStore;
}

export async function triggerIngestion(source: string) {
  const normalizedSource = source.toUpperCase();
  if (statusStore[normalizedSource] && statusStore[normalizedSource].status === 'running') {
    return; // Already running
  }
  
  try {
    switch(normalizedSource) {
      case 'SEC':
        await runSECIngestion();
        break;
      case 'FMP':
        await runFMPIngestion();
        break;
      case 'SAM':
        await runSAMIngestion();
        break;
      case 'CONGRESS':
        await runCongressIngestion();
        break;
      default:
        console.warn(`Unknown ingestion source triggered: ${source}`);
    }
  } catch(err: any) {
    console.error(`Ingestion error for ${source}:`, err);
  }
}

```

## package.json

```
{
  "name": "react-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
    "start": "node dist/server.cjs",
    "clean": "rm -rf dist server.js",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@google/genai": "^2.4.0",
    "@tailwindcss/vite": "^4.1.14",
    "@types/node-cron": "^3.0.11",
    "@vitejs/plugin-react": "^5.0.4",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "lucide-react": "^0.546.0",
    "motion": "^12.23.24",
    "node-cron": "^4.5.0",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "vite": "^6.2.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.14.0",
    "autoprefixer": "^10.4.21",
    "esbuild": "^0.25.0",
    "tailwindcss": "^4.1.14",
    "tsx": "^4.21.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.3"
  }
}

```

## .env.example

```
# GEMINI_API_KEY: Required for Gemini AI API calls.
# AI Studio automatically injects this at runtime from user secrets.
# Users configure this via the Secrets panel in the AI Studio UI.
GEMINI_API_KEY="MY_GEMINI_API_KEY"

# APP_URL: The URL where this applet is hosted.
# AI Studio automatically injects this at runtime with the Cloud Run service URL.
# Used for self-referential links, OAuth callbacks, and API endpoints.
APP_URL="MY_APP_URL"

# Data Ingestion API Keys
FMP_API_KEY="oWfEEKpGyP2veY4Zp3UDXAAVSzuBWu6m"
SAM_API_KEY=""
CONGRESS_API_KEY=""
SEC_USER_AGENT=""

```

## vite.config.ts

```
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

```

## tsconfig.json

```
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": [
        "./*"
      ]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}

```

## server.ts

```
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { startIngestionJobs } from './src/server/ingestion/scheduler.js';
import { getIngestionStatus, triggerIngestion } from './src/server/ingestion/status.js';

async function startServer() {
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

```

## index.html

```
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Google AI Studio App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>


```

