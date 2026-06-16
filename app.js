/* ===== Cube Timer ===== */
(() => {
  "use strict";

  const KEY = "cubeSolves.v1";

  /* ---------- storage ---------- */
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  };
  const save = (arr) => localStorage.setItem(KEY, JSON.stringify(arr));

  let solves = load(); // {id, ms, date, note}

  /* ---------- helpers ---------- */
  const fmt = (ms) => {
    if (ms == null) return "—";
    const totalSec = ms / 1000;
    if (totalSec >= 60) {
      const m = Math.floor(totalSec / 60);
      const s = (totalSec % 60).toFixed(2).padStart(5, "0");
      return `${m}:${s}`;
    }
    return totalSec.toFixed(2);
  };

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString([], {
      year: "2-digit", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  // WCA-style average: drop fastest & slowest, mean the rest. Needs >= 3.
  const average = (list) => {
    if (list.length < 3) return null;
    const xs = [...list].sort((a, b) => a - b);
    const trimmed = xs.slice(1, -1);
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  };
  // Average of last N solves (chronological), null if not enough.
  const aoN = (n, upto = solves.length) => {
    const slice = solves.slice(Math.max(0, upto - n), upto).map(s => s.ms);
    return slice.length === n ? average(slice) : null;
  };

  const bestMs = () => solves.length ? Math.min(...solves.map(s => s.ms)) : null;

  /* ===========================================================
     TIMER
     =========================================================== */
  const stage = document.getElementById("timerStage");
  const display = document.getElementById("timerDisplay");
  const hint = document.getElementById("timerHint");
  const noteBox = document.getElementById("noteBox");
  const noteInput = document.getElementById("noteInput");
  const noteTime = document.getElementById("noteTime");

  let running = false;
  let startAt = 0;
  let rafId = null;
  let pendingMs = null; // a finished solve awaiting note/save

  const tick = () => {
    display.textContent = fmt(performance.now() - startAt);
    rafId = requestAnimationFrame(tick);
  };

  const startTimer = () => {
    // discard any unsaved pending solve when starting fresh
    if (pendingMs != null) commitPending("");
    running = true;
    startAt = performance.now();
    display.textContent = "0.00";
    stage.classList.add("running");
    hint.innerHTML = "Press <kbd>Space</kbd> to stop";
    noteBox.classList.add("hidden");
    rafId = requestAnimationFrame(tick);
  };

  const stopTimer = () => {
    running = false;
    cancelAnimationFrame(rafId);
    const ms = performance.now() - startAt;
    display.textContent = fmt(ms);
    stage.classList.remove("running");
    hint.innerHTML = "Press <kbd>Space</kbd> for next solve";
    // open note box
    pendingMs = ms;
    noteTime.textContent = fmt(ms);
    noteInput.value = "";
    noteBox.classList.remove("hidden");
    noteInput.focus();
  };

  // Persist the pending solve with whatever note we have.
  const commitPending = (note) => {
    if (pendingMs == null) return;
    solves.push({
      id: Date.now() + Math.random().toString(36).slice(2, 6),
      ms: pendingMs,
      date: new Date().toISOString(),
      note: (note || "").trim()
    });
    save(solves);
    pendingMs = null;
    renderAll();
  };

  const toggle = () => (running ? stopTimer() : startTimer());

  // Space handling — ignore when typing in the note field.
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space") return;
    const typing = document.activeElement === noteInput;
    if (typing) return;          // let space type a space in the note
    if (e.repeat) return;        // ignore key-hold autorepeat
    e.preventDefault();
    toggle();
  });

  // Click / tap the stage also toggles.
  stage.addEventListener("click", () => toggle());

  /* note box buttons */
  document.getElementById("saveNoteBtn").addEventListener("click", () => {
    commitPending(noteInput.value);
    noteBox.classList.add("hidden");
    stage.focus();
  });
  document.getElementById("discardBtn").addEventListener("click", () => {
    pendingMs = null;
    noteBox.classList.add("hidden");
    display.textContent = "0.00";
    hint.innerHTML = "Press <kbd>Space</kbd> to start";
    stage.focus();
  });
  // Enter in the note input saves.
  noteInput.addEventListener("keydown", (e) => {
    if (e.code === "Enter") { e.preventDefault(); document.getElementById("saveNoteBtn").click(); }
  });

  /* ===========================================================
     RENDERING
     =========================================================== */
  const quickStats = document.getElementById("quickStats");
  const solvesBody = document.getElementById("solvesBody");
  const historyEmpty = document.getElementById("historyEmpty");
  const statCards = document.getElementById("statCards");
  const leaderboard = document.getElementById("leaderboard");
  const chart = document.getElementById("chart");

  const renderQuick = () => {
    const n = solves.length;
    const last = n ? solves[n - 1].ms : null;
    quickStats.innerHTML = `
      <span>Solves <b>${n}</b></span>
      <span>Last <b>${fmt(last)}</b></span>
      <span>Best <b>${fmt(bestMs())}</b></span>
      <span>Ao5 <b>${fmt(aoN(5))}</b></span>
      <span>Ao12 <b>${fmt(aoN(12))}</b></span>`;
  };

  const renderHistory = () => {
    historyEmpty.classList.toggle("hidden", solves.length > 0);
    const best = bestMs();
    solvesBody.innerHTML = solves.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="time ${s.ms === best ? "pb" : ""}">${fmt(s.ms)}${s.ms === best ? ' <span class="pb-tag">best</span>' : ""}</td>
        <td>${fmtDate(s.date)}</td>
        <td class="note">${escapeHtml(s.note) || "<span style='opacity:.4'>—</span>"}</td>
        <td><button class="row-del" data-id="${s.id}" title="Delete">&#xD7;</button></td>
      </tr>`).reverse().join("");
  };

  const renderStats = () => {
    const n = solves.length;
    const all = solves.map(s => s.ms);
    const best = bestMs();
    const worst = n ? Math.max(...all) : null;
    const mean = n ? all.reduce((a, b) => a + b, 0) / n : null;

    // trend: mean of first half vs second half
    let trend = "";
    if (n >= 6) {
      const half = Math.floor(n / 2);
      const firstMean = avg(all.slice(0, half));
      const lastMean = avg(all.slice(n - half));
      const diff = firstMean - lastMean; // positive = faster now
      const pct = (Math.abs(diff) / firstMean * 100).toFixed(1);
      trend = diff >= 0
        ? `${pct}% faster than when you started`
        : `${pct}% slower than when you started`;
    }

    const card = (label, value, sub = "", good = false) => `
      <div class="card">
        <div class="label">${label}</div>
        <div class="value ${good ? "good" : ""}">${value}</div>
        ${sub ? `<div class="sub">${sub}</div>` : ""}
      </div>`;

    statCards.innerHTML =
      card("Solves", n) +
      card("Best", fmt(best), trend, true) +
      card("Mean", fmt(mean)) +
      card("Worst", fmt(worst)) +
      card("Best Ao5", fmt(bestAoWindow(5))) +
      card("Best Ao12", fmt(bestAoWindow(12)));
  };

  const renderLeaderboard = () => {
    const top = [...solves].sort((a, b) => a.ms - b.ms).slice(0, 10);
    leaderboard.innerHTML = top.length
      ? top.map(s => `
          <li>
            <span class="lb-time">${fmt(s.ms)}</span>
            <span class="lb-meta">${fmtDate(s.date)}${s.note ? " · " + escapeHtml(s.note) : ""}</span>
          </li>`).join("")
      : `<li style="border:none;color:var(--muted)">No solves yet.</li>`;
  };

  const renderChart = () => {
    const W = 880, H = 260, pad = { l: 48, r: 12, t: 14, b: 24 };
    const data = solves.map(s => s.ms);
    if (data.length < 2) {
      chart.innerHTML = `<p class="empty">Need at least 2 solves to plot a trend.</p>`;
      return;
    }
    const ao5series = solves.map((_, i) => aoN(5, i + 1));
    const min = Math.min(...data) * 0.92;
    const max = Math.max(...data) * 1.05;
    const x = (i) => pad.l + (i / (data.length - 1)) * (W - pad.l - pad.r);
    const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);

    const line = (vals) => vals
      .map((v, i) => v == null ? null : `${x(i)},${y(v).toFixed(1)}`)
      .filter(Boolean).join(" ");

    // y gridlines
    const ticks = 4;
    let grid = "";
    for (let i = 0; i <= ticks; i++) {
      const v = min + (i / ticks) * (max - min);
      const yy = y(v).toFixed(1);
      grid += `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="var(--hairline)" stroke-width="1"/>`;
      grid += `<text x="${pad.l - 8}" y="${+yy + 4}" text-anchor="end" font-size="12" font-style="italic" fill="var(--muted)">${fmt(v)}</text>`;
    }

    const dots = data.map((v, i) =>
      `<circle cx="${x(i)}" cy="${y(v).toFixed(1)}" r="2.5" fill="var(--fg)"><title>${fmt(v)} — ${fmtDate(solves[i].date)}</title></circle>`
    ).join("");

    chart.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        ${grid}
        <polyline points="${line(data)}" fill="none" stroke="var(--fg)" stroke-width="1.5" stroke-linejoin="round"/>
        <polyline points="${line(ao5series)}" fill="none" stroke="var(--faint)" stroke-width="1.5" stroke-dasharray="5 4" stroke-linejoin="round"/>
        ${dots}
      </svg>`;
  };

  const renderAll = () => {
    renderQuick();
    renderHistory();
    renderStats();
    renderLeaderboard();
    renderChart();
  };

  /* small numeric helpers */
  function avg(a) { return a.reduce((x, y) => x + y, 0) / a.length; }
  function bestAoWindow(n) {
    let best = null;
    for (let i = n; i <= solves.length; i++) {
      const a = average(solves.slice(i - n, i).map(s => s.ms));
      if (a != null && (best == null || a < best)) best = a;
    }
    return best;
  }
  function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- history actions ---------- */
  solvesBody.addEventListener("click", (e) => {
    const btn = e.target.closest(".row-del");
    if (!btn) return;
    const id = btn.dataset.id;
    solves = solves.filter(s => s.id !== id);
    save(solves);
    renderAll();
  });

  document.getElementById("clearBtn").addEventListener("click", () => {
    if (!solves.length) return;
    if (confirm(`Delete all ${solves.length} solves? This can't be undone.`)) {
      solves = [];
      save(solves);
      renderAll();
    }
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(solves, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cube-times-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const importFile = document.getElementById("importFile");
  document.getElementById("importBtn").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", () => {
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(reader.result);
        if (!Array.isArray(incoming)) throw new Error("not an array");
        const valid = incoming.filter(s => typeof s.ms === "number");
        const existing = new Set(solves.map(s => s.id));
        valid.forEach(s => { if (!existing.has(s.id)) solves.push(s); });
        solves.sort((a, b) => new Date(a.date) - new Date(b.date));
        save(solves);
        renderAll();
        alert(`Imported ${valid.length} solves.`);
      } catch (err) {
        alert("Could not import file: " + err.message);
      }
      importFile.value = "";
    };
    reader.readAsText(file);
  });

  /* ---------- tabs ---------- */
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("view-" + tab.dataset.view).classList.add("active");
      if (tab.dataset.view === "timer") stage.focus();
    });
  });

  /* ---------- boot ---------- */
  renderAll();
  stage.focus();
})();
