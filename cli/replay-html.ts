import type { TraceDetail } from "../lib/trace-store";

export function renderReplayHtml(trace: TraceDetail) {
  const payload = {
    id: trace.id,
    session: trace.session,
    title: trace.title || trace.session,
    url: trace.lastUrl || trace.startUrl || "",
    startedAt: trace.startedAt,
    endedAt: trace.endedAt ?? null,
    hasVideo: trace.hasVideo,
    hasPoster: trace.hasPoster,
    commands: trace.commands.map((cmd) => ({
      id: cmd.id,
      ts: cmd.ts,
      label: cmd.label,
      durationMs: cmd.durationMs,
      exitCode: cmd.exitCode,
    })),
    console: trace.console,
    errors: trace.errors,
    network: trace.network,
    snapshot: trace.snapshot,
    urls: trace.urls,
  };
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Browzer · ${escapeHtml(payload.title)}</title>
  <style>
    :root {
      --bg: oklch(0.155 0.02 250);
      --raise: oklch(0.2 0.022 250);
      --ink: oklch(0.94 0.012 250);
      --muted: oklch(0.72 0.025 250);
      --faint: oklch(0.55 0.02 250);
      --line: oklch(0.3 0.02 250);
      --panel: oklch(0.965 0.014 155);
      --panel-ink: oklch(0.22 0.04 155);
      --panel-muted: oklch(0.42 0.045 155);
      --panel-line: oklch(0.88 0.02 155);
      --panel-fill: oklch(0.94 0.018 155);
      --live: oklch(0.42 0.12 155);
      --live-bright: oklch(0.78 0.15 155);
      --danger: oklch(0.63 0.19 25);
      --chrome: oklch(0.22 0.012 250);
      --chrome-ink: oklch(0.86 0.01 250);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--ink); }
    body { font-family: ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.011em; }
    button { font: inherit; }
    code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .app { display: flex; flex-direction: column; gap: 16px; padding: 16px; height: 100dvh; overflow: hidden; }
    .row { display: flex; flex-direction: column; gap: 16px; flex: 1; min-height: 0; }
    .main { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
    @media (min-width: 960px) {
      .row { flex-direction: row; }
    }
    .top { display: flex; justify-content: space-between; padding: 0 4px; font-size: 12px; }
    .kicker { text-transform: uppercase; letter-spacing: 0.16em; color: var(--muted); }
    .meta { color: var(--faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .frame { flex: 1; min-height: 240px; display: flex; flex-direction: column; overflow: hidden; border-radius: 12px; background: var(--chrome); color: var(--chrome-ink); }
    .chrome { display: flex; align-items: center; gap: 12px; padding: 10px 12px; }
    .dots { display: flex; gap: 6px; padding-left: 4px; }
    .dots span { width: 10px; height: 10px; border-radius: 50%; }
    .url { flex: 1; min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: transparent; padding: 4px 0; font-size: 12px; }
    .stage { position: relative; flex: 1; min-height: 0; background: #000; }
    .stage video, .stage img { width: 100%; height: 100%; object-fit: contain; }
    .empty { display: flex; height: 100%; align-items: center; justify-content: center; font-size: 12px; color: var(--faint); }
    .rail { width: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--panel); color: var(--panel-ink); border-radius: 12px; }
    @media (min-width: 960px) { .rail { width: 300px; flex-shrink: 0; } }
    @media (max-width: 959px) { .rail { max-height: 42dvh; } }
    .rail-head { flex-shrink: 0; padding: 20px 24px 8px; }
    .replay-kicker { font-size: 11px; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: var(--live); }
    .timer { margin: 8px 0 0; font-family: ui-monospace, Menlo, monospace; font-size: clamp(2.75rem, 5vw, 4.25rem); font-weight: 500; letter-spacing: -0.03em; line-height: 0.9; font-variant-numeric: tabular-nums; }
    .secs { margin: 6px 0 0; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--panel-muted); }
    .steps { flex: 1; min-height: 0; overflow-y: auto; padding: 0 20px 16px; margin: 0; list-style: none; }
    .step { width: 100%; display: flex; gap: 12px; padding: 10px 8px; border: 0; background: transparent; text-align: left; border-radius: 6px; cursor: pointer; color: inherit; }
    .step:hover, .step.current { background: var(--panel-fill); }
    .dot { width: 14px; height: 14px; margin-top: 6px; flex-shrink: 0; border-radius: 50%; border: 2px solid var(--panel-line); }
    .dot.done { background: var(--live); border-color: var(--live); }
    .dot.error { background: var(--danger); border-color: var(--danger); }
    .dot.running { border-color: var(--live); background: color-mix(in oklch, var(--live) 20%, white); box-shadow: 0 0 0 4px color-mix(in oklch, var(--live) 18%, transparent); }
    .label { flex: 1; min-width: 0; font-size: 14px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .label.pending { color: var(--panel-muted); }
    .t { flex-shrink: 0; font-size: 11px; font-variant-numeric: tabular-nums; color: var(--panel-muted); }
    .rail-foot { flex-shrink: 0; margin-top: auto; border-top: 1px solid var(--panel-line); padding: 12px 24px 16px; }
    .count { margin: 0; font-size: 22px; font-weight: 500; letter-spacing: -0.02em; }
    .hint { margin: 4px 0 0; font-size: 13px; color: var(--panel-muted); }
    .detail-bar { flex: 0 0 auto; align-self: flex-start; border: 0; border-radius: 8px; background: var(--raise); color: var(--muted); padding: 8px 12px; cursor: pointer; font-size: 13px; }
    .detail-bar:hover { color: var(--ink); }
    .details { display: flex; flex-direction: column; flex: 0 0 240px; height: 240px; min-height: 240px; max-height: 240px; overflow: hidden; border-radius: 12px; background: var(--raise); }
    .details[hidden] { display: none !important; }
    .tabs { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; border-bottom: 1px solid var(--line); padding: 8px 12px 0; }
    .tabs button { border: 0; background: transparent; color: var(--muted); padding: 8px 12px; border-radius: 6px 6px 0 0; cursor: pointer; font-size: 13px; }
    .tabs button.on { background: var(--bg); color: var(--ink); }
    .tabs .hide { margin-left: auto; }
    .panel { flex: 1; min-height: 0; overflow: auto; padding: 12px 16px; font-size: 12px; line-height: 1.55; font-family: ui-monospace, Menlo, monospace; }
    .err { color: var(--danger); }
    .muted { color: var(--muted); }
    .faint { color: var(--faint); }
    .net { display: grid; grid-template-columns: 2.5em 3.5em 1fr; gap: 8px; }
  </style>
</head>
<body>
  <div class="app">
    <div class="row">
      <div class="main">
        <div class="top">
          <span class="kicker mono">Browzer</span>
          <span class="meta mono" id="heading"></span>
        </div>
        <section class="frame">
          <header class="chrome">
            <div class="dots" aria-hidden="true"><span style="background:#ff5f57"></span><span style="background:#febc2e"></span><span style="background:#28c840"></span></div>
            <p class="url mono" id="url"></p>
          </header>
          <div class="stage" id="stage"></div>
        </section>
        <button type="button" class="detail-bar" id="show-details">Show details</button>
        <section class="details" id="details" hidden>
          <div class="tabs" id="tabs"></div>
          <div class="panel" id="panel"></div>
        </section>
      </div>
      <aside class="rail">
        <div class="rail-head">
          <p class="replay-kicker mono">Replay</p>
          <p class="timer" id="timer">0.00</p>
          <p class="secs mono">Seconds elapsed</p>
        </div>
        <ol class="steps" id="steps"></ol>
        <div class="rail-foot">
          <p class="count" id="count">0 actions executed</p>
          <p class="hint" id="median"></p>
        </div>
      </aside>
    </div>
  </div>
  <script id="data" type="application/json">${json}</script>
  <script>
    const T = JSON.parse(document.getElementById("data").textContent);
    document.getElementById("heading").textContent = T.title + " · " + T.id;
    document.getElementById("url").textContent = (T.urls && T.urls[0] && T.urls[0].url) || T.url || "about:blank";
    const stage = document.getElementById("stage");
    let video = null;
    if (T.hasVideo) {
      video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.src = "session.mp4";
      if (T.hasPoster) video.poster = "poster.jpg";
      stage.appendChild(video);
    } else if (T.hasPoster) {
      const img = document.createElement("img");
      img.src = "poster.jpg";
      img.alt = "Last captured frame";
      stage.appendChild(img);
    } else {
      stage.innerHTML = '<div class="empty mono">No recording was saved</div>';
    }

    const origin = (T.commands[0] && T.commands[0].ts) || T.startedAt;
    function scaleFor(duration) {
      const maxT = T.commands.reduce((m, c) => Math.max(m, Math.max(0, (c.ts - origin) / 1000)), 0);
      return duration > 0 && maxT > duration + 0.25 ? Math.max(0, duration - 0.08) / maxT : 1;
    }
    function cueList(duration) {
      const scale = scaleFor(duration);
      return T.commands.map((c) => ({ id: c.id, seconds: Math.max(0, (c.ts - origin) / 1000) * scale }));
    }
    function urlAt(t, duration) {
      const scale = scaleFor(duration);
      let url = (T.urls && T.urls[0] && T.urls[0].url) || T.url || "about:blank";
      for (const point of T.urls || []) {
        const seconds = Math.max(0, (point.ts - origin) / 1000) * scale;
        if (seconds <= t + 0.04) url = point.url;
      }
      return url;
    }
    function visual(id, t, duration, cues) {
      const cue = cues.find((c) => c.id === id);
      if (!cue) return "pending";
      if (duration > 0 && t >= Math.max(0, duration - 0.08)) return "done";
      if (t + 0.04 < cue.seconds) return "pending";
      let active = null;
      for (const c of cues) if (c.seconds <= t + 0.04) active = c.id;
      return active === id ? "running" : "done";
    }
    function clock(s) {
      const m = Math.floor(Math.max(0, s) / 60);
      const sec = Math.floor(Math.max(0, s) % 60);
      return m + ":" + String(sec).padStart(2, "0");
    }
    const stepsEl = document.getElementById("steps");
    T.commands.forEach((cmd) => {
      const li = document.createElement("li");
      li.innerHTML = '<button class="step" type="button"><span class="dot"></span><span class="label"></span><span class="t mono"></span></button>';
      li.querySelector(".label").textContent = cmd.label;
      li.querySelector("button").addEventListener("click", () => {
        const cues = cueList(video && video.duration || 0);
        const cue = cues.find((c) => c.id === cmd.id);
        if (video && cue) { video.currentTime = cue.seconds; video.play(); }
      });
      stepsEl.appendChild(li);
    });
    function render(t) {
      const duration = video && isFinite(video.duration) ? video.duration : 0;
      const cues = cueList(duration);
      document.getElementById("timer").textContent = t.toFixed(2);
      document.getElementById("url").textContent = urlAt(t, duration);
      let done = 0;
      [...stepsEl.children].forEach((li, i) => {
        const cmd = T.commands[i];
        const cue = cues[i];
        const state = visual(cmd.id, t, duration, cues);
        if (state === "done") done += 1;
        const dot = li.querySelector(".dot");
        const label = li.querySelector(".label");
        const btn = li.querySelector("button");
        dot.className = "dot " + (cmd.exitCode && state === "done" ? "error" : state);
        label.className = "label" + (state === "pending" ? " pending" : "");
        btn.className = "step" + (state === "running" ? " current" : "");
        li.querySelector(".t").textContent = cue ? clock(cue.seconds) : "";
      });
      document.getElementById("count").textContent = done + (done === 1 ? " action executed" : " actions executed");
      const durs = T.commands.map((c) => c.durationMs).filter((n) => n > 0).sort((a,b) => a-b);
      let med = "";
      if (durs.length) {
        const mid = Math.floor(durs.length / 2);
        const ms = durs.length % 2 ? durs[mid] : (durs[mid-1] + durs[mid]) / 2;
        med = (ms < 1000 ? Math.round(ms) + "ms" : (ms/1000).toFixed(1) + "s") + " median step";
      }
      document.getElementById("median").textContent = med;
    }
    if (video) {
      video.addEventListener("timeupdate", () => render(video.currentTime));
      video.addEventListener("loadedmetadata", () => render(video.currentTime || 0));
      video.addEventListener("seeked", () => render(video.currentTime));
      video.addEventListener("play", () => {
        const tick = () => { if (!video.paused && !video.ended) { render(video.currentTime); requestAnimationFrame(tick); } };
        requestAnimationFrame(tick);
      });
    }
    render(0);

    const details = document.getElementById("details");
    const showBtn = document.getElementById("show-details");
    function setDetails(open) {
      details.hidden = !open;
      showBtn.hidden = open;
    }
    showBtn.addEventListener("click", () => setDetails(true));
    setDetails(false);

    const tabs = ["Console", "Network", "Errors", "Snapshot"];
    const tabsEl = document.getElementById("tabs");
    const panel = document.getElementById("panel");
    let on = "Console";
    function paint() {
      [...tabsEl.children].forEach((b) => b.classList.toggle("on", b.dataset.tab === on));
      if (on === "Console") {
        panel.innerHTML = T.console.length ? T.console.map((m) =>
          '<div class="' + (m.type === "error" ? "err" : "muted") + '"><span class="faint">' + esc(m.type).toUpperCase() + "</span> " + esc(m.text) + "</div>"
        ).join("") : '<p class="faint">No console output.</p>';
      } else if (on === "Network") {
        panel.innerHTML = T.network.length ? T.network.map((r) =>
          '<div class="net ' + (r.status >= 400 ? "err" : "muted") + '"><span>' + (r.status || "—") + "</span><span class='faint'>" + esc(r.method) + "</span><span>" + esc(r.url) + "</span></div>"
        ).join("") : '<p class="faint">No HAR was saved.</p>';
      } else if (on === "Errors") {
        const items = T.errors.map((e) => e.text).concat(T.console.filter((m) => m.type === "error").map((m) => m.text));
        panel.innerHTML = items.length ? items.map((t) => '<div class="err">' + esc(t) + "</div>").join("") : '<p class="faint">No page or console errors.</p>';
      } else {
        panel.innerHTML = T.snapshot ? "<pre class='muted' style='white-space:pre-wrap;margin:0'>" + esc(T.snapshot) + "</pre>" : '<p class="faint">No snapshot was saved.</p>';
      }
    }
    function esc(s) {
      return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    tabs.forEach((name) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.tab = name;
      const extra = name === "Console" ? T.console.length : name === "Network" ? T.network.length : name === "Errors" ? (T.errors.length + T.console.filter((m)=>m.type==="error").length) : "";
      b.textContent = extra === "" ? name : name + " " + extra;
      b.addEventListener("click", () => { on = name; paint(); });
      tabsEl.appendChild(b);
    });
    const hide = document.createElement("button");
    hide.type = "button";
    hide.className = "hide";
    hide.textContent = "Hide";
    hide.addEventListener("click", () => setDetails(false));
    tabsEl.appendChild(hide);
    paint();
  </script>
</body>
</html>
`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}
