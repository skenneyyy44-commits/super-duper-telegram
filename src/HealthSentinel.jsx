import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  HeartPulse,
  Brain,
  Zap,
  Video,
  Upload,
  Download,
  AlertTriangle,
  CloudLightning,
  Globe,
  Flame,
  Waves,
  Wind,
  CloudFog,
  Gauge,
} from "lucide-react";
import Papa from "papaparse";
import Tesseract from "tesseract.js";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";

/**
 * Health Sentinel — Apple Watch Series 7 Analysis & Global Signals
 *
 * What this does
 * - Ingests Apple Health metrics from either:
 *   - OCR on a screen recording (sampled frames, regex extraction)
 *   - CSV upload (recommended schema below)
 * - Computes stats + flags for HR / HRV / Stress / Energy / Focus
 * - Visualizes trends, risk state, and readiness
 * - Pulls external signals (USGS quakes, NWS alerts, OpenAQ AQI, BTC snapshot)
 * - Exports your parsed metrics as CSV
 *
 * Recommended CSV columns (headers are case-insensitive):
 * timestamp, hr_bpm, hrv_sdnn_ms, rmssd_ms, pnn50_pct, amo50_pct, rr_mode_ms,
 * stress_pct, energy_pct, focus_pct, spo2_pct, vo2max, tags
 *
 * Safety: This is not medical advice. Use this as a tracking & insights tool.
 */

// ---------- Helpers ----------
const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const fmt0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function msToBpm(ms) {
  if (!ms || ms <= 0) return null;
  return 60000 / ms;
}

function movingAvg(arr, k = 5) {
  if (!arr || arr.length === 0) return [];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - k + 1);
    const slice = arr
      .slice(start, i + 1)
      .map((d) => d.value)
      .filter((v) => v != null);
    out.push({
      t: arr[i].t,
      value: slice.length
        ? slice.reduce((a, b) => a + b, 0) / slice.length
        : null,
    });
  }
  return out;
}

function summarize(values) {
  const s = values.filter((v) => v != null);
  if (!s.length) return null;
  const min = Math.min(...s);
  const max = Math.max(...s);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const med = [...s].sort((a, b) => a - b)[Math.floor(s.length / 2)];
  return { n: s.length, min, max, mean, median: med };
}

function scoreReadiness({ hrMean, rmssd, sdnn, pnn50, amo50 }) {
  // Simple heuristic: higher RMSSD/SDNN/pNN50 => better; lower HR & AMo50 =&gt; better
  // Normalize to 0..100
  const z = (val, good, bad) => {
    if (val == null) return 50;
    const clamped = Math.max(Math.min((val - bad) / (good - bad), 1), 0);
    return clamped * 100;
  };
  const sRMSSD = z(rmssd ?? 0, 60, 10);
  const sSDNN = z(sdnn ?? 0, 80, 20);
  const sPNN50 = z(pnn50 ?? 0, 20, 0);
  const sHR = 100 - z(hrMean ?? 80, 60, 110); // lower HR better
  const sAMO = 100 - z(amo50 ?? 50, 40, 85); // lower AMo50 better
  const score = Math.round(
    sRMSSD * 0.3 + sSDNN * 0.25 + sPNN50 * 0.15 + sHR * 0.2 + sAMO * 0.1
  );
  return Math.max(0, Math.min(100, score));
}

function downloadCSV(filename, rows) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Regex patterns for OCR extraction
const rx = {
  hrBpm: /(\d{2,3})\s*(?:bpm|BPM)/i,
  hrvMs: /(HRV|Variability)[^\d]{0,12}(\d{1,3})\s*ms/i,
  rmssd: /RMSSD[^\d]{0,12}(\d{1,3})\s*ms/i,
  sdnn: /SDNN[^\d]{0,12}(\d{1,3})\s*(?:ms)?/i,
  pnn50: /pNN50[^\d]{0,12}(\d{1,3})\s*%/i,
  amo50: /AMo50[^\d]{0,12}(\d{1,3})\s*%/i,
  rrMode: /(Mode|RR Mode)[^\d]{0,12}(\d{2,4})\s*ms/i,
  spo2: /(SpO2|Oxygen)[^\d]{0,12}(\d{2,3})\s*%/i,
  vo2: /(VO2\s*max|Cardio\s*Fitness)[^\d]{0,12}(\d{2,3})/i,
  afib: /\bAFib\b|Irregular\s*Rhythm/i,
  highHR: /High\s*Heart\s*Rate|Tachycardia/i,
  lowHR: /Low\s*Heart\s*Rate|Bradycardia/i,
};

