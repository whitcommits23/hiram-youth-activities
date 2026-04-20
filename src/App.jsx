import { useState, useEffect, useMemo } from "react";

const YM_CSV = "https://docs.google.com/spreadsheets/d/1fE1op5KG2FzQydmZ6OmzavV2-e8fbqIeSqBA_hx4SS4/export?format=csv";
const YW_CSV = "https://docs.google.com/spreadsheets/d/1WRefRcXPzkozhdFE98lwU094GvtCroCAY5C6Al1ClZE/export?format=csv";

function splitCSVLine(line) {
  const cols = [];
  let cur = "", inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ""; }
    else { cur += ch; }
  }
  cols.push(cur.trim());
  return cols;
}

function normalizeTime(t) {
  if (!t) return "TBD";
  return t.replace(/^(\d+:\d+):\d+(\s*[AP]M)$/i, "$1$2").trim() || "TBD";
}

function toISODate(s) {
  s = (s || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [m, d, y] = s.split("/");
  if (!m || !d || !y) return s;
  return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
}

function resolveGroup(raw, fallback) {
  const g = (raw || "").trim().toLowerCase();
  if (g === "combined") return "Combined";
  if (g === "stake" || g === "stake youth activity") return "Stake";
  return fallback;
}

function parseYMCSV(text) {
  return text.trim().split("\n").slice(1).map(line => {
    const [date, groupRaw, activity, , time, endTime, location, details, leadYouth, advisor] = splitCSVLine(line);
    if (!date || !activity) return null;
    return {
      date: toISODate(date), title: activity.trim(),
      group: resolveGroup(groupRaw, "YM"),
      time: normalizeTime(time), endTime: normalizeTime(endTime),
      location: (location || "").trim(), details: (details || "").trim(),
      leadYouth: (leadYouth || "").trim(), advisor: (advisor || "").trim(),
    };
  }).filter(Boolean);
}

function parseYWCSV(text) {
  return text.trim().split("\n").slice(1).map(line => {
    const [date, title, groupRaw, time, endTime, location, details, leadYouth, advisor] = splitCSVLine(line);
    if (!date || !title) return null;
    return {
      date: toISODate(date), title: title.trim(),
      group: resolveGroup(groupRaw, "YW"),
      time: normalizeTime(time), endTime: normalizeTime(endTime),
      location: (location || "").trim(), details: (details || "").trim(),
      leadYouth: (leadYouth || "").trim(), advisor: (advisor || "").trim(),
    };
  }).filter(Boolean);
}

async function fetchSheet(url, parser) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.trim().startsWith("<!")) throw new Error("Sheet is not publicly accessible");
  return parser(text);
}

const GROUP_STYLES = {
  YM:       { accent: "#5d8fe8", light: "rgba(93,143,232,0.11)",  label: "Young Men"   },
  YW:       { accent: "#d07ec5", light: "rgba(208,126,197,0.11)", label: "Young Women" },
  Combined: { accent: "#c9a84c", light: "rgba(201,168,76,0.11)",  label: "Combined"    },
  Stake:    { accent: "#e07b6a", light: "rgba(224,123,106,0.11)", label: "Stake"       },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function formatDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return {
    month: MONTHS[d.getMonth()],
    monthFull: MONTHS_FULL[d.getMonth()],
    day: d.getDate(),
    weekday: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()],
  };
}

function isUpcoming(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr + "T12:00:00") >= today;
}

