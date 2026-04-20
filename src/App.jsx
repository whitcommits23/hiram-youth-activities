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
  YM:       { accent: "#1e4d8c", light: "#eaf0fb", label: "Young Men"   },
  YW:       { accent: "#7a2466", light: "#f9edf6", label: "Young Women" },
  Combined: { accent: "#1f6140", light: "#eaf5ee", label: "Combined"    },
  Stake:    { accent: "#8b2232", light: "#f9edef", label: "Stake"       },
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

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,800;1,9..144,400;1,9..144,700&family=Outfit:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body { background: #ede9e0; -webkit-font-smoothing: antialiased; }

  /* ── Header ── */
  .hdr {
    background: #1c2a18;
    padding: 44px 24px 36px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .hdr::before {
    content: '';
    position: absolute; inset: 0;
    background-image: radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 18px 18px;
    pointer-events: none;
  }
  .hdr-eyebrow {
    font-family: 'Outfit', sans-serif;
    font-size: 10px; font-weight: 600;
    letter-spacing: 4px; text-transform: uppercase;
    color: #b8a96a; margin-bottom: 14px;
    position: relative;
  }
  .hdr-title {
    font-family: 'Fraunces', serif;
    font-size: 62px; font-weight: 800;
    color: #fff; line-height: 0.92;
    letter-spacing: -1px; margin-bottom: 16px;
    position: relative;
  }
  .hdr-rule {
    display: flex; align-items: center;
    justify-content: center; gap: 10px;
    margin-bottom: 14px; position: relative;
  }
  .hdr-rule-line { width: 28px; height: 1px; background: rgba(184,169,106,0.5); }
  .hdr-rule-diamond {
    width: 5px; height: 5px;
    background: #b8a96a; transform: rotate(45deg);
  }
  .hdr-sub {
    font-family: 'Outfit', sans-serif;
    font-size: 11px; font-weight: 500;
    letter-spacing: 2px; text-transform: uppercase;
    color: rgba(255,255,255,0.35);
    position: relative;
  }

  /* ── Next Up ── */
  .next-wrap { padding: 20px 16px 0; }
  .next-card {
    background: #1e3a5f;
    border-radius: 12px;
    padding: 18px 20px 20px;
    position: relative;
    overflow: hidden;
  }
  .next-card::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 60%);
    pointer-events: none;
  }
  .next-label {
    position: absolute; top: 14px; right: 16px;
    font-family: 'Outfit', sans-serif;
    font-size: 9px; font-weight: 600;
    letter-spacing: 2.5px; text-transform: uppercase;
    color: rgba(255,255,255,0.35);
  }
  .next-meta {
    font-family: 'Outfit', sans-serif;
    font-size: 11px; font-weight: 500;
    letter-spacing: 1px; text-transform: uppercase;
    color: rgba(255,255,255,0.45);
    text-align: center; margin-bottom: 10px;
  }
  .next-title {
    font-family: 'Fraunces', serif;
    font-size: 22px; font-weight: 700;
    color: #fff; line-height: 1.15;
    text-align: center; margin-bottom: 12px;
  }
  .next-pill-wrap { display: flex; justify-content: center; }
  .next-pill {
    font-family: 'Outfit', sans-serif;
    font-size: 11px; font-weight: 600;
    color: rgba(255,255,255,0.85);
    background: rgba(255,255,255,0.12);
    padding: 4px 14px; border-radius: 999px;
  }

  /* ── Filters ── */
  .filters {
    padding: 18px 16px 0;
    display: flex; gap: 8px;
    overflow-x: auto; scrollbar-width: none;
  }
  .filters::-webkit-scrollbar { display: none; }
  .ftab {
    font-family: 'Outfit', sans-serif;
    font-size: 13px; font-weight: 600;
    padding: 7px 18px; border-radius: 999px;
    border: 1.5px solid #c5bba8;
    background: transparent;
    color: #5c5749; cursor: pointer;
    white-space: nowrap; transition: all 0.14s;
  }
  .ftab:hover { border-color: #9a9284; color: #1a1710; }
  .ftab.on-all   { background: #1a1710; border-color: #1a1710; color: #fff; }
  .ftab.on-ym    { background: #1e4d8c; border-color: #1e4d8c; color: #fff; }
  .ftab.on-yw    { background: #7a2466; border-color: #7a2466; color: #fff; }
  .ftab.on-stake { background: #8b2232; border-color: #8b2232; color: #fff; }

  /* ── Month headers ── */
  .month-section { padding: 24px 16px 0; }
  .month-name {
    font-family: 'Fraunces', serif;
    font-size: 36px; font-weight: 800;
    color: #1a1710; line-height: 1;
  }
  .month-year {
    font-family: 'Outfit', sans-serif;
    font-size: 12px; font-weight: 500;
    color: #9a9284; margin-top: 2px; margin-bottom: 12px;
  }

  /* ── Cards ── */
  .cards-stack { display: flex; flex-direction: column; gap: 8px; }

  .card {
    background: #fff;
    border-radius: 10px;
    border: 1.5px solid #e8e3d8;
    overflow: hidden;
    cursor: pointer;
    display: flex;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .card:hover { box-shadow: 0 3px 14px rgba(0,0,0,0.08); }
  .card.open  { box-shadow: 0 4px 18px rgba(0,0,0,0.1); }
  .card.past  { opacity: 0.55; }
  .card.past:hover { opacity: 0.82; }

  .card-bar { width: 4px; flex-shrink: 0; }
  .card-inner { flex: 1; min-width: 0; }

  .card-top {
    display: flex; align-items: center;
    gap: 12px; padding: 13px 14px 13px 12px;
  }

  .datebox {
    text-align: center; min-width: 46px; flex-shrink: 0;
    padding: 4px 2px;
  }
  .dm {
    font-family: 'Outfit', sans-serif;
    font-size: 9px; font-weight: 700;
    letter-spacing: 1.5px; text-transform: uppercase;
    color: #9a9284;
  }
  .dd {
    font-family: 'Fraunces', serif;
    font-size: 34px; font-weight: 800;
    font-style: italic; line-height: 1; margin: 1px 0;
  }
  .dd-range {
    font-family: 'Fraunces', serif;
    font-size: 19px; font-weight: 800;
    font-style: italic; line-height: 1.15; margin: 2px 0;
  }
  .dw {
    font-family: 'Outfit', sans-serif;
    font-size: 9px; color: #9a9284; letter-spacing: 0.3px;
  }

  .cbody { flex: 1; min-width: 0; }
  .ctitle {
    font-family: 'Fraunces', serif;
    font-size: 16px; font-weight: 700;
    color: #1a1710; line-height: 1.2; margin-bottom: 4px;
  }
  .cmeta {
    display: flex; align-items: center; gap: 5px;
    font-family: 'Outfit', sans-serif; font-size: 12px;
    color: #5c5749; flex-wrap: wrap; margin-bottom: 6px;
  }
  .cmeta-time { font-weight: 600; color: #1a1710; }
  .cmeta-sep  { color: #c5bba8; }
  .cmeta-loc  {
    color: #5c5749; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; max-width: 150px;
  }
  .tbd {
    font-family: 'Outfit', sans-serif;
    font-size: 9px; font-weight: 700; letter-spacing: 0.8px;
    color: #9a9284; background: #f0ece4;
    border-radius: 3px; padding: 1px 5px;
  }
  .gpill {
    display: inline-flex; align-items: center;
    font-family: 'Outfit', sans-serif;
    font-size: 10px; font-weight: 600;
    letter-spacing: 0.3px;
    padding: 2px 10px; border-radius: 999px;
  }
  .chev {
    font-size: 13px; color: #9a9284;
    flex-shrink: 0; margin-left: 4px;
    transition: transform 0.2s; line-height: 1;
  }
  .chev.up { transform: rotate(180deg); }

  /* ── Detail panel ── */
  .card-detail {
    border-top: 1px solid #f0ece4;
    padding: 13px 14px 15px 12px;
    background: #f5f2ec;
  }
  .drow {
    display: flex; gap: 10px; align-items: flex-start;
    margin-bottom: 8px;
    font-family: 'Outfit', sans-serif; font-size: 13px; color: #5c5749;
    line-height: 1.5;
  }
  .drow:last-child { margin-bottom: 0; }
  .dlabel { font-weight: 600; color: #1a1710; min-width: 80px; flex-shrink: 0; font-size: 12px; }
  .dlink { color: #1e4d8c; text-decoration: none; }
  .dlink:hover { text-decoration: underline; }

  .cal-btn {
    display: flex; align-items: center; justify-content: center;
    gap: 7px; width: 100%; margin-top: 13px; padding: 10px 16px;
    color: #fff;
    font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600;
    letter-spacing: 0.4px;
    border: none; border-radius: 7px; cursor: pointer;
    text-decoration: none; transition: opacity 0.15s;
  }
  .cal-btn:hover { opacity: 0.86; }

  /* ── Past toggle ── */
  .past-toggle {
    display: flex; align-items: center; gap: 10px; width: 100%;
    padding: 16px 0; background: none; border: none; cursor: pointer;
    font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 700;
    letter-spacing: 2.5px; text-transform: uppercase;
    color: #9a9284; transition: color 0.15s;
  }
  .past-toggle:hover { color: #5c5749; }
  .past-toggle-line { flex: 1; height: 1px; background: #d8d2c4; }
  .past-toggle-chev { font-size: 12px; transition: transform 0.2s; }
  .past-toggle-chev.up { transform: rotate(180deg); }

  /* ── Skeleton ── */
  .skeleton { padding: 20px 16px 0; display: flex; flex-direction: column; gap: 8px; }
  .skel-card {
    background: #fff; border-radius: 10px; height: 78px;
    border: 1.5px solid #e8e3d8; overflow: hidden;
  }
  .skel-inner {
    height: 100%;
    background: linear-gradient(90deg, #f5f2ec 25%, #eae6de 50%, #f5f2ec 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .empty {
    text-align: center; padding: 52px 24px;
    font-family: 'Outfit', sans-serif; font-size: 13px; color: #9a9284;
  }
  .err {
    text-align: center; padding: 48px 24px;
    font-family: 'Outfit', sans-serif; font-size: 12px; color: #8b2232;
  }
  .err small { display: block; margin-top: 6px; font-size: 11px; opacity: 0.6; }

  .footer {
    text-align: center; padding: 32px 24px 48px;
    font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 500;
    letter-spacing: 2px; text-transform: uppercase; color: #9a9284;
  }
`;

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
    <div style={{ minHeight: "100vh", background: "#ede9e0" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div className="hdr">
        <div className="hdr-eyebrow">Hiram Ward</div>
        <div className="hdr-title">Youth<br/>Activities</div>
        <div className="hdr-rule">
          <div className="hdr-rule-line" />
          <div className="hdr-rule-diamond" />
          <div className="hdr-rule-line" />
        </div>
        <div className="hdr-sub">2026 Calendar</div>
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
            <div className="next-wrap">
              <div className="next-card">
                <span className="next-label">Next Up</span>
                <div className="next-meta">
                  {d.weekday} · {d.month} {d.day}
                  {nextEvent.time !== "TBD" && ` · ${nextEvent.time}`}
                </div>
                <div className="next-title">{nextEvent.title}</div>
                <div className="next-pill-wrap">
                  <span className="next-pill">{gs.label}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Filters */}
        <div className="filters">
          {FILTERS.map(f => {
            const cls = filter !== f ? "ftab"
              : f === "YM" ? "ftab on-ym"
              : f === "YW" ? "ftab on-yw"
              : f === "Stake" ? "ftab on-stake"
              : "ftab on-all";
            return (
              <button key={f} className={cls} onClick={() => setFilter(f)}>
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
              const mKey = MONTHS_FULL[d.getMonth()];
              const yKey = d.getFullYear();
              const key = `${mKey}|||${yKey}`;
              (acc[key] = acc[key] || { month: mKey, year: yKey, events: [] }).events.push(ev);
              return acc;
            }, {});

            return Object.values(grouped).map(({ month, year, events: evts }) => (
              <div key={`${month}${year}`} className="month-section">
                <div className="month-name">{month}</div>
                <div className="month-year">{year}</div>
                <div className="cards-stack">
                  {evts.map((ev) => {
                    const i = filtered.indexOf(ev);
                    const d = formatDate(ev.date);
                    const gs = GROUP_STYLES[ev.group];
                    const isOpen = expandedId === i;
                    const isTBDTime = ev.time === "TBD";
                    const isTBDLoc = !ev.location || ev.location === "TBD";
                    return (
                      <div
                        key={i}
                        className={`card${isOpen ? " open" : ""}`}
                        style={isOpen ? { borderColor: gs.accent } : {}}
                        onClick={() => setExpandedId(isOpen ? null : i)}
                      >
                        <div className="card-bar" style={{ background: gs.accent }} />
                        <div className="card-inner">
                          <div className="card-top">
                            <div className="datebox">
                              <div className="dm">{d.month}</div>
                              {ev.endDate
                                ? <div className="dd-range" style={{ color: gs.accent }}>{d.day}–{formatDate(ev.endDate).day}</div>
                                : <div className="dd" style={{ color: gs.accent }}>{d.day}</div>
                              }
                              <div className="dw">{d.weekday}</div>
                            </div>
                            <div className="cbody">
                              <div className="ctitle">{ev.title}</div>
                              <div className="cmeta">
                                <span className="cmeta-time">{isTBDTime ? <span className="tbd">TIME TBD</span> : ev.time}</span>
                                <span className="cmeta-sep">·</span>
                                <span className="cmeta-loc">{isTBDLoc ? <span className="tbd">LOC TBD</span> : ev.location.split(",")[0]}</span>
                              </div>
                              <span className="gpill" style={{ background: gs.light, color: gs.accent }}>{gs.label}</span>
                            </div>
                            <div className={`chev${isOpen ? " up" : ""}`}>⌄</div>
                          </div>
                          {isOpen && (
                            <div className="card-detail">
                              {ev.details && <div className="drow"><span className="dlabel">Details</span><span>{ev.details}</span></div>}
                              {ev.endDate && <div className="drow"><span className="dlabel">Dates</span><span>{formatDateRange(ev.date, ev.endDate)}</span></div>}
                              <div className="drow">
                                <span className="dlabel">Time</span>
                                {isTBDTime ? <span style={{ color: "#9a9284", fontStyle: "italic" }}>To be announced</span> : <span>{ev.time}{ev.endTime ? ` – ${ev.endTime}` : ""}</span>}
                              </div>
                              <div className="drow">
                                <span className="dlabel">Location</span>
                                {isTBDLoc ? <span style={{ color: "#9a9284", fontStyle: "italic" }}>To be announced</span> : <a className="dlink" href={`https://maps.google.com/?q=${encodeURIComponent(ev.location)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{ev.location} ↗</a>}
                              </div>
                              {ev.leadYouth && <div className="drow"><span className="dlabel">Lead Youth</span><span>{ev.leadYouth}</span></div>}
                              {ev.advisor && <div className="drow"><span className="dlabel">Advisor</span><span>{ev.advisor}</span></div>}
                              <a className="cal-btn" href={buildCalendarUrl(ev)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ background: gs.accent }}>
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
                    <div key={pid} className={`card past${isOpen ? " open" : ""}`} style={isOpen ? { borderColor: gs.accent } : {}} onClick={() => setExpandedId(isOpen ? null : pid)}>
                      <div className="card-bar" style={{ background: gs.accent }} />
                      <div className="card-inner">
                        <div className="card-top">
                          <div className="datebox">
                            <div className="dm">{d.month}</div>
                            <div className="dd" style={{ color: gs.accent }}>{d.day}</div>
                            <div className="dw">{d.weekday}</div>
                          </div>
                          <div className="cbody">
                            <div className="ctitle">{ev.title}</div>
                            <div className="cmeta">
                              <span className="cmeta-time">{isTBDTime ? <span className="tbd">TIME TBD</span> : ev.time}</span>
                              <span className="cmeta-sep">·</span>
                              <span className="cmeta-loc">{isTBDLoc ? <span className="tbd">LOC TBD</span> : ev.location.split(",")[0]}</span>
                            </div>
                            <span className="gpill" style={{ background: gs.light, color: gs.accent }}>{gs.label}</span>
                          </div>
                          <div className={`chev${isOpen ? " up" : ""}`}>⌄</div>
                        </div>
                        {isOpen && (
                          <div className="card-detail">
                            {ev.details && <div className="drow"><span className="dlabel">Details</span><span>{ev.details}</span></div>}
                            <div className="drow"><span className="dlabel">Time</span>{isTBDTime ? <span style={{ color: "#9a9284", fontStyle: "italic" }}>To be announced</span> : <span>{ev.time}{ev.endTime ? ` – ${ev.endTime}` : ""}</span>}</div>
                            <div className="drow"><span className="dlabel">Location</span>{isTBDLoc ? <span style={{ color: "#9a9284", fontStyle: "italic" }}>To be announced</span> : <a className="dlink" href={`https://maps.google.com/?q=${encodeURIComponent(ev.location)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{ev.location} ↗</a>}</div>
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
