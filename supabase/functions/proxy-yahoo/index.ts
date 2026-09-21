import { corsHeaders, preflightResponse } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const RATE_LIMIT_PER_MIN = 30;

const INTERVAL_MAP: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '60m',
  '4h': '4h',
  '1d': '1d',
};

const REQUEST_TIMEOUT_MS = 10_000;
const CHART_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

interface CrumbBundle {
  crumb: string;
  cookie: string;
  fetchedAt: number;
}

let cachedCrumb: CrumbBundle | null = null;
const CRUMB_TTL_MS = 10 * 60 * 1000;

async function fetchCrumbBundle(): Promise<CrumbBundle | null> {
  if (cachedCrumb && Date.now() - cachedCrumb.fetchedAt < CRUMB_TTL_MS) {
    return cachedCrumb;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch('https://finance.yahoo.com', {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    clearTimeout(timer);

    const setCookies = res.headers.getSetCookie?.() ?? [];
    if (setCookies.length === 0) return null;
    const cookie = setCookies.map((c: string) => c.split(';')[0]).join('; ');

    const crumbController = new AbortController();
    const crumbTimer = setTimeout(() => crumbController.abort(), REQUEST_TIMEOUT_MS);
    try {
      const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
        signal: crumbController.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': cookie,
        },
      });
      clearTimeout(crumbTimer);

      if (!crumbRes.ok) return null;
      const crumb = (await crumbRes.text()).trim();
      if (!crumb) return null;

      cachedCrumb = { crumb, cookie, fetchedAt: Date.now() };
      return cachedCrumb;
    } finally {
      clearTimeout(crumbTimer);
    }
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function fetchChart(symbol: string, interval: string, range: string): Promise<{ ok: boolean; status: number; data: unknown }> {
  const crumbBundle = await fetchCrumbBundle();
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  ...(crumbBundle ? { 'Cookie': crumbBundle.cookie } : {}),
  };

  for (const host of CHART_HOSTS) {
    const url = crumbBundle
      ? `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&crumb=${encodeURIComponent(crumbBundle.crumb)}`
      : `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, headers });
      clearTimeout(timer);
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } catch {
      clearTimeout(timer);
    }
  }

  return { ok: false, status: 502, data: { error: 'All Yahoo hosts failed' } };
}

Deno.serve(async (req: Request) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const clientKey = req.headers.get('X-Client-Key') ?? 'anonymous';

    const allowed = await checkRateLimit(clientKey, 'proxy-yahoo', RATE_LIMIT_PER_MIN);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Max 30 requests per minute.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json();
    const { symbol, timeframe, range } = body as {
      symbol?: string;
      timeframe?: string;
      range?: string;
    };

    if (!symbol || !timeframe) {
      return new Response(
        JSON.stringify({ error: 'symbol and timeframe are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const interval = INTERVAL_MAP[timeframe];
    if (!interval) {
      return new Response(
        JSON.stringify({ error: `Unsupported timeframe: ${timeframe}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const yahooSymbol = symbol.includes('=') ? symbol : `${symbol}=X`;
    const result = await fetchChart(yahooSymbol, interval, range ?? '1mo');

    return new Response(JSON.stringify(result.data), {
      status: result.ok ? 200 : result.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
