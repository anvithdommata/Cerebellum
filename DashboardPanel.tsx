import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Brain, Activity, AlertTriangle, Target, ChevronDown, ChevronRight } from 'lucide-react';
import ForwardCurve from './ForwardCurve';

const ENGINE_META: Record<string, { label: string; color: string }> = {
  engine_technical: { label: 'Technical', color: '#a45cf0' },
  engine_fundamental: { label: 'Fundamental', color: '#4dd4f0' },
  engine_government: { label: 'Government', color: '#f0b73c' },
  engine_news: { label: 'News/NLP', color: '#2fd18b' },
  engine_social: { label: 'Social', color: '#f2557f' },
};

interface Prediction {
  horizonDays: number;
  predictedReturnPct: number;
  predictedVolatilityPct: number;
  confidence: number;
  contributions: Record<string, number>;
}
interface EngineOutput {
  engineId: string;
  score: number;
  confidence: number;
}
interface TickerData {
  ticker: string;
  name: string;
  sector: string;
  asOfDate: string | null;
  predictions: Prediction[];
  engineOutputs: EngineOutput[];
}
interface DashboardData {
  engineIds: string[];
  headlineHorizons: number[];
  buckets: string[];
  bucketLabels: Record<string, string>;
  tickers: TickerData[];
  weights: { sector: string; horizon_bucket: string; engine_id: string; current_weight: number }[];
  stats: { mistakeCount: number; predictionCount: number; outcomeCount: number; activeTickers: number };
}

// Google-Finance-style price header ranges. Bars are daily, so "1D" is the
// most-recent bar vs the one before it (i.e. today's move) — a real 1D candle
// chart would need intraday data, which isn't imported. Here 1D is just the
// change readout, which is well-defined on daily closes.
const PRICE_RANGES: { label: string; bars: number | 'ytd' | 'max' }[] = [
  { label: '1D', bars: 1 },
  { label: '5D', bars: 5 },
  { label: '1M', bars: 21 },
  { label: '6M', bars: 126 },
  { label: 'YTD', bars: 'ytd' },
  { label: '1Y', bars: 252 },
  { label: '5Y', bars: 1260 },
  { label: 'Max', bars: 'max' },
];

// Index of the baseline close we measure the change from, for a given range.
function baselineIdx(bars: number | 'ytd' | 'max', candles: { timestamp: string }[]): number {
  const n = candles.length;
  if (bars === 'max') return 0;
  if (bars === 'ytd') {
    const yearStart = `${new Date().getFullYear()}-01-01`;
    for (let i = n - 1; i >= 0; i--) if (candles[i].timestamp < yearStart) return i;
    return 0; // every bar is from this year
  }
  return Math.max(0, n - 1 - bars);
}

