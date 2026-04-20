import { useState, useMemo } from "react";

const CHURCH = "Hiram Ward Building, Hiram, OH";

// group: "YM" | "YW" | "Combined" | "Stake"
// endDate: optional "YYYY-MM-DD" for multi-day events
const EVENTS = [
  { date: "2026-04-21", time: "7:00 PM", endTime: "8:00 PM", title: "Suture Day", group: "YM", details: "", location: CHURCH, leadYouth: "David Mars", advisor: "" },
  { date: "2026-04-28", time: "7:00 PM", endTime: "8:00 PM", title: "Spam Day / Cupcake Decorating", group: "Combined", details: "", location: CHURCH, leadYouth: "David Mars", advisor: "" },
  { date: "2026-05-05", time: "7:00 PM", endTime: "8:00 PM", title: "Cinco De Mayo (Taco Tuesday)", group: "YM", details: "", location: CHURCH, leadYouth: "", advisor: "" },
  { date: "2026-05-12", time: "7:00 PM", endTime: "8:00 PM", title: "Pickle Ball", group: "Combined", details: "", location: CHURCH, leadYouth: "", advisor: "" },
  { date: "2026-05-19", time: "7:00 PM", endTime: "8:00 PM", title: "Cemetery Flag Placement", group: "YM", details: "", location: "TBD", leadYouth: "", advisor: "" },
  { date: "2026-05-26", time: "7:00 PM", endTime: "8:00 PM", title: "Hobby Day", group: "YM", details: "", location: CHURCH, leadYouth: "", advisor: "" },
  { date: "2026-06-02", time: "7:00 PM", endTime: "8:00 PM", title: "Prep for Camp", group: "YM", details: "", location: CHURCH, leadYouth: "", advisor: "" },
  { date: "2026-06-08", time: "TBD", endTime: "", endDate: "2026-06-13", title: "Youth Camp", group: "Stake", details: "", location: "TBD", leadYouth: "", advisor: "" },
  { date: "2026-06-16", time: "7:00 PM", endTime: "8:00 PM", title: "Airsoft", group: "YM", details: "", location: "TBD", leadYouth: "Daniel Sears", advisor: "" },
  { date: "2026-06-23", time: "7:00 PM", endTime: "8:00 PM", title: "Camp Games", group: "YM", details: "", location: CHURCH, leadYouth: "", advisor: "" },
  { date: "2026-06-30", time: "TBD", endTime: "", title: "Go Ape", group: "YM", details: "", location: "Go Ape Treetop Adventure, Cuyahoga Valley", leadYouth: "", advisor: "" },
  { date: "2026-07-08", time: "TBD", endTime: "", endDate: "2026-07-11", title: "Youth Conference", group: "Stake", details: "", location: "OSU, Columbus, OH", leadYouth: "", advisor: "" },
  { date: "2026-07-14", time: "TBD", endTime: "", title: "Float the River", group: "Combined", details: "", location: "TBD", leadYouth: "", advisor: "" },
  { date: "2026-07-21", time: "7:00 PM", endTime: "8:00 PM", title: "Dutch Oven Cooking (Peach Cobbler)", group: "YM", details: "", location: CHURCH, leadYouth: "", advisor: "" },
  { date: "2026-07-28", time: "7:00 PM", endTime: "8:00 PM", title: "Range Day / Ice Cream", group: "YM", details: "", location: "TBD", leadYouth: "Taylor Mars", advisor: "" },
  { date: "2026-08-04", time: "7:00 PM", endTime: "8:00 PM", title: "Funny Cooking Video", group: "YM", details: "", location: CHURCH, leadYouth: "", advisor: "" },
  { date: "2026-08-11", time: "7:00 PM", endTime: "8:00 PM", title: "Iron Chef Competition", group: "Combined", details: "", location: CHURCH, leadYouth: "", advisor: "" },
  { date: "2026-08-18", time: "7:00 PM", endTime: "8:00 PM", title: "Service for the Noices", group: "YM", details: "Service project for Mars neighbor", location: "1943 Old Forge Rd, Brimfield, OH", leadYouth: "", advisor: "" },
  { date: "2026-08-25", time: "7:00 PM", endTime: "8:00 PM", title: "Capture the Flag", group: "YM", details: "", location: CHURCH, leadYouth: "", advisor: "" },
];