function getCountdown(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(dateStr + "T12:00:00");
  const diff = Math.floor((event - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${diff} days`;
}

function parseTime(timeStr) {
  if (!timeStr || timeStr === "TBD") return null;
  const [time, ampm] = timeStr.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return { h, m };
}

function formatDateRange(startStr, endStr) {
  const s = new Date(startStr + "T12:00:00");
  const e = new Date(endStr + "T12:00:00");
  const sm = MONTHS[s.getMonth()];
  const em = MONTHS[e.getMonth()];
  if (sm === em) return `${sm} ${s.getDate()}–${e.getDate()}`;
  return `${sm} ${s.getDate()} – ${em} ${e.getDate()}`;
}

function buildCalendarUrl(event) {
  const dateBase = event.date.replace(/-/g, "");
  const start = parseTime(event.time);
  const end = parseTime(event.endTime);
  let dates;
  if (start && end && !event.endDate) {
    const s = `${dateBase}T${String(start.h).padStart(2,"0")}${String(start.m).padStart(2,"0")}00`;
    const e = `${dateBase}T${String(end.h).padStart(2,"0")}${String(end.m).padStart(2,"0")}00`;
    dates = `${s}/${e}`;
  } else {
    const endDateStr = event.endDate || event.date;
    const endDay = new Date(endDateStr + "T12:00:00");
    endDay.setDate(endDay.getDate() + 1);
    dates = `${dateBase}/${endDay.toISOString().slice(0,10).replace(/-/g,"")}`;
  }
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${GROUP_STYLES[event.group].label}: ${event.title}`,
    dates,
    details: [event.details, event.leadYouth ? `Lead Youth: ${event.leadYouth}` : ""].filter(Boolean).join("\n"),
    location: event.location || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const FILTERS = ["All", "YM", "YW", "Stake"];

function matchesFilter(e, filter) {
  if (filter === "All") return true;
  if (filter === "Stake") return e.group === "Stake";
  return e.group === filter || e.group === "Combined" || e.group === "Stake";
}

function deduped(arr) {
  const seen = new Set();
  return arr.filter(e => {
    const key = `${e.date}|${e.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function App() {
  const [events,   setEvents]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [filter,   setFilter]   = useState("All");
  const [expandedId, setExpandedId] = useState(null);
  const [pastOpen, setPastOpen] = useState(false);

  useEffect(() => {
    let dead = false;
    Promise.allSettled([fetchSheet(YM_CSV, parseYMCSV), fetchSheet(YW_CSV, parseYWCSV)])
      .then(results => {
        if (dead) return;
        const all = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
        const fails = results.filter(r => r.status === "rejected");
        if (all.length === 0 && fails.length > 0) { setError(fails[0].reason.message); setLoading(false); return; }
        const seen = new Set();
        setEvents(all
          .filter(e => { const k = `${e.date}|${e.title.toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; })
          .sort((a, b) => new Date(a.date) - new Date(b.date))
        );
        setLoading(false);
      });
    return () => { dead = true; };
  }, []);

  const filtered = useMemo(() =>
    deduped(
      events
        .filter(e => isUpcoming(e.date))
        .filter(e => matchesFilter(e, filter))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
    ),
    [events, filter]
  );

  const past = useMemo(() =>
    deduped(
      events
        .filter(e => !isUpcoming(e.date))
        .filter(e => matchesFilter(e, filter))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
    ),
    [events, filter]
  );

  const nextEvent = filtered[0];

  return (
    <div style={{ minHeight: "100vh", background: "#0c1019" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700&family=Sora:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:           #0c1019;
          --surface:      #131b28;
          --surface-2:    #192235;
          --border:       rgba(255,255,255,0.07);
          --border-soft:  rgba(255,255,255,0.04);
          --gold:         #c9a84c;
          --gold-dim:     rgba(201,168,76,0.3);
          --cream:        #f0e6d2;
          --cream-dim:    rgba(240,230,210,0.55);
          --cream-faint:  rgba(240,230,210,0.22);
        }

        body {
          background: var(--bg);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Grain texture */
        body::after {
          content: '';
          position: fixed; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
          opacity: 0.032;
          pointer-events: none;
          z-index: 9999;
        }

        /* ─── HEADER ─── */
        .header {
          padding: 52px 24px 44px;
          position: relative;
          overflow: hidden;
        }
        .header::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 65% 50% at 50% -5%, rgba(201,168,76,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 35% 25% at 10% 90%, rgba(93,143,232,0.05) 0%, transparent 60%);
          pointer-events: none;
        }
        .hdr-rule {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 18px;
          position: relative; z-index: 1;
        }
        .hdr-rule-line { height: 1px; background: var(--gold-dim); width: 28px; flex-shrink: 0; }
        .hdr-eyebrow {
          font-family: 'Sora', sans-serif;
          font-size: 9px; font-weight: 600;
          letter-spacing: 4px; text-transform: uppercase;
          color: var(--gold);
        }
        .hdr-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 66px; font-weight: 700;
          color: var(--cream); line-height: 0.87;
          letter-spacing: -2px;
          margin-bottom: 24px;
          position: relative; z-index: 1;
        }
        .hdr-title em {
          font-style: italic; font-weight: 400;
          color: var(--cream-dim);
        }
        .hdr-bottom {
          display: flex; align-items: center; gap: 14px;
          position: relative; z-index: 1;
        }
        .hdr-year {
          font-family: 'Sora', sans-serif;
          font-size: 10px; font-weight: 400;
          letter-spacing: 3px; color: var(--cream-faint);
          white-space: nowrap;
        }
        .hdr-bottom-line { flex: 1; height: 1px; background: var(--border); }

        /* ─── FEATURE (Next Up) ─── */
        .feature {
          margin: 20px 16px 0;
          border-radius: 14px;
          padding: 26px 22px;
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.07);
          animation: fadeUp 0.5s 0.08s ease both;
        }
        .feature::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.025) 0%, transparent 55%);
          pointer-events: none;
        }
        .feature-ghost {
          position: absolute;
          right: -6px; top: 50%; transform: translateY(-50%);
          font-family: 'Cormorant Garamond', serif;
          font-size: 148px; font-weight: 700;
          line-height: 1; opacity: 0.08;
          color: #fff;
          pointer-events: none; user-select: none;
          letter-spacing: -6px;
        }
        .feature-top {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 14px;
        }
        .feature-label {
          font-family: 'Sora', sans-serif;
          font-size: 8px; font-weight: 600;
          letter-spacing: 3px; text-transform: uppercase;
          color: rgba(255,255,255,0.35);
        }
        .feature-countdown {
          font-family: 'Sora', sans-serif;
          font-size: 9px; font-weight: 600;
          letter-spacing: 1.5px; text-transform: uppercase;
          color: rgba(255,255,255,0.85);
          background: rgba(255,255,255,0.1);
          padding: 3px 10px; border-radius: 20px;
        }
        .feature-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 28px; font-weight: 700;
          color: #fff; line-height: 1.15;
          margin-bottom: 8px;
        }
        .feature-meta {
          font-family: 'Sora', sans-serif;
          font-size: 11px; font-weight: 400;
          color: rgba(255,255,255,0.48);
        }

        /* ─── FILTERS ─── */
        .filter-row {
          padding: 20px 16px 0;
          display: flex; gap: 6px;
          overflow-x: auto; scrollbar-width: none;
          animation: fadeUp 0.4s 0.12s ease both;
        }
        .filter-row::-webkit-scrollbar { display: none; }
        .fbtn {
          font-family: 'Sora', sans-serif;
          font-size: 11px; font-weight: 500;
          padding: 6px 15px; border-radius: 6px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--cream-faint); cursor: pointer;
          white-space: nowrap; transition: all 0.14s;
          letter-spacing: 0.3px;
        }
        .fbtn:hover { color: var(--cream-dim); border-color: rgba(255,255,255,0.14); }
        .fbtn.all-on   { background: var(--surface-2); border-color: rgba(255,255,255,0.15); color: var(--cream); }
        .fbtn.ym-on    { border-color: #5d8fe8; color: #5d8fe8; background: rgba(93,143,232,0.09); }
        .fbtn.yw-on    { border-color: #d07ec5; color: #d07ec5; background: rgba(208,126,197,0.09); }
        .fbtn.stake-on { border-color: #e07b6a; color: #e07b6a; background: rgba(224,123,106,0.09); }

        /* ─── MONTH SECTIONS ─── */
        .month-section { padding: 20px 16px 0; }
        .month-header {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 10px;
        }
        .month-label {
          font-family: 'Sora', sans-serif;
          font-size: 8px; font-weight: 600;
          letter-spacing: 3.5px; text-transform: uppercase;
          color: var(--gold); white-space: nowrap;
        }
        .month-rule { flex: 1; height: 1px; background: var(--gold-dim); }

        /* ─── CARDS ─── */
        .cards-stack { display: flex; flex-direction: column; gap: 7px; }

        .card {
          background: var(--surface);
          border-radius: 11px;
          border: 1px solid var(--border);
          overflow: hidden;
          cursor: pointer;
          display: flex;
          transition: border-color 0.18s, box-shadow 0.18s, transform 0.14s;
          animation: fadeUp 0.4s ease both;
        }
        .card:hover {
          transform: translateY(-1px);
          border-color: rgba(255,255,255,0.13);
          box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }
        .card.open { border-color: rgba(255,255,255,0.14); }
        .card.past { opacity: 0.38; }
        .card.past:hover { opacity: 0.65; transform: none; box-shadow: none; }

        .card-bar { width: 3px; flex-shrink: 0; }
        .card-inner { flex: 1; min-width: 0; }

        .card-top {
          display: flex; align-items: center;
          gap: 13px; padding: 14px 13px 14px 14px;
          position: relative;
        }

        /* Ghost day number watermark */
        .card-ghost {
          position: absolute;
          right: 36px; top: 50%; transform: translateY(-50%);
          font-family: 'Cormorant Garamond', serif;
          font-size: 80px; font-weight: 700;
          line-height: 1; opacity: 0.055;
          color: #fff;
          pointer-events: none; user-select: none;
          letter-spacing: -3px;
        }

        .datebox {
          text-align: center; min-width: 38px;
          flex-shrink: 0;
        }
        .dm {
          font-family: 'Sora', sans-serif;
          font-size: 8px; font-weight: 600;
          letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--cream-faint); margin-bottom: 1px;
        }
        .dd {
          font-family: 'Cormorant Garamond', serif;
          font-size: 38px; font-weight: 700;
          line-height: 0.85; color: var(--cream);
        }
        .dd-range {
          font-family: 'Cormorant Garamond', serif;
          font-size: 18px; font-weight: 700;
          line-height: 1.15; color: var(--cream);
        }
        .dw {
          font-family: 'Sora', sans-serif;
          font-size: 8px; color: var(--cream-faint);
          margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;
        }

        .vdivider { width: 1px; height: 36px; background: var(--border); flex-shrink: 0; }

        .cbody { flex: 1; min-width: 0; }
        .ctitle {
          font-family: 'Cormorant Garamond', serif;
          font-size: 16px; font-weight: 600;
          color: var(--cream); line-height: 1.25;
          margin-bottom: 4px;
        }
        .cmeta {
          display: flex; align-items: center; gap: 5px;
          font-family: 'Sora', sans-serif; font-size: 11px;
          color: var(--cream-dim); flex-wrap: wrap;
          margin-bottom: 6px;
        }
        .cmeta-time { font-weight: 500; }
        .cmeta-sep { color: var(--cream-faint); }
        .cmeta-loc {
          color: var(--cream-dim);
          white-space: nowrap; overflow: hidden;
          text-overflow: ellipsis; max-width: 140px;
        }
        .tbd {
          font-family: 'Sora', sans-serif;
          font-size: 8px; font-weight: 600;
          letter-spacing: 1px; text-transform: uppercase;
          color: var(--cream-faint);
        }
        .group-pill {
          display: inline-flex; align-items: center;
          font-family: 'Sora', sans-serif;
          font-size: 8px; font-weight: 600;
          letter-spacing: 1.2px; text-transform: uppercase;
          padding: 2px 8px; border-radius: 4px;
        }

        .chev {
          font-size: 13px; color: var(--cream-faint);
          flex-shrink: 0; margin-left: 2px;
          transition: transform 0.2s; line-height: 1;
        }
        .chev.up { transform: rotate(180deg); }

        /* ─── DETAIL PANEL ─── */
        .card-detail {
          border-top: 1px solid var(--border-soft);
          padding: 13px 13px 15px 14px;
          background: var(--surface-2);
        }
        .drow {
          display: flex; gap: 12px; align-items: flex-start;
          margin-bottom: 9px;
          font-family: 'Sora', sans-serif; font-size: 12px;
          color: var(--cream-dim); line-height: 1.5;
        }
        .drow:last-child { margin-bottom: 0; }
        .dlabel {
          font-size: 8px; font-weight: 600;
          letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--gold); min-width: 72px; flex-shrink: 0; padding-top: 3px;
        }
        .dlink { color: #6ba3e8; text-decoration: none; }
        .dlink:hover { text-decoration: underline; }

        .cal-btn {
          display: flex; align-items: center; justify-content: center;
          gap: 7px; width: 100%; margin-top: 13px; padding: 10px 16px;
          color: #fff;
          font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 600;
          letter-spacing: 0.5px;
          border: none; border-radius: 8px; cursor: pointer;
          text-decoration: none; transition: opacity 0.14s, transform 0.1s;
        }
        .cal-btn:hover { opacity: 0.84; transform: translateY(-1px); }

        /* ─── PAST EVENTS ─── */
        .past-toggle {
          display: flex; align-items: center; gap: 10px; width: 100%;
          padding: 16px 0; background: none; border: none; cursor: pointer;
          font-family: 'Sora', sans-serif; font-size: 9px; font-weight: 500;
          letter-spacing: 2.5px; text-transform: uppercase;
          color: var(--cream-faint); transition: color 0.15s;
        }
        .past-toggle:hover { color: var(--cream-dim); }
        .past-toggle-line { flex: 1; height: 1px; background: var(--border); }
        .past-toggle-chev { font-size: 11px; transition: transform 0.2s; }
        .past-toggle-chev.up { transform: rotate(180deg); }

        .empty {
          text-align: center; padding: 52px 24px;
          font-family: 'Sora', sans-serif; font-size: 13px;
          color: var(--cream-faint);
        }

        .footer {
          text-align: center; padding: 36px 24px 48px;
          font-family: 'Sora', sans-serif;
          font-size: 9px; font-weight: 500;
          letter-spacing: 2.5px; text-transform: uppercase;
          color: var(--cream-faint);
          border-top: 1px solid var(--border); margin-top: 28px;
        }

        /* ─── SKELETON ─── */
        .skeleton { padding: 20px 16px 0; display: flex; flex-direction: column; gap: 7px; }
        .skel-card {
          background: var(--surface); border-radius: 11px; height: 78px;
          border: 1px solid var(--border); overflow: hidden;
        }
        .skel-inner {
          height: 100%;
          background: linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.6s infinite;
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .err {
          text-align: center; padding: 48px 24px;
          font-family: 'Sora', sans-serif; font-size: 12px; color: #e07b6a;
        }
        .err small { display: block; margin-top: 6px; font-size: 11px; opacity: 0.6; }

        /* ─── ANIMATIONS ─── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div className="header">
        <div className="hdr-rule">
          <div className="hdr-rule-line" />
          <div className="hdr-eyebrow">Hiram Ward</div>
        </div>
        <div className="hdr-title">Youth<br/><em>Activities</em></div>
        <div className="hdr-bottom">
          <div className="hdr-year">2026 Calendar</div>
          <div className="hdr-bottom-line" />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="skeleton">
          {[0,1,2].map(i => <div key={i} className="skel-card"><div className="skel-inner" /></div>)}
        </div>
      )}

      {/* Error */}
      {error && <div className="err">Could not load events.<small>{error}</small></div>}

      {!loading && !error && <>
      {/* Next Up */}
      {nextEvent && (() => {
        const d = formatDate(nextEvent.date);
        const gs = GROUP_STYLES[nextEvent.group];
        return (
          <div
            className="feature"
            style={{
              background: `linear-gradient(135deg, ${gs.accent}20 0%, ${gs.accent}0c 55%, rgba(255,255,255,0.015) 100%)`,
              borderColor: `${gs.accent}28`,
            }}
          >
            <div className="feature-ghost">{d.day}</div>
            <div className="feature-top">
              <span className="feature-label">Next Up</span>
              <span className="feature-countdown">{getCountdown(nextEvent.date)}</span>
            </div>
            <div className="feature-title">{nextEvent.title}</div>
            <div className="feature-meta">
              {d.weekday}, {d.month} {d.day}
              {nextEvent.time !== "TBD" && ` · ${nextEvent.time}`}
              {` · ${gs.label}`}
            </div>
          </div>
        );
      })()}

      {/* Filters */}
      <div className="filter-row">
        {FILTERS.map(f => {
          const activeClass = filter === f
            ? f === "YM" ? "fbtn ym-on"
            : f === "YW" ? "fbtn yw-on"
            : f === "Stake" ? "fbtn stake-on"
            : "fbtn all-on"
            : "fbtn";
          return (
            <button key={f} className={activeClass} onClick={() => setFilter(f)}>
              {f === "YM" ? "Young Men" : f === "YW" ? "Young Women" : f}
            </button>
          );
        })}
      </div>

      {/* Event List */}
      <div>
        {filtered.length === 0 ? (
          <div className="empty">No upcoming events in this category.</div>
        ) : (() => {
          const grouped = filtered.reduce((acc, ev) => {
            const d = new Date(ev.date + "T12:00:00");
            const key = `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
            (acc[key] = acc[key] || []).push(ev);
            return acc;
          }, {});

          return Object.entries(grouped).map(([month, events]) => (
            <div key={month} className="month-section">
              <div className="month-header">
                <span className="month-label">{month}</span>
                <span className="month-rule" />
              </div>
              <div className="cards-stack">
                {events.map((ev, idx) => {
                  const i = filtered.indexOf(ev);
                  const d = formatDate(ev.date);
                  const gs = GROUP_STYLES[ev.group];
                  const isOpen = expandedId === i;
                  const isTBDTime = ev.time === "TBD";
                  const isTBDLoc = !ev.location || ev.location === "TBD";
                  const calUrl = buildCalendarUrl(ev);

                  return (
                    <div
                      key={i}
                      className={`card${isOpen ? " open" : ""}`}
                      style={{
                        boxShadow: isOpen ? `0 0 0 1px ${gs.accent}30, 0 8px 28px rgba(0,0,0,0.35)` : undefined,
                        animationDelay: `${idx * 55}ms`,
                      }}
                      onClick={() => setExpandedId(isOpen ? null : i)}
                    >
                      <div className="card-bar" style={{ background: gs.accent }} />
                      <div className="card-inner">
                        <div className="card-top">
                          <div className="card-ghost">{d.day}</div>
                          <div className="datebox">
                            <div className="dm" style={{ color: gs.accent }}>{d.month}</div>
                            {ev.endDate
                              ? <div className="dd-range">{d.day}–{formatDate(ev.endDate).day}</div>
                              : <div className="dd">{d.day}</div>
                            }
                            <div className="dw">{d.weekday}</div>
                          </div>
                          <div className="vdivider" />
                          <div className="cbody">
                            <div className="ctitle">{ev.title}</div>
                            <div className="cmeta">
                              <span className="cmeta-time" style={{ color: isTBDTime ? undefined : gs.accent }}>
                                {isTBDTime ? <span className="tbd">Time TBD</span> : ev.time}
                              </span>
                              <span className="cmeta-sep">·</span>
                              <span className="cmeta-loc">
                                {isTBDLoc ? <span className="tbd">Loc TBD</span> : ev.location.split(",")[0]}
                              </span>
                            </div>
                            <span className="group-pill" style={{ background: gs.light, color: gs.accent }}>
                              {gs.label}
                            </span>
                          </div>
                          <div className={`chev${isOpen ? " up" : ""}`}>⌄</div>
                        </div>

                        {isOpen && (
                          <div className="card-detail">
                            {ev.details && (
                              <div className="drow"><span className="dlabel">Details</span><span>{ev.details}</span></div>
                            )}
                            {ev.endDate && (
                              <div className="drow">
                                <span className="dlabel">Dates</span>
                                <span>{formatDateRange(ev.date, ev.endDate)}</span>
                              </div>
                            )}
                            <div className="drow">
                              <span className="dlabel">Time</span>
                              {isTBDTime
                                ? <span style={{ color: "var(--cream-faint)", fontStyle: "italic" }}>To be announced</span>
                                : <span>{ev.time}{ev.endTime ? ` – ${ev.endTime}` : ""}</span>
                              }
                            </div>
                            <div className="drow">
                              <span className="dlabel">Location</span>
                              {isTBDLoc
                                ? <span style={{ color: "var(--cream-faint)", fontStyle: "italic" }}>To be announced</span>
                                : <a className="dlink" href={`https://maps.google.com/?q=${encodeURIComponent(ev.location)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{ev.location} ↗</a>
                              }
                            </div>
                            {ev.leadYouth && <div className="drow"><span className="dlabel">Lead Youth</span><span>{ev.leadYouth}</span></div>}
                            {ev.advisor && <div className="drow"><span className="dlabel">Advisor</span><span>{ev.advisor}</span></div>}
                            <a
                              className="cal-btn"
                              href={calUrl}
                              target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ background: gs.accent }}
                            >
                              📅 Add to Calendar
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ));
        })()}
      </div>

      {/* Past Events */}
      {past.length > 0 && (
        <div style={{ padding: "4px 16px 0" }}>
          <button className="past-toggle" onClick={() => setPastOpen(o => !o)}>
            <span className="past-toggle-line" />
            <span>Earlier this year ({past.length})</span>
            <span className={`past-toggle-chev${pastOpen ? " up" : ""}`}>⌄</span>
            <span className="past-toggle-line" />
          </button>
          {pastOpen && (
            <div className="cards-stack" style={{ marginTop: 4, marginBottom: 8 }}>
              {past.map((ev, i) => {
                const pid = `past-${i}`;
                const d = formatDate(ev.date);
                const gs = GROUP_STYLES[ev.group];
                const isOpen = expandedId === pid;
                const isTBDTime = ev.time === "TBD";
                const isTBDLoc = !ev.location || ev.location === "TBD";
                return (
                  <div
                    key={pid}
                    className={`card past${isOpen ? " open" : ""}`}
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => setExpandedId(isOpen ? null : pid)}
                  >
                    <div className="card-bar" style={{ background: gs.accent }} />
                    <div className="card-inner">
                      <div className="card-top">
                        <div className="card-ghost">{d.day}</div>
                        <div className="datebox">
                          <div className="dm" style={{ color: gs.accent }}>{d.month}</div>
                          <div className="dd">{d.day}</div>
                          <div className="dw">{d.weekday}</div>
                        </div>
                        <div className="vdivider" />
                        <div className="cbody">
                          <div className="ctitle">{ev.title}</div>
                          <div className="cmeta">
                            <span className="cmeta-time">{isTBDTime ? <span className="tbd">Time TBD</span> : ev.time}</span>
                            <span className="cmeta-sep">·</span>
                            <span className="cmeta-loc">{isTBDLoc ? <span className="tbd">Loc TBD</span> : ev.location.split(",")[0]}</span>
                          </div>
                          <span className="group-pill" style={{ background: gs.light, color: gs.accent }}>{gs.label}</span>
                        </div>
                        <div className={`chev${isOpen ? " up" : ""}`}>⌄</div>
                      </div>
                      {isOpen && (
                        <div className="card-detail">
                          {ev.details && <div className="drow"><span className="dlabel">Details</span><span>{ev.details}</span></div>}
                          <div className="drow">
                            <span className="dlabel">Time</span>
                            {isTBDTime ? <span style={{ color: "var(--cream-faint)", fontStyle: "italic" }}>To be announced</span> : <span>{ev.time}{ev.endTime ? ` – ${ev.endTime}` : ""}</span>}
                          </div>
                          <div className="drow">
                            <span className="dlabel">Location</span>
                            {isTBDLoc ? <span style={{ color: "var(--cream-faint)", fontStyle: "italic" }}>To be announced</span> : <a className="dlink" href={`https://maps.google.com/?q=${encodeURIComponent(ev.location)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{ev.location} ↗</a>}
                          </div>
                          {ev.leadYouth && <div className="drow"><span className="dlabel">Lead Youth</span><span>{ev.leadYouth}</span></div>}
                          {ev.advisor && <div className="drow"><span className="dlabel">Advisor</span><span>{ev.advisor}</span></div>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      </>}

      <div className="footer">Hiram Ward Young Men &amp; Young Women · 2026</div>
    </div>
  );
}