// ---------- Main Component ----------
export default function HealthSentinel() {
  // Core data table
  const [rows, setRows] = useState([]); // {t, hr, sdnn, rmssd, pnn50, amo50, rrMode, spo2, vo2max, stress, energy, focus, tags, source}

  // OCR state
  const [videoFile, setVideoFile] = useState(null);
  const [ocrProgress, setOcrProgress] = useState({
    current: 0,
    total: 0,
    status: "idle",
  });
  const [frameStep, setFrameStep] = useState(0.5);
  const [maxFrames, setMaxFrames] = useState(100);

  // External signals
  const [eqList, setEqList] = useState([]);
  const [nwsAlerts, setNwsAlerts] = useState([]);
  const [aqi, setAqi] = useState(null);
  const [btc, setBtc] = useState(null);

  // User context
  const [home, setHome] = useState({
    city: "Wilmington",
    state: "NC",
    lat: 34.208,
    lon: -77.882,
  });

  // Derived stats
  const hrStats = useMemo(() => summarize(rows.map((r) => r.hr)), [rows]);
  const sdnnStats = useMemo(() => summarize(rows.map((r) => r.sdnn)), [rows]);
  const rmssdStats = useMemo(() => summarize(rows.map((r) => r.rmssd)), [rows]);
  const pnnStats = useMemo(() => summarize(rows.map((r) => r.pnn50)), [rows]);
  const amoStats = useMemo(() => summarize(rows.map((r) => r.amo50)), [rows]);

  const readiness = useMemo(
    () =>
      scoreReadiness({
        hrMean: hrStats?.mean ?? null,
        rmssd: rmssdStats?.mean ?? null,
        sdnn: sdnnStats?.mean ?? null,
        pnn50: pnnStats?.mean ?? null,
        amo50: amoStats?.mean ?? null,
      }),
    [hrStats, rmssdStats, sdnnStats, pnnStats, amoStats]
  );

  const insights = useMemo(() => {
    const out = [];
    const hrHi = hrStats?.max ?? null;
    const hrLo = hrStats?.min ?? null;
    if (hrHi != null && hrHi >= 100)
      out.push({
        level: "warn",
        text: `Heart rate peak ${fmt0.format(hrHi)} bpm — consider whether this was rest vs activity.`,
      });
    if (hrLo != null && hrLo <= 50)
      out.push({
        level: "note",
        text: `Lowest heart rate ${fmt0.format(hrLo)} bpm — OK if asleep/athletic; otherwise track.`,
      });

    const sd = sdnnStats?.mean ?? null;
    const rm = rmssdStats?.mean ?? null;
    if (sd != null && sd < 50)
      out.push({
        level: "warn",
        text: `Low SDNN (~${fmt.format(sd)} ms) — sympathetic dominance / reduced variability.`,
      });
    if (rm != null && rm < 20)
      out.push({
        level: "warn",
        text: `Very low RMSSD (~${fmt.format(rm)} ms) — fatigue/stress likely.`,
      });

    const p = pnnStats?.mean ?? null;
    if (p != null && p <= 1)
      out.push({
        level: "warn",
        text: `pNN50 near ${fmt.format(p)}% — minimal beat-to-beat variability.`,
      });

    const a = amoStats?.mean ?? null;
    if (a != null && a >= 75)
      out.push({
        level: "warn",
        text: `AMo50 ${fmt.format(a)}% — high mode amplitude (sympathetic overdrive).`,
      });

    if (!out.length)
      out.push({
        level: "ok",
        text: "No red flags from current extraction. Keep tracking trends.",
      });
    return out;
  }, [hrStats, sdnnStats, rmssdStats, pnnStats, amoStats]);

  // ---------- CSV ingest ----------
  function handleCSV(file) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const parsed = (res?.data || []).map((r) => ({
          t: r.timestamp || r.time || r.t || null,
          hr: num(r.hr_bpm || r.hr || r.heart_rate),
          sdnn: num(r.hrv_sdnn_ms || r.sdnn_ms || r.sdnn),
          rmssd: num(r.rmssd_ms || r.rmssd),
          pnn50: num(r.pnn50_pct || r.pnn50),
          amo50: num(r.amo50_pct || r.amo50),
          rrMode: num(r.rr_mode_ms || r.rr_mode),
          spo2: num(r.spo2_pct || r.spo2),
          vo2max: num(r.vo2max),
          stress: num(r.stress_pct || r.stress),
          energy: num(r.energy_pct || r.energy),
          focus: num(r.focus_pct || r.focus),
          tags: r.tags || "csv",
          source: "csv",
        }));
        setRows((prev) => dedupe([...prev, ...parsed]));
      },
    });
  }

  function num(v) {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : null;
  }

  function dedupe(list) {
    // Remove duplicates by (t, source, hr)
    const key = (r) => `${r.t}|${r.source}|${r.hr ?? ""}`;
    const map = new Map();
    list.forEach((r) => {
      map.set(key(r), r);
    });
    return Array.from(map.values()).sort((a, b) =>
      (a.t ?? 0) > (b.t ?? 0) ? 1 : -1
    );
  }

  // ---------- Video OCR ----------
  async function runOCR(file) {
    setRows((prev) => prev); // no-op to ensure state exists
    setOcrProgress({ current: 0, total: 0, status: "preparing" });

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.crossOrigin = "anonymous";
    video.muted = true;

    await new Promise((res, rej) => {
      video.onloadedmetadata = () => res();
      video.onerror = () => rej(new Error("Failed to load video metadata"));
    });

    const duration = video.duration || 0;
    const step = Math.max(0.25, frameStep);
    const total = Math.min(maxFrames, Math.ceil(duration / step) + 1);
    setOcrProgress({ current: 0, total, status: "processing" });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const newRows = [];
    let processed = 0;

    for (let i = 0; i < total; i++) {
      const t = Math.min(i * step, duration);
      await seekTo(video, t);

      // Draw frame
      const w = video.videoWidth;
      const h = video.videoHeight;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);

      // Optionally crop common HUD areas (try full frame first)
      const dataUrl = canvas.toDataURL("image/png");

      const {
        data: { text },
      } = await Tesseract.recognize(dataUrl, "eng", {
        tessedit_pageseg_mode: 6,
      });

      const found = extractMetrics(text);
      if (Object.values(found).some((v) => v != null)) {
        newRows.push({
          t: t.toFixed(2),
          hr: found.hr,
          sdnn: found.sdnn,
          rmssd: found.rmssd,
          pnn50: found.pnn50,
          amo50: found.amo50,
          rrMode: found.rrMode,
          spo2: found.spo2,
          vo2max: found.vo2,
          stress: found.stress,
          energy: found.energy,
          focus: found.focus,
          tags: found.tags.join(";"),
          source: "ocr",
        });
      }

      processed++;
      setOcrProgress({
        current: processed,
        total,
        status: `processing (${processed}/${total})`,
      });
    }

    setRows((prev) => dedupe([...prev, ...newRows]));
    setOcrProgress({ current: processed, total, status: "done" });
    URL.revokeObjectURL(url);
  }

  function extractMetrics(text) {
    const out = {
      hr: null,
      sdnn: null,
      rmssd: null,
      pnn50: null,
      amo50: null,
      rrMode: null,
      spo2: null,
      vo2: null,
      stress: null,
      energy: null,
      focus: null,
      tags: [],
    };
    if (!text) return out;
    const t = text.replace(/\s+/g, " ");

    const mHR = t.match(rx.hrBpm);
    if (mHR) out.hr = parseInt(mHR[1]);
    const mHV = t.match(rx.hrvMs);
    if (mHV) out.sdnn = parseInt(mHV[2]);
    const mS = t.match(rx.sdnn);
    if (mS) out.sdnn = parseInt(mS[1]);
    const mR = t.match(rx.rmssd);
    if (mR) out.rmssd = parseInt(mR[1]);
    const mP = t.match(rx.pnn50);
    if (mP) out.pnn50 = parseInt(mP[1]);
    const mA = t.match(rx.amo50);
    if (mA) out.amo50 = parseInt(mA[1]);
    const mRM = t.match(rx.rrMode);
    if (mRM) out.rrMode = parseInt(mRM[2] || mRM[1]);
    const mO2 = t.match(rx.spo2);
    if (mO2) out.spo2 = parseInt(mO2[2]);
    const mVO2 = t.match(rx.vo2);
    if (mVO2) out.vo2 = parseInt(mVO2[2]);

    // Heuristic parse for Stress/Energy/Focus percentages in Welltory-style UIs
    const sefre = /(Stress|Energy|Focus)[^\d]{0,10}(\d{1,3})\s*%/gi;
    let m;
    while ((m = sefre.exec(t))) {
      const k = m[1].toLowerCase();
      const v = parseInt(m[2]);
      if (k.includes("stress")) out.stress = v;
      if (k.includes("energy")) out.energy = v;
      if (k.includes("focus")) out.focus = v;
    }

    if (rx.afib.test(t)) out.tags.push("afib_flag");
    if (rx.highHR.test(t)) out.tags.push("high_hr");
    if (rx.lowHR.test(t)) out.tags.push("low_hr");

    return out;
  }

  function seekTo(video, t) {
    return new Promise((res) => {
      const handler = () => {
        video.removeEventListener("seeked", handler);
        res();
      };
      video.addEventListener("seeked", handler);
      video.currentTime = Math.max(0, Math.min(t, video.duration || t));
    });
  }

  // ---------- External Signals ----------
  async function fetchQuakes() {
    try {
      const res = await fetch(
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson"
      );
      const j = await res.json();
      const list = (j.features || []).slice(0, 20).map((f) => ({
        id: f.id,
        mag: f.properties.mag,
        place: f.properties.place,
        time: new Date(f.properties.time).toLocaleString(),
      }));
      setEqList(list);
    } catch (e) {
      setEqList([
        { id: "err", mag: null, place: "Unable to fetch USGS (CORS)", time: "" },
      ]);
    }
  }

  async function fetchNWS() {
    try {
      const res = await fetch(
        `https://api.weather.gov/alerts/active?area=${home.state}`
      );
      const j = await res.json();
      const list = (j.features || []).slice(0, 10).map((f) => ({
        id: f.id,
        event: f.properties.event,
        headline: f.properties.headline,
        sent: new Date(f.properties.sent).toLocaleString(),
      }));
      setNwsAlerts(list);
    } catch (e) {
      setNwsAlerts([
        { id: "err", event: "NWS alerts", headline: "Unable to fetch (CORS)", sent: "" },
      ]);
    }
  }

  async function fetchAQI() {
    try {
      const res = await fetch(
        `https://api.openaq.org/v2/latest?coordinates=${home.lat},${home.lon}&radius=10000&limit=1`
      );
      const j = await res.json();
      const m = j?.results?.[0]?.measurements?.[0];
      if (m)
        setAqi({
          parameter: m.parameter,
          value: m.value,
          unit: m.unit,
          lastUpdated: j?.results?.[0]?.date?.utc,
        });
      else
        setAqi({ parameter: "pm2.5", value: null, unit: "µg/m³", lastUpdated: null });
    } catch (e) {
      setAqi({ parameter: "pm2.5", value: null, unit: "µg/m³", lastUpdated: null });
    }
  }

  async function fetchBTC() {
    try {
      const res = await fetch(
        "https://api.coindesk.com/v1/bpi/currentprice/BTC.json"
      );
      const j = await res.json();
      setBtc({ usd: j?.bpi?.USD?.rate_float ?? null, time: j?.time?.updated });
    } catch (e) {
      setBtc({ usd: null, time: null });
    }
  }

  // ---------- UI Data ----------
  const chartData = useMemo(() => {
    // Build a merged timeline with hr + hrv
    return rows.map((r, i) => ({
      t: r.t ?? i,
      hr: r.hr ?? null,
      sdnn: r.sdnn ?? null,
      rmssd: r.rmssd ?? null,
      pnn50: r.pnn50 ?? null,
      amo50: r.amo50 ?? null,
      stress: r.stress ?? null,
      energy: r.energy ?? null,
      focus: r.focus ?? null,
    }));
  }, [rows]);

  const hrSeries = chartData.map((d) => ({ t: d.t, value: d.hr }));
  const hrMA = movingAvg(hrSeries, 5).map((d) => ({ t: d.t, hr_ma: d.value }));
  const mergedChart = chartData.map((d, i) => ({
    ...d,
    hr_ma: hrMA[i]?.hr_ma ?? null,
  }));

  // ---------- Render ----------
  return (
    <div className="min-h-screen w-full bg-black text-zinc-100 p-4 md:p-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HeartPulse className="h-8 w-8" />
          <h1 className="text-2xl md:text-3xl font-semibold">
            Health Sentinel — Apple Watch S7
          </h1>
          <Badge variant="secondary" className="bg-zinc-800">
            Beta
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => downloadCSV("health_sentinel_export.csv", rows)}
          >
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </header>

      {/* Ingest Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="bg-zinc-900/70 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" /> Video OCR
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-zinc-300">
              Upload a screen recording of your Apple Health / HRV app. We'll
              sample frames every <span className="font-medium">{frameStep}s</span>,
              OCR, and extract metrics.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
              />
              <Button onClick={() => videoFile && runOCR(videoFile)} disabled={!videoFile}>
                <Zap className="h-4 w-4 mr-2" /> Run OCR
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-zinc-400">Frame step (s)</label>
                <Input
                  type="number"
                  step="0.25"
                  value={frameStep}
                  onChange={(e) => setFrameStep(parseFloat(e.target.value) || 0.5)}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Max frames</label>
                <Input
                  type="number"
                  value={maxFrames}
                  onChange={(e) => setMaxFrames(parseInt(e.target.value) || 100)}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                <span>Status: {ocrProgress.status}</span>
                <span>
                  {ocrProgress.current}/{ocrProgress.total}
                </span>
              </div>
              <Progress
                value={
                  ocrProgress.total
                    ? (ocrProgress.current / ocrProgress.total) * 100
                    : 0
                }
                className="h-2"
              />
            </div>
            <p className="text-xs text-zinc-500">
              Tip: If OCR misses numbers, pause-and-crop your video around text
              areas and retry.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/70 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> CSV Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-zinc-300">
              Drop a CSV exported from your logs or our previous analyses.
            </p>
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && handleCSV(e.target.files[0])}
            />
            <div className="text-xs text-zinc-400">
              <p className="mb-1">Headers we understand:</p>
              <code className="block bg-zinc-950 p-2 rounded">
                timestamp, hr_bpm, hrv_sdnn_ms, rmssd_ms, pnn50_pct, amo50_pct,
                rr_mode_ms, stress_pct, energy_pct, focus_pct, spo2_pct,
                vo2max, tags
              </code>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/70 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" /> Readiness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-5xl font-semibold">
              {fmt0.format(readiness)}
              <span className="text-xl">/100</span>
            </div>
            <p className="text-sm text-zinc-300">
              Composite from HRV (RMSSD/SDNN/pNN50), average HR, and AMo50.
              Higher is better.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <KPI label="HR mean" value={hrStats?.mean} suffix=" bpm" />
              <KPI label="SDNN mean" value={sdnnStats?.mean} suffix=" ms" />
              <KPI label="RMSSD mean" value={rmssdStats?.mean} suffix=" ms" />
              <KPI label="pNN50 mean" value={pnnStats?.mean} suffix=" %" />
              <KPI label="AMo50 mean" value={amoStats?.mean} suffix=" %" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="bg-zinc-900/70 border-zinc-800 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Heart Rate & Moving Average
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-60 md:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={mergedChart}
                  margin={{ left: 6, right: 6, top: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="t"
                    tick={{ fill: "#a1a1aa", fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fill: "#a1a1aa", fontSize: 12 }}
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0a0a0a",
                      border: "1px solid #27272a",
                    }}
                  />
                  <Line type="monotone" dataKey="hr" dot={false} strokeWidth={2} />
                  <Line
                    type="monotone"
                    dataKey="hr_ma"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/70 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" /> HRV Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-60 md:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ left: 6, right: 6, top: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="t"
                    tick={{ fill: "#a1a1aa", fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fill: "#a1a1aa", fontSize: 12 }}
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0a0a0a",
                      border: "1px solid #27272a",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sdnn"
                    strokeWidth={2}
                    fillOpacity={0.2}
                  />
                  <Area
                    type="monotone"
                    dataKey="rmssd"
                    strokeWidth={2}
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights & Table */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <Card className="bg-zinc-900/70 border-zinc-800 xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.map((it, idx) => (
              <div
                key={idx}
                className={`text-sm p-2 rounded border ${
                  it.level === "warn"
                    ? "border-red-800/40 bg-red-900/10"
                    : it.level === "ok"
                    ? "border-emerald-800/40 bg-emerald-900/10"
                    : "border-zinc-800 bg-zinc-900/30"
                }`}
              >
                {it.text}
              </div>
            ))}
            <div className="text-xs text-zinc-400 pt-2">
              Heuristics: HRV (SDNN/RMSSD) low + high AMo50 =&gt; sympathetic
              dominance; pNN50≈0% =&gt; minimal variability.
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/70 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" /> Action Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside text-sm text-zinc-200 space-y-1">
              <li>
                Prioritize recovery: sleep window ≥7.5h; low-intensity day if
                RMSSD &lt; 20ms.
              </li>
              <li>
                Hydration & nutrition: reduce stimulants; add light aerobic
                session + breathwork (4-7-8).
              </li>
              <li>
                Re-check morning HRV trend; look for RMSSD lifting toward
                25–40ms.
              </li>
              <li>
                If persistent resting HR ≥100 bpm at rest or palpitations,
                consider medical evaluation.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* External Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-zinc-900/70 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" /> USGS Quakes (M4.5+ today)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="secondary" size="sm" onClick={fetchQuakes}>
              Refresh
            </Button>
            <div className="space-y-1 text-sm max-h-52 overflow-auto pr-1">
              {eqList.map((q) => (
                <div
                  key={q.id}
                  className="p-2 rounded bg-zinc-950 border border-zinc-800"
                >
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4" />
                    <span className="font-medium">M{q.mag ?? "?"}</span>
                    <span className="text-zinc-300">{q.place}</span>
                  </div>
                  <div className="text-xs text-zinc-400">{q.time}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/70 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudLightning className="h-5 w-5" /> NWS Alerts ({home.state})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                className="bg-zinc-950"
                value={home.state}
                onChange={(e) =>
                  setHome({ ...home, state: e.target.value.toUpperCase().slice(0, 2) })
                }
              />
              <Button variant="secondary" size="sm" onClick={fetchNWS}>
                Refresh
              </Button>
            </div>
            <div className="space-y-1 text-sm max-h-52 overflow-auto pr-1">
              {nwsAlerts.map((a) => (
                <div
                  key={a.id}
                  className="p-2 rounded bg-zinc-950 border border-zinc-800"
                >
                  <div className="font-medium">{a.event}</div>
                  <div className="text-xs text-zinc-400">{a.headline}</div>
                  <div className="text-xs text-zinc-500">{a.sent}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/70 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wind className="h-5 w-5" /> Air Quality (OpenAQ)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                className="bg-zinc-950"
                placeholder="lat"
                value={home.lat}
                onChange={(e) =>
                  setHome({ ...home, lat: parseFloat(e.target.value) || home.lat })
                }
              />
              <Input
                className="bg-zinc-950"
                placeholder="lon"
                value={home.lon}
                onChange={(e) =>
                  setHome({ ...home, lon: parseFloat(e.target.value) || home.lon })
                }
              />
              <Button variant="secondary" size="sm" onClick={fetchAQI}>
                Refresh
              </Button>
            </div>
            {aqi ? (
              <div className="p-2 rounded bg-zinc-950 border border-zinc-800 text-sm">
                <div>
                  <span className="font-medium">{aqi.parameter?.toUpperCase()}</span>:
                  {" "}
                  {aqi.value ?? "—"} {aqi.unit}
                </div>
                <div className="text-xs text-zinc-500">
                  Updated: {aqi.lastUpdated ? new Date(aqi.lastUpdated).toLocaleString() : "—"}
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-400">No AQI yet.</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/70 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Waves className="h-5 w-5" /> BTC Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="secondary" size="sm" onClick={fetchBTC}>
              Refresh
            </Button>
            {btc ? (
              <div className="p-2 rounded bg-zinc-950 border border-zinc-800 text-sm">
                <div>
                  <span className="font-medium">BTC/USD</span>:{" "}
                  {btc.usd ? `$${fmt0.format(btc.usd)}` : "—"}
                </div>
                <div className="text-xs text-zinc-500">Updated: {btc.time || "—"}</div>
              </div>
            ) : (
              <div className="text-sm text-zinc-400">No BTC yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card className="bg-zinc-900/70 border-zinc-800 mb-10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudFog className="h-5 w-5" /> Extracted Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-300">
                <tr className="border-b border-zinc-800">
                  <th className="text-left p-2">t</th>
                  <th className="text-right p-2">HR</th>
                  <th className="text-right p-2">SDNN</th>
                  <th className="text-right p-2">RMSSD</th>
                  <th className="text-right p-2">pNN50%</th>
                  <th className="text-right p-2">AMo50%</th>
                  <th className="text-right p-2">RR Mode</th>
                  <th className="text-right p-2">SpO₂%</th>
                  <th className="text-right p-2">VO₂max</th>
                  <th className="text-left p-2">Tags</th>
                  <th className="text-left p-2">Src</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-zinc-950">
                    <td className="p-2">{r.t}</td>
                    <td className="p-2 text-right">{r.hr ?? "—"}</td>
                    <td className="p-2 text-right">{r.sdnn ?? "—"}</td>
                    <td className="p-2 text-right">{r.rmssd ?? "—"}</td>
                    <td className="p-2 text-right">{r.pnn50 ?? "—"}</td>
                    <td className="p-2 text-right">{r.amo50 ?? "—"}</td>
                    <td className="p-2 text-right">{r.rrMode ?? "—"}</td>
                    <td className="p-2 text-right">{r.spo2 ?? "—"}</td>
                    <td className="p-2 text-right">{r.vo2max ?? "—"}</td>
                    <td className="p-2">{r.tags || ""}</td>
                    <td className="p-2">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <footer className="text-xs text-zinc-500 pb-8">
        Not medical advice. If you have concerning symptoms (chest pain,
        syncope, sustained tachycardia at rest), seek medical care.
      </footer>
    </div>
  );
}

function KPI({ label, value, suffix = "" }) {
  return (
    <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="text-lg font-medium">
        {value != null ? `${fmt.format(value)}${suffix}` : "—"}
      </div>
    </div>
  );
}