const GROUP_STYLES = {
  YM:       { accent: "#1a2744", light: "#eef2f8", label: "Young Men",   pill: "#1a2744", pillText: "#fff" },
  YW:       { accent: "#7c2d6e", light: "#f8eef5", label: "Young Women", pill: "#7c2d6e", pillText: "#fff" },
  Combined: { accent: "#1a5c3a", light: "#eef5f0", label: "Combined",    pill: "#1a5c3a", pillText: "#fff" },
  Stake:    { accent: "#7a1f2e", light: "#f8eef0", label: "Stake",       pill: "#7a1f2e", pillText: "#fff" },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return {
    month: MONTHS[d.getMonth()],
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
  return `${diff} days away`;
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
  const [filter, setFilter] = useState("All");
  const [expandedId, setExpandedId] = useState(null);
  const [pastOpen, setPastOpen] = useState(false);

  const filtered = useMemo(() =>
    deduped(
      EVENTS
        .filter(e => isUpcoming(e.date))
        .filter(e => matchesFilter(e, filter))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
    ),
    [filter]
  );

  const past = useMemo(() =>
    deduped(
      EVENTS
        .filter(e => !isUpcoming(e.date))
        .filter(e => matchesFilter(e, filter))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
    ),
    [filter]
  );

  const nextEvent = filtered[0];

  return (
    <div style={{ minHeight: "100vh", background: "#f4f1eb" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .header { background: #1a2744; padding: 40px 24px 32px; text-align: center; position: relative; overflow: hidden; }
        .header::before { content: ''; position: absolute; top: -60px; left: 50%; transform: translateX(-50%); width: 400px; height: 400px; background: radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%); pointer-events: none; }
        .eyebrow { font-family: 'DM Sans', sans-serif; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #d4af37; margin-bottom: 10px; }
        .h-title { font-family: 'Playfair Display', serif; font-size: 34px; font-weight: 900; color: #fff; line-height: 1.1; margin-bottom: 6px; }
        .h-sub { font-family: 'DM Sans', sans-serif; color: rgba(255,255,255,0.5); font-size: 14px; }

        .next-banner { margin: 20px 16px 0; border-radius: 14px; padding: 16px 20px; display: flex; align-items: center; gap: 12px; }
        .next-pill { color: #fff; font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; white-space: nowrap; background: rgba(0,0,0,0.18); }
        .next-countdown { color: rgba(255,255,255,0.85); font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 500; white-space: nowrap; background: rgba(255,255,255,0.15); padding: 3px 9px; border-radius: 20px; }
        .next-body { flex: 1; min-width: 0; }
        .next-title { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .next-sub { font-family: 'DM Sans', sans-serif; font-size: 12px; margin-top: 2px; opacity: 0.7; }

        .filter-row { padding: 18px 16px 0; display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
        .filter-row::-webkit-scrollbar { display: none; }
        .fbtn { font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; padding: 7px 18px; border-radius: 20px; border: 1.5px solid #c5bba8; background: transparent; color: #5a5248; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
        .fbtn.ym-on    { background: #1a2744; border-color: #1a2744; color: #fff; }
        .fbtn.yw-on    { background: #7c2d6e; border-color: #7c2d6e; color: #fff; }
        .fbtn.com-on   { background: #1a5c3a; border-color: #1a5c3a; color: #fff; }
        .fbtn.all-on   { background: #3a3530; border-color: #3a3530; color: #fff; }
        .fbtn.stake-on { background: #7a1f2e; border-color: #7a1f2e; color: #fff; }

        .list { padding: 14px 16px 8px; display: flex; flex-direction: column; gap: 10px; }

        .card { background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.07); cursor: pointer; transition: box-shadow 0.2s, transform 0.15s; border: 1.5px solid transparent; }
        .card:hover { box-shadow: 0 6px 18px rgba(0,0,0,0.11); transform: translateY(-1px); }
        .card.open { border-width: 1.5px; }

        .card-stripe { height: 4px; width: 100%; }

        .card-top { display: flex; align-items: center; gap: 14px; padding: 14px 16px; }

        .datebox { min-width: 50px; text-align: center; padding: 8px 5px; background: #f4f1eb; border-radius: 10px; flex-shrink: 0; }
        .dm { font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
        .dd { font-family: 'Playfair Display', serif; font-size: 25px; font-weight: 700; color: #1a2744; line-height: 1; }
        .dw { font-family: 'DM Sans', sans-serif; font-size: 10px; color: #9e9489; margin-top: 2px; }

        .cbody { flex: 1; min-width: 0; }
        .ctitle { font-family: 'Playfair Display', serif; font-size: 15px; font-weight: 700; color: #1a2744; line-height: 1.3; margin-bottom: 4px; }
        .cmeta { display: flex; align-items: center; gap: 5px; margin-bottom: 6px; font-family: 'DM Sans', sans-serif; font-size: 12px; flex-wrap: wrap; }
        .cmeta-time { font-weight: 600; color: #1a2744; }
        .cmeta-sep { color: #d0c8bc; }
        .cmeta-loc { color: #7a7068; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; }
        .tbd { display: inline-block; font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.8px; color: #aaa098; background: #f0ece4; border-radius: 4px; padding: 1px 5px; vertical-align: middle; }
        .group-pill { display: inline-flex; align-items: center; font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600; padding: 2px 9px; border-radius: 20px; }

        .chev { font-size: 16px; color: #c5bba8; transition: transform 0.2s; flex-shrink: 0; margin-left: 2px; }
        .chev.up { transform: rotate(180deg); }

        .card-detail { border-top: 1px solid #f0ece4; padding: 14px 16px 16px; background: #fdfcfa; }
        .drow { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 8px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: #5a5248; }
        .drow:last-child { margin-bottom: 0; }
        .dlabel { font-weight: 600; color: #1a2744; min-width: 78px; flex-shrink: 0; }
        .dlink { color: #1a6baf; text-decoration: none; }
        .dlink:hover { text-decoration: underline; }

        .cal-btn { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; margin-top: 14px; padding: 11px 16px; color: #fff; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; text-decoration: none; transition: opacity 0.15s; }
        .cal-btn:hover { opacity: 0.88; }

        .month-header { font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #9e9489; padding: 8px 2px 6px; border-bottom: 1px solid #e8e2d8; margin-bottom: 2px; }
        .past-toggle { display: flex; align-items: center; gap: 8px; width: 100%; padding: 12px 16px; margin: 8px 0 0; background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; color: #9e9489; letter-spacing: 0.5px; }
        .past-toggle:hover { color: #5a5248; }
        .past-toggle-line { flex: 1; height: 1px; background: #e8e2d8; }
        .past-toggle-chev { font-size: 14px; transition: transform 0.2s; }
        .past-toggle-chev.up { transform: rotate(180deg); }
        .card.past { opacity: 0.6; }
        .card.past:hover { opacity: 0.85; }
        .empty { text-align: center; padding: 60px 24px; color: #b0a898; font-family: 'DM Sans', sans-serif; font-size: 14px; }
        .footer { text-align: center; padding: 24px; font-family: 'DM Sans', sans-serif; font-size: 12px; color: #c5bba8; }
      `}</style>

      {/* Header */}
      <div className="header">
        <div className="eyebrow">Hiram Ward</div>
        <div className="h-title">Youth<br/>Activities</div>
        <div className="h-sub">2026 Activity Calendar</div>
      </div>

      {/* Next Up Banner */}
      {nextEvent && (() => {
        const d = formatDate(nextEvent.date);
        const gs = GROUP_STYLES[nextEvent.group];
        return (
          <div className="next-banner" style={{ background: `linear-gradient(135deg, ${gs.accent}ee, ${gs.accent}bb)` }}>
            <span className="next-pill">Next Up</span>
            <span className="next-countdown">{getCountdown(nextEvent.date)}</span>
            <div className="next-body">
              <div className="next-title" style={{ color: "#fff" }}>{nextEvent.title}</div>
              <div className="next-sub" style={{ color: "#fff" }}>
                {d.weekday}, {d.month} {d.day}
                {nextEvent.time !== "TBD" && ` · ${nextEvent.time}`}
                {` · ${gs.label}`}
              </div>
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
      <div className="list">
        {filtered.length === 0 ? (
          <div className="empty">No upcoming events in this category.</div>
        ) : (() => {
          const grouped = filtered.reduce((acc, ev) => {
            const d = new Date(ev.date + "T12:00:00");
            const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
            (acc[key] = acc[key] || []).push(ev);
            return acc;
          }, {});

          return Object.entries(grouped).map(([month, events]) => (
            <div key={month}>
              <div className="month-header">{month}</div>
              {events.map((ev) => {
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
              style={isOpen ? { borderColor: gs.accent } : {}}
              onClick={() => setExpandedId(isOpen ? null : i)}
            >
              <div className="card-stripe" style={{ background: gs.accent }} />

              <div className="card-top">
                <div className="datebox">
                  <div className="dm" style={{ color: gs.accent }}>{d.month}</div>
                  {ev.endDate
                    ? <div className="dd" style={{ fontSize: 14, lineHeight: "1.3" }}>{d.day}–{formatDate(ev.endDate).day}</div>
                    : <div className="dd">{d.day}</div>
                  }
                  <div className="dw">{ev.endDate ? formatDate(ev.endDate).month !== d.month ? `${d.weekday}–${formatDate(ev.endDate).weekday}` : d.weekday : d.weekday}</div>
                </div>

                <div className="cbody">
                  <div className="ctitle">{ev.title}</div>
                  <div className="cmeta">
                    <span className="cmeta-time">{isTBDTime ? <span className="tbd">TIME TBD</span> : ev.time}</span>
                    <span className="cmeta-sep">·</span>
                    <span className="cmeta-loc">{isTBDLoc ? <span className="tbd">LOCATION TBD</span> : ev.location.split(",")[0]}</span>
                  </div>
                  <span
                    className="group-pill"
                    style={{ background: gs.light, color: gs.accent }}
                  >
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
                      ? <span style={{ color: "#b0a898", fontStyle: "italic" }}>To be announced</span>
                      : <span>{ev.time}{ev.endTime ? ` – ${ev.endTime}` : ""}</span>
                    }
                  </div>
                  <div className="drow">
                    <span className="dlabel">Location</span>
                    {isTBDLoc
                      ? <span style={{ color: "#b0a898", fontStyle: "italic" }}>To be announced</span>
                      : <a className="dlink" href={`https://maps.google.com/?q=${encodeURIComponent(ev.location)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{ev.location} ↗</a>
                    }
                  </div>
                  {ev.leadYouth && <div className="drow"><span className="dlabel">Lead Youth</span><span>{ev.leadYouth}</span></div>}
                  {ev.advisor && <div className="drow"><span className="dlabel">Advisor</span><span>{ev.advisor}</span></div>}

                  <a
                    className="cal-btn"
                    href={calUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ background: gs.accent }}
                  >
                    📅 Add to Calendar
                  </a>
                </div>
              )}
            </div>
                );
              })}
            </div>
          ));
        })()}
      </div>

      {/* Past Events */}
      {past.length > 0 && (
        <div style={{ padding: "0 16px" }}>
          <button className="past-toggle" onClick={() => setPastOpen(o => !o)}>
            <span className="past-toggle-line" />
            <span>Earlier this year ({past.length})</span>
            <span className={`past-toggle-chev${pastOpen ? " up" : ""}`}>⌄</span>
            <span className="past-toggle-line" />
          </button>
          {pastOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
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
                    style={isOpen ? { borderColor: gs.accent } : {}}
                    onClick={() => setExpandedId(isOpen ? null : pid)}
                  >
                    <div className="card-stripe" style={{ background: gs.accent }} />
                    <div className="card-top">
                      <div className="datebox">
                        <div className="dm" style={{ color: gs.accent }}>{d.month}</div>
                        <div className="dd">{d.day}</div>
                        <div className="dw">{d.weekday}</div>
                      </div>
                      <div className="cbody">
                        <div className="ctitle">{ev.title}</div>
                        <div className="cmeta">
                          <span className="cmeta-time">{isTBDTime ? <span className="tbd">TIME TBD</span> : ev.time}</span>
                          <span className="cmeta-sep">·</span>
                          <span className="cmeta-loc">{isTBDLoc ? <span className="tbd">LOCATION TBD</span> : ev.location.split(",")[0]}</span>
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
                          {isTBDTime ? <span style={{ color: "#b0a898", fontStyle: "italic" }}>To be announced</span> : <span>{ev.time}{ev.endTime ? ` – ${ev.endTime}` : ""}</span>}
                        </div>
                        <div className="drow">
                          <span className="dlabel">Location</span>
                          {isTBDLoc ? <span style={{ color: "#b0a898", fontStyle: "italic" }}>To be announced</span> : <a className="dlink" href={`https://maps.google.com/?q=${encodeURIComponent(ev.location)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{ev.location} ↗</a>}
                        </div>
                        {ev.leadYouth && <div className="drow"><span className="dlabel">Lead Youth</span><span>{ev.leadYouth}</span></div>}
                        {ev.advisor && <div className="drow"><span className="dlabel">Advisor</span><span>{ev.advisor}</span></div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="footer">Hiram Ward Young Men & Young Women · Updated April 2026</div>
    </div>
  );
}
