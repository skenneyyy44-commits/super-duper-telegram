import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";
import { TrendingUp, Activity, RefreshCw, Settings, AlertTriangle } from "lucide-react";

async function j(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}
const fmtUSD = (n, d = 0) =>
  n == null || Number.isNaN(n)
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: d,
      }).format(n);
const fmtPct = (n, p = 2) =>
  n == null || Number.isNaN(n) ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(p)}%`;
const toCandles = (kl = []) =>
  (Array.isArray(kl) ? kl : [])
    .map((k) => ({
      time: Math.floor(k[0] / 1000),
      open: +k[1],
      high: +k[2],
      low: +k[3],
      close: +k[4],
    }))
    .filter((x) => Number.isFinite(x.time) && Number.isFinite(x.close));
const toCloses = (kl = []) =>
  (Array.isArray(kl) ? kl : [])
    .map((k) => +k[4])
    .filter(Number.isFinite);

const ema = (series, period) => {
  if (!Array.isArray(series) || series.length === 0) return [];
  const k = 2 / (period + 1);
  let e = series[0];
  const out = [];
  for (let i = 0; i < series.length; i++) {
    e = i ? series[i] * k + e * (1 - k) : series[i];
    out.push(e);
  }
  return out;
};
const rsi = (closes, period = 14) => {
  if (!Array.isArray(closes) || closes.length === 0) return [];
  const out = [50];
  let gains = 0,
    losses = 0;
  for (let i = 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    gains += Math.max(ch, 0);
    losses += Math.max(-ch, 0);
    if (i >= period) {
      gains -= Math.max(closes[i - period + 1] - closes[i - period], 0);
      losses -= Math.max(-(closes[i - period + 1] - closes[i - period]), 0);
      const rs = (gains / period) / ((losses / period) || 1e-9);
      out.push(100 - 100 / (1 + rs));
    } else out.push(50);
  }
  return out;
};
const macd = (closes, fast = 12, slow = 26, signal = 9) => {
  if (!Array.isArray(closes) || closes.length === 0)
    return { line: [], sig: [], hist: [] };
  const ef = ema(closes, fast),
    es = ema(closes, slow);
  const line = ef.map((v, i) => v - (es[i] ?? v));
  const sig = ema(line, signal);
  const hist = line.map((v, i) => v - (sig[i] ?? v));
  return { line, sig, hist };
};

(function () {
  const cs = Array(10).fill(100);
  const e = ema(cs, 5);
  console.assert(
    e.length === 10 && Math.abs(e[e.length - 1] - 100) < 1e-6,
    "EMA constant test failed"
  );
  const up = Array.from({ length: 30 }, (_, i) => i);
  const r = rsi(up, 14);
  console.assert(
    r.length === 30 && r[r.length - 1] > 50,
    "RSI up-trend test failed"
  );
  const m = macd(cs, 12, 26, 9);
  console.assert(
    m.line.length === 10 && Math.abs(m.hist[m.hist.length - 1]) < 1e-6,
    "MACD flat test failed"
  );
})();

function ChartCandle({ data, showEMA20, showEMA50, onReady }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      height: 340,
      layout: { background: { type: "solid", color: "#0f1420" }, textColor: "#d9e2ee" },
      grid: { vertLines: { color: "#1e2633" }, horzLines: { color: "#1e2633" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1e2633" },
      timeScale: { borderColor: "#1e2633" },
    });
    const candles = chart.addCandlestickSeries();
    candles.setData(data.candles || []);
    let ema20Series, ema50Series;
    if (showEMA20 && data.ema20?.length) {
      ema20Series = chart.addLineSeries({ color: "#53a1ff", lineWidth: 2 });
      ema20Series.setData(data.ema20);
    }
    if (showEMA50 && data.ema50?.length) {
      ema50Series = chart.addLineSeries({ color: "#f1c40f", lineWidth: 2 });
      ema50Series.setData(data.ema50);
    }
    chart.timeScale().fitContent();
    if (onReady) onReady(chart);
    return () => chart.remove();
  }, [data, showEMA20, showEMA50]);
  return <div ref={ref} className="w-full rounded-xl border border-slate-700" />;
}

function LinePanel({ series, color = "#9b59b6", height = 110, bands }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      height,
      layout: { background: { type: "solid", color: "#0f1420" }, textColor: "#d9e2ee" },
      grid: { vertLines: { color: "#1e2633" }, horzLines: { color: "#1e2633" } },
      rightPriceScale: { borderColor: "#1e2633" },
      timeScale: { borderColor: "#1e2633" },
    });
    const line = chart.addLineSeries({ color, lineWidth: 2 });
    line.setData(series || []);
    if (bands)
      bands.forEach((b) => {
        const band = chart.addLineSeries({ color: "#273347", lineWidth: 1 });
        band.setData((series || []).map((p) => ({ time: p.time, value: b })));
      });
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [series, color, height]);
  return <div ref={ref} className="w-full rounded-xl border border-slate-700" />;
}

function MacdHistPanel({ series, height = 120 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      height,
      layout: { background: { type: "solid", color: "#0f1420" }, textColor: "#d9e2ee" },
      grid: { vertLines: { color: "#1e2633" }, horzLines: { color: "#1e2633" } },
      rightPriceScale: { borderColor: "#1e2633" },
      timeScale: { borderColor: "#1e2633" },
    });
    const zeros = (series || []).map((p) => ({ time: p.time, value: 0 }));
    const pos = (series || []).map((p) => ({ time: p.time, value: p.value > 0 ? p.value : 0 }));
    const neg = (series || []).map((p) => ({ time: p.time, value: p.value < 0 ? p.value : 0 }));
    const posArea = chart.addAreaSeries({
      topColor: "rgba(46,204,113,0.6)",
      bottomColor: "rgba(46,204,113,0.1)",
      lineColor: "#2ecc71",
      lineWidth: 1,
    });
    posArea.setData(pos);
    const negArea = chart.addAreaSeries({
      topColor: "rgba(231,76,60,0.1)",
      bottomColor: "rgba(231,76,60,0.6)",
      lineColor: "#e74c3c",
      lineWidth: 1,
    });
    negArea.setData(neg);
    const zeroLine = chart.addLineSeries({ color: "#273347", lineWidth: 1 });
    zeroLine.setData(zeros);
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [series, height]);
  return <div ref={ref} className="w-full rounded-xl border border-slate-700" />;
}

export default function Component() {
  const [now, setNow] = useState(() => new Date());
  const [state, setState] = useState({
    price: null,
    chg1h: null,
    chg24h: null,
    funding: null,
    liqs: null,
    headline: null,
    dominance: null,
    fearGreed: null,
  });
  const [series, setSeries] = useState({
    candles: [],
    ema20: [],
    ema50: [],
    rsi: [],
    macdLine: [],
    macdSig: [],
    macdHist: [],
  });
  const [show, setShow] = useState({ ema20: true, ema50: true, rsi: true, macd: true });
  const [err, setErr] = useState(null);
  async function fetchSnapshot() {
    setErr(null);
    try {
      const [cgRes, globalRes, fngRes] = await Promise.allSettled([
        j(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin&price_change_percentage=1h,24h"
        ),
        j("https://api.coingecko.com/api/v3/global"),
        j("https://api.alternative.me/fng/?limit=1"),
      ]);
      const errs = [];
      const cg = cgRes.status === "fulfilled" ? cgRes.value : (errs.push("coingecko"), []);
      const globalData =
        globalRes.status === "fulfilled" ? globalRes.value : (errs.push("global"), {});
      const fngData =
        fngRes.status === "fulfilled" ? fngRes.value : (errs.push("fng"), {});
      const btc = cg?.[0] || {};
      const px = Number(btc.current_price);
      const p1h = Number(btc.price_change_percentage_1h_in_currency);
      const p24h = Number(btc.price_change_percentage_24h_in_currency);
      const dom = Number(globalData?.data?.market_cap_percentage?.btc);
      const fng = Number(fngData?.data?.[0]?.value);
      let lastFunding = null,
        nextFunding = null;
      try {
        const frIdx = await j(
          "https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT"
        );
        nextFunding = frIdx?.nextFundingTime
          ? Number(frIdx.nextFundingTime)
          : null;
        const fr = await j(
          "https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1"
        );
        lastFunding = fr?.[0]?.fundingRate ? Number(fr[0].fundingRate) * 100 : null;
      } catch {}
      let liqTotal = null,
        liqLargest = null,
        liqCount = null;
      try {
        const end = Date.now(),
          start = end - 4 * 3600 * 1000;
        const url = `https://fapi.binance.com/futures/data/liquidationOrders?symbol=BTCUSDT&limit=1000&startTime=${start}&endTime=${end}`;
        const rows = await j(url);
        if (Array.isArray(rows) && rows.length) {
          let tot = 0,
            big = 0;
          rows.forEach((r) => {
            const price = Number(
              r.price || r.avgPrice || r.markPrice || 0
            );
            const qty = Number(
              r.origQty || r.executedQty || r.lastFilledQty || r.qty || 0
            );
            const notional = price * qty;
            if (Number.isFinite(notional)) {
              tot += notional;
              if (notional > big) big = notional;
            }
          });
          liqTotal = tot || null;
          liqLargest = big || null;
          liqCount = rows.length;
        }
      } catch {}
      let headline = null;
      try {
        const rd = await j(
          "https://www.reddit.com/r/Bitcoin/.json?limit=10"
        );
        const posts = rd?.data?.children?.map((c) => c.data) || [];
        const cutoff = Date.now() / 1000 - 6 * 3600;
        const recent = posts.filter(
          (p) => p.created_utc >= cutoff && !p.stickied
        );
        const top = recent.sort((a, b) => (b.ups || 0) - (a.ups || 0))[0];
        if (top?.title) headline = top.title;
      } catch {}
      setState({
        price: Number.isFinite(px) ? px : null,
        chg1h: Number.isFinite(p1h) ? p1h : null,
        chg24h: Number.isFinite(p24h) ? p24h : null,
        funding: { last: lastFunding, next: nextFunding },
        liqs: { totalUSD: liqTotal, largestUSD: liqLargest, count: liqCount },
        headline,
        dominance: Number.isFinite(dom) ? dom : null,
        fearGreed: Number.isFinite(fng) ? fng : null,
      });
      if (errs.length) setErr(`partial data: ${errs.join(", ")}`);
      setNow(new Date());
    } catch (e) {
      setErr(e?.message || "Fetch error");
    }
  }

  async function fetchChart() {
    try {
      const k = await j(
        "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=500"
      );
      const candles = toCandles(k);
      const closes = toCloses(k);
      const e20 = ema(closes, 20)
        .map((v, i) => ({ time: candles[i]?.time, value: v }))
        .filter((p) => p.time);
      const e50 = ema(closes, 50)
        .map((v, i) => ({ time: candles[i]?.time, value: v }))
        .filter((p) => p.time);
      const r = rsi(closes, 14)
        .map((v, i) => ({ time: candles[i]?.time, value: v }))
        .filter((p) => p.time);
      const m = macd(closes, 12, 26, 9);
      const macdLine = m.line
        .map((v, i) => ({ time: candles[i]?.time, value: v }))
        .filter((p) => p.time);
      const macdSig = m.sig
        .map((v, i) => ({ time: candles[i]?.time, value: v }))
        .filter((p) => p.time);
      const macdHist = m.hist
        .map((v, i) => ({ time: candles[i]?.time, value: v }))
        .filter((p) => p.time);
      setSeries({
        candles,
        ema20: e20,
        ema50: e50,
        rsi: r,
        macdLine,
        macdSig,
        macdHist,
      });
    } catch (e) {
      setErr(e?.message || "Chart fetch error");
    }
  }

  useEffect(() => {
    fetchSnapshot();
    fetchChart();
    const id = setInterval(() => {
      fetchSnapshot();
      fetchChart();
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const oneLiner = useMemo(() => {
    const p =
      state.price != null
        ? fmtUSD(state.price, state.price > 1000 ? 0 : 2)
        : "—";
    const h1 = fmtPct(state.chg1h);
    const d1 = fmtPct(state.chg24h);
    const fr =
      state.funding?.last != null
        ? `${state.funding.last.toFixed(4)}%`
        : "—";
    const liq =
      state.liqs?.totalUSD != null
        ? fmtUSD(state.liqs.totalUSD, 0)
        : "n/a";
    const dom =
      state.dominance != null ? `dom ${state.dominance.toFixed(2)}%` : "";
    const fng =
      state.fearGreed != null ? `F&G ${state.fearGreed}` : "";
    const parts = [`BTC ${p} (${h1} / ${d1})`, `funding ${fr}`, `liqs(4h) ${liq}`];
    if (dom) parts.push(dom);
    if (fng) parts.push(fng);
    const head = state.headline ? ` — ${state.headline}` : "";
    return parts.join(", ") + head;
  }, [state]);

  return (
    <div className="w-full max-w-5xl mx-auto p-4 text-slate-100">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 opacity-80" />
          <h1 className="text-lg font-black tracking-tight">
            BTC Pulse — Interactive (Patched)
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <button
            onClick={() => {
              fetchSnapshot();
              fetchChart();
            }}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800/60 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <span>{now.toLocaleTimeString()}</span>
        </div>
      </div>

      {err && (
        <div className="mb-2 text-xs text-red-400 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          {err}
        </div>
      )}

      <p className="text-sm text-slate-300 mb-3">{oneLiner}</p>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">Indicators:</span>
        <button
          onClick={() => setShow((s) => ({ ...s, ema20: !s.ema20 }))}
          className={`px-2 py-1 rounded border ${show.ema20 ? "border-sky-500 text-sky-300" : "border-slate-700 text-slate-400"}`}
        >
          EMA20
        </button>
        <button
          onClick={() => setShow((s) => ({ ...s, ema50: !s.ema50 }))}
          className={`px-2 py-1 rounded border ${show.ema50 ? "border-amber-400 text-amber-300" : "border-slate-700 text-slate-400"}`}
        >
          EMA50
        </button>
        <button
          onClick={() => setShow((s) => ({ ...s, rsi: !s.rsi }))}
          className={`px-2 py-1 rounded border ${show.rsi ? "border-violet-400 text-violet-300" : "border-slate-700 text-slate-400"}`}
        >
          RSI
        </button>
        <button
          onClick={() => setShow((s) => ({ ...s, macd: !s.macd }))}
          className={`px-2 py-1 rounded border ${show.macd ? "border-emerald-400 text-emerald-300" : "border-slate-700 text-slate-400"}`}
        >
          MACD
        </button>
      </div>

      <ChartCandle
        data={{ candles: series.candles, ema20: series.ema20, ema50: series.ema50 }}
        showEMA20={show.ema20}
        showEMA50={show.ema50}
      />

      {show.rsi && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-1 text-xs text-slate-400">
            <Activity className="w-3.5 h-3.5" /> RSI(14)
          </div>
          <LinePanel series={series.rsi} color="#9b59b6" height={110} bands={[30, 70]} />
        </div>
      )}
      {show.macd && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-1 text-xs text-slate-400">
            <Settings className="w-3.5 h-3.5" /> MACD(12,26,9)
          </div>
          <LinePanel series={series.macdLine} color="#2ecc71" height={90} />
          <LinePanel series={series.macdSig} color="#e74c3c" height={80} />
          <MacdHistPanel series={series.macdHist} height={120} />
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-700/70">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-900/60 text-slate-300">
              <th className="text-left p-2">Metric</th>
              <th className="text-left p-2">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            <tr>
              <td className="p-2 text-slate-400">Spot price</td>
              <td className="p-2 font-semibold">
                {fmtUSD(state.price, state.price > 1000 ? 0 : 2)}
              </td>
            </tr>
            <tr>
              <td className="p-2 text-slate-400">1h / 24h change</td>
              <td className="p-2 font-semibold">
                {fmtPct(state.chg1h)} / {fmtPct(state.chg24h)}
              </td>
            </tr>
            <tr>
              <td className="p-2 text-slate-400">Funding (BTCUSDT)</td>
              <td className="p-2 font-semibold">
                {state.funding?.last != null
                  ? `${state.funding.last.toFixed(4)}%`
                  : "—"}
                <span className="text-slate-400 text-xs">
                  {state.funding?.next
                    ? ` • next @ ${new Date(
                        state.funding.next
                      ).toLocaleTimeString()}`
                    : ""}
                </span>
              </td>
            </tr>
            <tr>
              <td className="p-2 text-slate-400">Liquidations (last 4h)</td>
              <td className="p-2 font-semibold">
                {state.liqs?.totalUSD != null ? (
                  <>
                    {fmtUSD(state.liqs.totalUSD, 0)}
                    {state.liqs.count ? ` • ${state.liqs.count} orders` : ""}
                    {state.liqs.largestUSD
                      ? ` • largest ${fmtUSD(state.liqs.largestUSD, 0)}`
                      : ""}
                  </>
                ) : (
                  <span className="text-slate-400">n/a</span>
                )}
              </td>
            </tr>
            <tr>
              <td className="p-2 text-slate-400">BTC dominance</td>
              <td className="p-2 font-semibold">
                {state.dominance != null
                  ? `${state.dominance.toFixed(2)}%`
                  : "—"}
              </td>
            </tr>
            <tr>
              <td className="p-2 text-slate-400">Fear & Greed Index</td>
              <td className="p-2 font-semibold">
                {state.fearGreed != null ? state.fearGreed : "—"}
              </td>
            </tr>
            <tr>
              <td className="p-2 text-slate-400">Top driver headline</td>
              <td className="p-2 font-semibold">
                {state.headline ?? (
                  <span className="text-slate-400">(unavailable)</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-slate-400">
        Data: CoinGecko (spot & dominance), Binance (funding & liquidations, best‑effort),
        Reddit (headline), Alternative.me (F&G). Auto‑refresh 60s.
      </div>
    </div>
  );
}