function TickerCard({ data }: { data: TickerData }) {
  const [expanded, setExpanded] = useState(false);

  if (!data.asOfDate || data.predictions.length === 0) {
    return (
      <div className="bg-surface border border-line rounded-lg p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-lg text-white">{data.ticker}</h3>
          <span className="text-xs text-ink-faint">no prediction yet</span>
        </div>
        <p className="text-sm text-ink-dim mt-1">{data.name}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-5 flex flex-col gap-4">
      {/* header: ticker/name on the left, live price + selected-range change on the right */}
      <PriceCardHeader data={data} />

      {/* Forward curve */}
      <div className="border-t border-line pt-4">
        <ForwardCurve ticker={data.ticker} />
      </div>

      {/* Engine signals — collapsed by default to keep cards clean */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-faint hover:text-ink-dim font-mono transition-colors w-fit"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Engine signals
      </button>
      {expanded && (
        <div className="space-y-1.5">
          {data.engineOutputs.map((e) => {
            const meta = ENGINE_META[e.engineId] ?? { label: e.engineId, color: '#64748b' };
            const widthPct = Math.abs(e.score) * 50;
            const positive = e.score >= 0;
            return (
              <div key={e.engineId} className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-ink-dim w-24 shrink-0">{meta.label}</span>
                <div className="flex-1 h-4 bg-void/80 rounded-sm relative overflow-hidden">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-line-bright" />
                  <div
                    className="absolute top-0 bottom-0"
                    style={{
                      width: `${widthPct}%`,
                      left: positive ? '50%' : `${50 - widthPct}%`,
                      backgroundColor: meta.color,
                      opacity: 0.25 + e.confidence * 0.75,
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-ink-dim w-10 text-right">{e.score.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Self-contained header: fetches candles, shows current price + per-range
// change (Google-style), with the range tabs on their own row underneath.
function PriceCardHeader({ data }: { data: TickerData }) {
  const [candles, setCandles] = useState<{ timestamp: string; close: number }[]>([]);
  const [range, setRange] = useState('1Y');

  useEffect(() => {
    let dead = false;
    fetch(`/api/candles/${data.ticker}?limit=2000`)
      .then((r) => r.json())
      .then((d) => !dead && setCandles((d.candles ?? []).map((c: any) => ({ timestamp: c.timestamp, close: c.close }))))
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [data.ticker]);

  const pv = useMemo(() => {
    if (candles.length < 2) return null;
    const last = candles[candles.length - 1].close;
    const def = PRICE_RANGES.find((r) => r.label === range)!;
    const base = candles[baselineIdx(def.bars, candles)].close;
    if (!base) return { price: last, chgPct: null as number | null, chgAbs: null as number | null };
    const chgAbs = last - base;
    return { price: last, chgPct: (chgAbs / base) * 100, chgAbs };
  }, [candles, range]);

  const up = pv?.chgPct != null && pv.chgPct > 0;
  const down = pv?.chgPct != null && pv.chgPct < 0;
  const suffix = range === '1D' ? 'today' : range;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-mono text-lg text-white">{data.ticker}</h3>
          <p className="text-xs text-ink-dim truncate max-w-[240px]">{data.name}</p>
        </div>

        {pv && (
          <div className="text-right shrink-0">
            <div className="font-mono text-lg text-white leading-none">
              {pv.price.toFixed(2)}
              <span className="text-[10px] text-ink-faint ml-1">USD</span>
            </div>
            {pv.chgPct != null && (
              <div className="flex items-center justify-end gap-1.5 mt-1.5">
                <span
                  className={`inline-flex items-center gap-0.5 text-[11px] font-mono px-1.5 py-0.5 rounded ${
                    up ? 'bg-up/15 text-up' : down ? 'bg-down/15 text-down' : 'text-ink-dim'
                  }`}
                >
                  {up ? <TrendingUp className="w-3 h-3" /> : down ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  {pv.chgPct >= 0 ? '+' : ''}
                  {pv.chgPct.toFixed(2)}%
                </span>
                <span className={`text-[11px] font-mono ${up ? 'text-up' : down ? 'text-down' : 'text-ink-dim'}`}>
                  {pv.chgAbs! >= 0 ? '+' : ''}
                  {pv.chgAbs!.toFixed(2)} · {suffix}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* range tabs + sector */}
      <div className="flex items-center gap-1 flex-wrap mt-2">
        {PRICE_RANGES.map((r) => (
          <button
            key={r.label}
            onClick={() => setRange(r.label)}
            className={`text-[11px] font-mono px-2 py-0.5 rounded transition-colors ${
              range === r.label ? 'bg-surface-3 text-ink' : 'text-ink-faint hover:text-ink-dim'
            }`}
          >
            {r.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] font-mono text-ink-faint uppercase tracking-wide">{data.sector}</span>
      </div>
    </div>
  );
}

function WeightPanel({ data }: { data: DashboardData }) {
  const [open, setOpen] = useState(false);
  const sectors = Array.from(new Set(data.weights.map((w) => w.sector)));
  if (sectors.length === 0) return null;

  return (
    <div className="bg-surface border border-line rounded-lg p-5">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left">
        {open ? <ChevronDown className="w-4 h-4 text-ink-dim" /> : <ChevronRight className="w-4 h-4 text-ink-dim" />}
        <Brain className="w-4 h-4 text-ink-dim" />
        <h3 className="font-mono text-sm text-white">Deep Cerebellar Nuclei — engine weights by horizon</h3>
      </button>

      {open && (
        <div className="mt-4 space-y-6">
          {sectors.map((sector) => (
            <div key={sector}>
              <div className="text-xs font-mono text-ink-dim mb-3">{sector}</div>
              <div className="space-y-4">
                {data.buckets.map((bucket) => {
                  const bw = data.weights.filter((w) => w.sector === sector && w.horizon_bucket === bucket);
                  if (bw.length === 0) return null;
                  return (
                    <div key={bucket}>
                      <div className="text-[10px] font-mono text-ink-faint mb-1.5">{data.bucketLabels[bucket] ?? bucket}</div>
                      <div className="flex h-5 rounded-sm overflow-hidden bg-void">
                        {bw
                          .sort((a, b) => b.current_weight - a.current_weight)
                          .map((w) => {
                            const meta = ENGINE_META[w.engine_id] ?? { label: w.engine_id, color: '#64748b' };
                            return (
                              <div
                                key={w.engine_id}
                                title={`${meta.label}: ${(w.current_weight * 100).toFixed(1)}%`}
                                style={{ width: `${w.current_weight * 100}%`, backgroundColor: meta.color, opacity: 0.6 }}
                                className="flex items-center justify-center"
                              >
                                {w.current_weight > 0.12 && (
                                  <span className="text-[9px] font-mono text-white/90">{(w.current_weight * 100).toFixed(0)}%</span>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-3 pt-1">
            {Object.entries(ENGINE_META).map(([id, m]) => (
              <div key={id} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: m.color, opacity: 0.6 }} />
                <span className="text-[10px] font-mono text-ink-dim">{m.label}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-ink-faint leading-relaxed">
            Short horizons lean on price action (Kronos); long horizons lean on fundamentals and policy. Weights start from
            these priors and are re-learned per bucket as predictions mature and get scored (Synaptic Plasticity).
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: number | string; hint?: string }) {
  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-center gap-2 text-ink-dim mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-[11px] uppercase tracking-wide font-mono">{label}</span>
      </div>
      <div className="text-2xl font-mono text-white">{value}</div>
      {hint && <div className="text-[11px] text-ink-faint mt-1">{hint}</div>}
    </div>
  );
}

export default function DashboardPanel() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch('/api/dashboard');
      setData(await res.json());
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="text-ink-dim font-mono text-sm py-12 text-center">Loading dashboard...</div>;
  if (!data) return <div className="text-down font-mono text-sm py-12 text-center">Failed to load dashboard.</div>;

  const withPredictions = data.tickers.filter((t) => t.predictions.length > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Target} label="Active Tickers" value={data.stats.activeTickers} />
        <StatCard icon={Activity} label="Predictions" value={data.stats.predictionCount.toLocaleString()} />
        <StatCard icon={Brain} label="Outcomes Scored" value={data.stats.outcomeCount.toLocaleString()} hint="matured & evaluated" />
        <StatCard icon={AlertTriangle} label="Mistake Journal" value={data.stats.mistakeCount} hint=">3σ misses logged" />
      </div>

      <WeightPanel data={data} />

      <div>
        <h3 className="font-mono text-sm text-ink-dim mb-3">Latest predictions ({withPredictions.length} tickers)</h3>
        {withPredictions.length === 0 ? (
          <div className="bg-surface border border-line rounded-lg p-8 text-center">
            <p className="text-ink-dim font-mono text-sm">No predictions yet.</p>
            <p className="text-ink-faint text-xs mt-2">Add tickers in the Tickers tab, then trigger the PIPELINE.</p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {withPredictions.map((t) => (
              <TickerCard key={t.ticker} data={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
