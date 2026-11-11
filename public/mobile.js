// Martley's phone app. Drivers do walk-around checks and report defects;
// mechanics work job sheets. Data comes from the server (store.js); only the
// signed-in person and an unfinished check are kept in localStorage.
(function () {
  "use strict";
  const { I, esc, fmtD, fmtDay, fmtT, fmtDT, isoOf, today, km, eur, mins, hrs, initials, pill, prioPill, statusPill, duePill, avClass, toast, lsGet, lsSet } = M;

  let S = null, X = null, me = null;
  let draft = null;      // walk-around check in progress
  let jobDraft = null;   // new job card (Details tab before it is saved)
  let defDraft = null;   // ad-hoc defect report
  const ui = { q: "", jobsTab: "active", jq: "", hTab: "all", sheet: null };
  const sigs = {};
  const LS = { me: "martleys-m-me", draft: "martleys-m-draft" };

  const $ = s => document.querySelector(s);
  const scroller = () => { const s = $("#app > .scr"); return s && s.scrollHeight > s.clientHeight ? s : document.scrollingElement; };
  const toTop = () => { const s = $("#app > .scr"); if (s) s.scrollTop = 0; window.scrollTo(0, 0); };
  function keep(fn) { const s = scroller(), y = s.scrollTop; fn(); const s2 = scroller(); s2.scrollTop = y; }
  const save = () => Store.sync(S);

  /* ---------- routing ---------- */
  function route() {
    const [path, qs] = location.hash.replace(/^#\/?/, "").split("?");
    const parts = path.split("/").filter(Boolean);
    return { parts, name: parts[0] || "", q: Object.fromEntries(new URLSearchParams(qs || "")) };
  }
  const go = h => { location.hash = h; };
  window.addEventListener("hashchange", () => { ui.sheet = null; render(); toTop(); });

  function render() {
    const app = $("#app");
    if (!S) { app.innerHTML = `<div class="scr"><div class="empty" style="margin-top:40vh">Loading…</div></div>`; return; }
    me = me && X.person(me.id);
    if (!me || me.role === "admin") { app.innerHTML = `<div class="scr">${login()}</div>`; return; }
    const r = route();
    let html;
    try { html = view(r); } catch (e) { console.error(e); html = screen("Error", `<div class="card pad">Something went wrong. <a href="#/">Go home</a></div>`); }
    app.innerHTML = `<div class="scr">${html}${ui.sheet ? sheet() : ""}</div>`;
    sbTone();
    const scr = $("#app > .scr"); if (scr) scr.onscroll = sbTone;
    document.querySelectorAll("canvas[data-sig]").forEach(cv => {
      const k = cv.dataset.sig;
      M.sigPad(cv, k === "draft" ? draft && draft.sig : sigs[k], url => {
        if (k === "draft") { draft.sig = url; lsSet(LS.draft, draft); const b = $("#submitbtn"); if (b) b.disabled = !b.dataset.ready; }
        else { sigs[k] = url; const b = $("#closebtn"); if (b) b.disabled = false; }
      });
    });
    tick();
  }
  // White status-bar text while a dark header (home hero, login) sits under it; dark otherwise.
  function sbTone() {
    const h = document.querySelector("#app .hero"), scr = $("#app > .scr");
    const dark = !!(ui.sheet ? 0 : h && h.offsetHeight - (scr ? scr.scrollTop : 0) > 50);
    document.body.dataset.sb = dark ? "light" : "dark";
  }
  setInterval(tick, 1000);
  function tick() { document.querySelectorAll("[data-since]").forEach(el => { el.textContent = clockText((Date.now() - Number(el.dataset.since)) / 1000 + Number(el.dataset.base || 0) * 60); }); }
  const clockText = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 3600) + ":" + M.pad(Math.floor(s / 60) % 60) + ":" + M.pad(s % 60); };

  function view(r) {
    switch (r.name) {
      case "": return home();
      case "fleet": return fleet();
      case "check": return r.parts[1] === "new" ? checkFlow(r.q) : checkView(r.parts[1], r.q);
      case "history": return history();
      case "defect": return reportDefect(r.q);
      case "jobs": if (r.q.tab) { ui.jobsTab = r.q.tab; window.history.replaceState(null, "", "#/jobs"); } return jobsList();
      case "job": return r.parts[1] === "new" ? jobNew(r.q) : jobSheet(r.parts[1], r.q.tab || "details");
      default: return screen("Not found", `<div class="empty">Page not found. <a href="#/">Home</a></div>`);
    }
  }

  // Standard screen: sticky top bar, body, optional dock or bottom tabs.
  function screen(title, body, opt = {}) {
    const back = opt.back === false ? `<span class="side"></span>` : `<a class="round" href="${opt.back || "#/"}" aria-label="Back">${I("left", 20, 2.4)}</a>`;
    return `<div class="bar"><span style="width:42px">${back}</span><div class="ttl">${esc(title)}</div><span class="side">${opt.right || ""}</span></div>
      <div class="body">${body}</div>${opt.dock ? `<div class="dock">${opt.dock}</div>` : tabs()}`;
  }
  function tabs() {
    const r = route();
    const openN = S.jobs.filter(j => j.status !== "Complete").length;
    const items = [["", "home", "Home"], ["check/new", "clip", "Walk-around"], ["jobs", "wrench", "Job sheets", openN], ["history", "list", "Checks"]];
    const cur = r.name === "check" && r.parts[1] === "new" ? "check/new" : r.name === "check" ? "history" : r.name === "job" ? "jobs" : r.name;
    return `<nav class="tabs">${items.map(([h, ic, l, n]) => `<a href="#/${h}" class="${cur === h ? "on" : ""}"><span class="ti">${I(ic, 21)}</span>${l}${n ? `<span class="badge">${n}</span>` : ""}</a>`).join("")}</nav>`;
  }
  const meBtn = (dark) => `<button class="${avClass(me)}" style="${dark ? "" : "width:40px;height:40px"}" onclick="A.sheet('me')" aria-label="Profile">${initials(me.name)}</button>`;
  const vTag = (v, lg) => `<span class="fleetno ${lg ? "lg" : ""}">${esc(v.fleet)}</span>`;

  /* ---------- login ---------- */
  let pinFor = null, pin = "";
  function login() {
    const p = pinFor && X.person(pinFor);
    const ppl = S.staff.filter(s => s.role !== "admin").sort((a, b) => a.name.localeCompare(b.name));
    const people = `<h3 style="margin:20px 2px 10px">Who's signing in?</h3><div class="people">${ppl.map(s => `<button class="person" onclick="A.pick('${s.id}')"><span class="${avClass(s)}">${initials(s.name)}</span><span class="ellipsis">${esc(s.name)}</span></button>`).join("")}</div>`;
    return `<div class="login"><div class="hero"><div class="top"><img src="logo.png" alt="Martley's"></div><h1>Vehicle checks<br>&amp; job sheets</h1><p>Sign in to start your walk-around check.</p></div>
      <div class="sheet">${p ? `
        <button class="round" onclick="A.pick(null)" aria-label="Back">${I("left", 20, 2.4)}</button>
        <div style="text-align:center;margin-top:-6px"><div class="${avClass(p)} lg" style="margin:0 auto">${initials(p.name)}</div><h2 style="margin-top:12px;font-size:20px">${esc(p.name)}</h2><div class="muted small">Enter your PIN</div>
          <div class="pindots" id="pindots">${[0, 1, 2, 3].map(i => `<i class="${i < pin.length ? "f" : ""}"></i>`).join("")}</div></div>
        <div class="pinpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button onclick="A.key('${n}')">${n}</button>`).join("")}<span></span><button onclick="A.key('0')">0</button><button class="del" onclick="A.key('del')" aria-label="Delete">⌫</button></div>
        <p class="muted xs" style="text-align:center;margin-top:16px">Demo PIN ${p.pin}</p>`
      : people + `<p class="muted xs" style="margin-top:20px">Demo PIN 1111 for everyone. The office uses the <a href="/admin/" style="text-decoration:underline">desktop admin</a>.</p>`}</div></div>`;
  }

  /* ---------- home dashboard (drivers and mechanics) ---------- */
  // Like the Dashboard tab in Martley's current app: a greeting, the one thing to do now,
  // big tiles for every feature, then what needs attention.
  function tile(href, ic, color, title, sub, badge) {
    return `<a class="qa ${color}" href="${href}">${badge ? `<span class="qb">${badge}</span>` : ""}<span class="qi">${I(ic, 22, 2.2)}</span><b>${title}</b><span>${sub}</span></a>`;
  }
  function home() {
    const hr = new Date().getHours();
    const vor = S.vehicles.filter(X.vorJob);
    const checkedN = S.vehicles.filter(v => X.checkedToday(v)).length;
    const head = `<div class="hero"><div class="top"><img src="logo.png" alt="Martley's">${meBtn(true)}</div>
        <h1>Good ${hr < 12 ? "morning" : hr < 18 ? "afternoon" : "evening"},<br>${esc(me.name.split(" ")[0])}</h1><p>${M.DOW[new Date().getDay()]} ${fmtD(today())} · Kilminchy depot</p>
        <div class="hchips"><a href="#/fleet"><i class="dot ${vor.length ? "red" : "green"}"></i>${vor.length ? vor.length + " off road" : "Full fleet available"}</a><a href="#/fleet"><i class="dot blue"></i>${checkedN}/${S.vehicles.length} checked today</a></div></div>`;
    return head + `<div class="body lift">${allHome(vor)}</div>${tabs()}`;
  }

  function allHome(vor) {
    const open = S.jobs.filter(j => j.status !== "Complete");
    const myJobs = open.filter(j => j.mechId === me.id);
    const myDefs = open.filter(j => j.reportedBy === me.id && j.item);
    const mine = S.checks.filter(c => c.driverId === me.id).sort((a, b) => b.at - a.at);
    const todays = mine.filter(c => isoOf(c.at) === today());
    const recent = S.checks.slice().sort((a, b) => b.at - a.at);
    const todayDefs = X.checksOn(today()).reduce((a, c) => a + M.defectsOf(c).length, 0);
    const attention = open.filter(j => j.priority === "VOR" || !j.mechId).sort((a, b) => (a.priority === "VOR" ? 0 : 1) - (b.priority === "VOR" ? 0 : 1) || b.created - a.created);
    const run = S.jobs.find(j => (j.labour || []).some(l => !l.end && l.mechId === me.id));
    const dv = draft && X.veh(draft.vehicleId);
    let now;
    if (run) {
      // a job on the clock is the most important thing on screen
      const v = X.veh(run.vehicleId), l = run.labour.find(x => !x.end && x.mechId === me.id);
      now = `<div class="start oncl"><div class="row"><div class="ic">${I("clock", 26)}</div><div class="grow"></div>${pill("green", "On the clock")}</div>
        <h2>#${esc(run.id)} · ${esc(v.fleet)}</h2><p class="ellipsis">${esc(run.title)}</p>
        <div class="bigtime"><span data-since="${l.start}">${clockText((Date.now() - l.start) / 1000)}</span></div>
        <div class="row"><a class="btn pri grow" href="#/job/${run.id}?tab=work">Open job sheet</a><button class="btn danger" onclick="A.clock('${run.id}')">${I("stop", 16)} Stop</button></div></div>`;
    } else {
      now = `<a class="start" href="#/check/new"><div class="row"><div class="ic">${I("clip", 26)}</div><div class="grow"></div>${dv ? pill("amber", "In progress") : todays.length ? pill("green", I("check", 12, 3) + " Done today") : pill("amber", "Due before first trip")}</div>
        <h2>${dv ? "Continue check on " + esc(dv.fleet) : todays.length ? "Checking another vehicle?" : "Start your walk-around check"}</h2>
        <p>${dv ? esc(dv.reg) + " · " + Object.keys(draft.results).length + " items done so far" : todays.length ? "You checked " + todays.map(c => esc(X.veh(c.vehicleId).fleet)).join(", ") + " today at " + fmtT(todays[0].at) + "." : "Check your vehicle before its first use today. About 8 minutes."}</p>
        <span class="btn go block lg">${dv ? "Continue check" : "Start check"} ${I("chev", 18, 2.5)}</span></a>`;
    }
    return `${now}
      <div class="sec"><h3>Quick actions</h3></div>
      <div class="qgrid">
        ${tile("#/check/new", "clip", "green", "Walk-around", todays.length ? "Done today" : "Not done today")}
        ${tile("#/defect", "alert", "red", "Report defect", "Tell the workshop")}
        ${tile("#/jobs", "wrench", "amber", "Job sheets", open.length + " active", open.length || "")}
        ${tile("#/job/new", "plus", "blue", "New job card", "Service, repair…")}
        ${tile("#/history", "list", "teal", "Checks", todayDefs ? todayDefs + " defects today" : "No defects today")}
        ${tile("#/fleet", "bus", "slate", "Fleet status", vor.length ? vor.length + " off road" : "All available", vor.length || "")}
        ${tile("#/jobs?tab=mine", "users", "amber", "My jobs", myJobs.length ? myJobs.length + " assigned to you" : "None assigned", myJobs.length || "")}
        ${tile("tel:0578620888", "phone", "teal", "Call depot", "057 862 0888")}
      </div>
      <div class="sec"><h3>Needs attention</h3>${attention.length ? `<a href="#/jobs">All jobs</a>` : ""}</div>
      ${attention.length ? `<div class="card list">${attention.slice(0, 5).map(j => { const v = X.veh(j.vehicleId); return `<a class="li" href="#/job/${j.id}">${vTag(v)}<div class="grow"><div class="t ellipsis">${esc(j.title)}</div><div class="m">#${esc(j.id)} · ${fmtDT(j.created)}</div></div>${j.priority === "VOR" ? pill("red", "Off road") : pill("amber", "Unassigned")}<span class="chev">${I("chev", 16)}</span></a>`; }).join("")}</div>`
        : `<div class="card pad row" style="gap:12px"><span style="color:var(--green-ink)">${I("check", 22, 2.6)}</span><div class="small">Nothing urgent — no vehicles off road and every job is assigned.</div></div>`}
      ${myDefs.length ? `<div class="sec"><h3>Defects you reported</h3></div><div class="card list">${myDefs.map(j => { const v = X.veh(j.vehicleId); return `<a class="li" href="#/job/${j.id}">${vTag(v)}<div class="grow"><div class="t ellipsis">${esc(j.title)}</div><div class="m">${fmtDT(j.created)}</div></div>${statusPill(j.status)}</a>`; }).join("")}</div>` : ""}
      <div class="sec"><h3>Latest checks</h3><a href="#/history">See all</a></div>
      <div class="card list">${recent.length ? recent.slice(0, 4).map(checkRow).join("") : `<div class="empty">No checks yet.</div>`}</div>`;
  }

  /* ---------- fleet status ---------- */
  function fleet() {
    const q = ui.q.toLowerCase();
    const list = S.vehicles.filter(v => !q || (v.fleet + " " + v.reg + " " + v.model + " " + v.type).toLowerCase().includes(q))
      .sort((a, b) => (X.vorJob(b) ? 1 : 0) - (X.vorJob(a) ? 1 : 0) || a.fleet.localeCompare(b.fleet));
    return screen("Fleet status", `<div class="search">${I("search", 18)}<input id="vsearch" placeholder="Fleet no. or reg" value="${esc(ui.q)}" oninput="A.search(this.value)" autocomplete="off"></div>
      <div class="card list" style="margin-top:12px">${list.map(v => { const vor = X.vorJob(v), c = X.checkedToday(v); return `<div class="li" onclick="A.sheet('veh:${v.id}')">${vTag(v)}<div class="grow"><div class="t">${esc(v.reg)}</div><div class="m ellipsis">${esc(v.model)} · ${v.seats} seats</div></div>${vor ? pill("red", "Off road") : c ? pill("green", I("check", 12, 3) + " " + fmtT(c.at)) : pill("", "Not checked")}<span class="chev">${I("chev", 16)}</span></div>`; }).join("") || `<div class="empty">No vehicles match.</div>`}</div>`);
  }

  function checkRow(c) {
    const v = X.veh(c.vehicleId) || { fleet: "?", reg: "" }, o = M.outcome(c);
    return `<a class="li" href="#/check/${c.id}">${vTag(v)}<div class="grow"><div class="t">${esc(v.reg)}</div><div class="m">${fmtDT(c.at)} · ${esc(X.pname(c.driverId))}</div></div>${pill(o.cls, o.label)}<span class="chev">${I("chev", 16)}</span></a>`;
  }

  /* ---------- walk-around check ---------- */
  function startDraft(vid) {
    const v = X.veh(vid);
    draft = { vehicleId: vid, started: Date.now(), odo: "", remarks: "", results: {}, photos: [], step: 0, sig: null };
    // Trailer-only items start as N/A on rigid vehicles; the driver can still change them.
    if (!v.trailer) M.sectionsFor(v).forEach(s => s.items.forEach(it => { if (it.trailer) draft.results[it.key] = { s: "na", auto: 1 }; }));
    lsSet(LS.draft, draft);
  }
  const itemDone = r => r && (r.s !== "def" || (r.note && r.note.trim() && r.sev));

  function pickVehicle() {
    const q = ui.q.toLowerCase();
    const list = S.vehicles.filter(v => !q || (v.fleet + " " + v.reg + " " + v.model + " " + v.type).toLowerCase().includes(q));
    return screen("Select vehicle", `<div class="search">${I("search", 18)}<input id="vsearch" placeholder="Fleet no. or reg" value="${esc(ui.q)}" oninput="A.search(this.value)" autocomplete="off"></div>
      <div class="card list" style="margin-top:12px">${list.map(v => {
        const vor = X.vorJob(v), c = X.checkedToday(v);
        return `<a class="li" href="#/check/new?v=${v.id}">${vTag(v)}<div class="grow"><div class="t">${esc(v.reg)}</div><div class="m ellipsis">${esc(v.model)} · ${esc(v.type)}</div></div>${vor ? pill("red", "Off road") : c ? pill("green", I("check", 12, 3) + " " + fmtT(c.at)) : ""}<span class="chev">${I("chev", 16)}</span></a>`;
      }).join("") || `<div class="empty">No vehicles match.</div>`}</div>`);
  }

  function checkFlow(q) {
    if (q.v && (!draft || draft.vehicleId !== q.v)) startDraft(q.v);
    if (!draft) return pickVehicle();
    const v = X.veh(draft.vehicleId), secs = M.sectionsFor(v);
    const steps = ["Vehicle", ...secs.map(s => s.name), "Finish"];
    const st = draft.step, total = secs.reduce((a, s) => a + s.items.length, 0);
    const done = secs.reduce((a, s) => a + s.items.filter(it => itemDone(draft.results[it.key])).length, 0);
    const odoOk = draft.odo && Number(draft.odo) >= v.odo;
    let body = "", next = "";
    if (st === 0) {
      const vor = X.vorJob(v), known = X.openJobs(v).filter(j => j !== vor);
      body = `<div class="card pad"><div class="vcard">${vTag(v, 1)}<div class="grow"><div style="font-weight:800;font-size:18px">${esc(v.model)}</div><div class="muted small"><span class="reg">${esc(v.reg)}</span> · ${esc(v.type)} · ${v.seats} seats</div></div></div>
          <div class="kv" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line2)"><div><span>Driver</span><b>${esc(me.name)}</b></div><div><span>Date · time</span><b>${fmtD(today())} · ${fmtT(draft.started)}</b></div></div></div>
        ${vor ? `<div class="notice red" style="margin-top:12px">${I("alert")}<div><b>Off the road — do not drive.</b><br>${esc(vor.title)}. Speak to the transport office.</div></div>` : ""}
        ${known.length ? `<div class="notice amber" style="margin-top:12px">${I("wrench")}<div><b>Already with the workshop</b> — no need to report again:<br>${known.map(j => "• " + esc(j.title)).join("<br>")}</div></div>` : ""}
        <div class="card pad stack" style="margin-top:12px">
          <div><label class="f" for="odo">Odometer reading *</label><input class="in" id="odo" inputmode="numeric" placeholder="e.g. ${(v.odo + 140).toLocaleString("en-IE")}" value="${draft.odo}" oninput="A.odo(this.value)"><div class="xs muted" style="margin-top:6px">Last recorded ${km(v.odo)}</div><div class="xs" id="odoerr" style="color:var(--red);margin-top:3px"></div></div>
          <div><label class="f">General remarks</label><textarea class="in" placeholder="Anything worth noting (optional)" oninput="A.remarks(this.value)" style="min-height:70px">${esc(draft.remarks)}</textarea></div></div>`;
      next = `<button class="btn lg pri grow" id="nextbtn" ${odoOk ? "" : "disabled"} onclick="A.step(1)">Start checklist ${I("chev", 18, 2.5)}</button>`;
    } else if (st <= secs.length) {
      const s = secs[st - 1], sd = s.items.every(it => itemDone(draft.results[it.key]));
      body = `<div class="secthead"><div class="grow"><div class="n">SECTION ${st} OF ${secs.length}</div><h2 style="font-size:20px">${esc(s.name)}</h2></div><button class="allok" onclick="A.allOk(${st - 1})">${I("checks", 16, 2.4)} All OK</button></div>
        <div class="card">${s.items.map(itemRow).join("")}</div>`;
      next = `<button class="btn lg pri grow" id="nextbtn" ${sd ? "" : "disabled"} onclick="A.step(${st + 1})">${st === secs.length ? "Review & sign" : "Next: " + esc(steps[st + 1])} ${I("chev", 18, 2.5)}</button>`;
    } else {
      const defs = Object.entries(draft.results).filter(([, r]) => r.s === "def"), major = defs.some(([, r]) => r.sev === "major");
      const ok = Object.values(draft.results).filter(r => r.s === "ok").length, na = Object.values(draft.results).filter(r => r.s === "na").length;
      body = `${done < total ? `<div class="notice amber" style="margin-bottom:12px">${I("alert")}<div>${total - done} item${total - done > 1 ? "s" : ""} still to check.</div></div>` : ""}
        ${defs.length ? `<div class="card"><div class="li" style="cursor:default"><h2 class="grow">${defs.length} defect${defs.length > 1 ? "s" : ""} found</h2>${pill(major ? "red" : "amber", major ? "Off road" : "Safe to drive")}</div>
            <div class="list" style="border-top:1px solid var(--line2)">${defs.map(([k, r]) => `<div class="li" style="align-items:flex-start;cursor:default">${pill(r.sev === "major" ? "red" : "amber", r.sev === "major" ? "Major" : "Minor")}<div class="grow"><div class="t" style="font-size:14px">${esc(M.itemLabel(k))}</div><div class="m">${esc(r.note)}</div></div></div>`).join("")}</div></div>
          <div class="notice ${major ? "red" : "blue"}" style="margin-top:12px">${I(major ? "alert" : "wrench")}<div>${major ? "<b>Do not drive this vehicle.</b> It will be taken off the road and the workshop alerted." : "A job card goes to the workshop for each defect."}</div></div>`
        : `<div class="card pad row" style="gap:14px"><div style="width:48px;height:48px;border-radius:50%;background:var(--green-bg);color:var(--green-ink);display:grid;place-items:center;flex:none">${I("check", 26, 3)}</div><div><h2>Nil defects</h2><div class="muted small">${ok} OK${na ? " · " + na + " N/A" : ""} — vehicle fit to drive</div></div></div>`}
        <div class="sec"><h3>Images (${draft.photos.length}/6)</h3></div>
        <div class="card pad">${draft.photos.length ? `<div class="photos" style="margin:0 0 10px">${draft.photos.map((p, i) => `<div class="ph-i"><img src="/api/files/${p}" onclick="M.lightbox(this.src)" alt=""><button class="rm" onclick="A.rmPhoto(${i})">${I("x", 12, 3)}</button></div>`).join("")}</div>` : ""}
          ${draft.photos.length < 6 ? `<div class="pickrow"><label class="pickbtn">${I("camera", 18)} Camera<input type="file" accept="image/*" capture="environment" onchange="A.chkPhoto(this)"></label><label class="pickbtn">${I("image", 18)} Library<input type="file" accept="image/*" onchange="A.chkPhoto(this)"></label></div>` : `<div class="muted small">Maximum of 6 images.</div>`}</div>
        <div class="sec"><h3>Signature</h3></div>
        <div class="card pad stack"><div class="small muted">I confirm I have carried out this walk-around check on <b style="color:var(--ink)">${esc(v.reg)}</b> and the results are accurate.</div>
          <div class="sigwrap"><canvas data-sig="draft"></canvas><div class="ph">Sign with your finger</div><button class="btn sm soft clr" onclick="A.clearSig('draft')">Clear</button></div>
          <div class="row xs muted">${I("pen", 14)} ${esc(me.name)} · ${fmtDT(Date.now())}</div></div>`;
      next = `<button class="btn lg go grow" id="submitbtn" data-ready="${done === total ? 1 : ""}" ${done === total && draft.sig ? "" : "disabled"} onclick="A.submit()">${I("check", 20, 2.6)} Submit check</button>`;
    }
    const prog = `<div class="prog"><div class="track"><i style="width:${Math.round(done / total * 100)}%"></i></div><b>${done}/${total}</b></div>`;
    return `<div class="bar"><button class="round" onclick="${st ? `A.step(${st - 1})` : "A.cancel()"}" aria-label="Back">${I(st ? "left" : "x", 20, 2.4)}</button><div class="ttl">${esc(v.fleet)} · ${esc(v.reg)}</div><span class="side"></span></div>
      <div class="body" style="padding-bottom:20px">${prog}${body}</div><div class="dock">${next}</div>`;
  }

  function itemRow(it) {
    const r = draft.results[it.key] || {};
    return `<div class="item ${r.s ? "done" : ""}" id="it-${it.key}"><div class="q"><div class="grow"><div class="lbl">${esc(it.label)}</div>${it.trailer ? `<div class="tag">Trailers only</div>` : ""}</div>
      <div class="tri"><button class="ok ${r.s === "ok" ? "on" : ""}" aria-label="OK" onclick="A.mark('${it.key}','ok')">${I("check", 20, 3)}</button><button class="def ${r.s === "def" ? "on" : ""}" aria-label="Defect" onclick="A.mark('${it.key}','def')">${I("x", 20, 3)}</button>${it.na ? `<button class="na ${r.s === "na" ? "on" : ""}" onclick="A.mark('${it.key}','na')">N/A</button>` : ""}</div></div>
      ${r.s === "def" ? `<div class="defbox"><textarea class="in" placeholder="What's wrong? Where is it?" oninput="A.note('${it.key}',this.value)">${esc(r.note || "")}</textarea>
        <div class="sev"><button class="minor ${r.sev === "minor" ? "on" : ""}" onclick="A.sev('${it.key}','minor')"><b>Minor</b>Safe to drive</button><button class="major ${r.sev === "major" ? "on" : ""}" onclick="A.sev('${it.key}','major')"><b>Major</b>Do not drive</button></div>
        <div class="photos">${(r.photos || []).map(p => `<div class="ph-i"><img src="/api/files/${p}" onclick="M.lightbox(this.src)" alt=""></div>`).join("")}<label class="addph">${I("camera", 22)}<input type="file" accept="image/*" capture="environment" onchange="A.itemPhoto('${it.key}',this)"></label></div></div>` : ""}</div>`;
  }

  function checkView(id, q) {
    const c = S.checks.find(x => x.id === id);
    if (!c) return screen("Check", `<div class="empty">Check not found.</div>`, { back: "#/history" });
    const v = X.veh(c.vehicleId), o = M.outcome(c), defs = M.defectsOf(c), secs = M.sectionsFor(v);
    const res = it => M.resultOf(c, it, v);
    const top = q.done ? `<div class="result ${o.res}"><div class="ic">${I(o.res === "ok" ? "check" : "alert", 36, 2.6)}</div><div class="big">${o.res === "ok" ? "Fit to drive" : o.res === "bad" ? "Do not drive" : "Defects reported"}</div><p>${o.res === "ok" ? "Nil defects. Have a safe trip, " + esc(me.name.split(" ")[0]) + "." : o.res === "bad" ? esc(v.fleet) + " is off the road. The workshop has been alerted — contact the office for another vehicle." : "The workshop has a job card for each defect. You can use the vehicle."}</p></div>
      <a class="btn block lg pri" style="margin:12px 0 4px" href="#/">Done</a>` : "";
    return screen(q.done ? "Check submitted" : "Walk-around check", `${top}
      <div class="card pad" style="margin-top:${q.done ? 12 : 0}px"><div class="vcard">${vTag(v, 1)}<div class="grow"><div style="font-weight:800;font-size:17px">${esc(v.reg)}</div><div class="muted small">${fmtDT(c.at)}</div></div>${pill(o.cls, o.label)}</div>
        <div class="kv" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line2)"><div><span>Driver</span><b>${esc(X.pname(c.driverId))}</b></div><div><span>Odometer</span><b>${km(c.odo)}</b></div><div><span>Reference</span><b>${esc(c.id)}</b></div><div><span>Time taken</span><b>${c.duration || "—"} min</b></div></div>
        ${c.remarks ? `<div class="notice blue" style="margin-top:12px">${I("note")}<div>${esc(c.remarks)}</div></div>` : ""}</div>
      ${defs.length ? `<div class="sec"><h3>Defects</h3></div><div class="card list">${defs.map(([k, r]) => { const j = r.job && S.jobs.find(x => x.id === r.job); return `<div class="li" style="align-items:flex-start;cursor:default">${pill(r.sev === "major" ? "red" : "amber", r.sev === "major" ? "Major" : "Minor")}<div class="grow"><div class="t" style="font-size:14px">${esc(M.itemLabel(k))}</div><div class="m">${esc(r.note)}</div>${(r.photos || []).length ? `<div class="photos">${r.photos.map(p => `<div class="ph-i"><img src="/api/files/${p}" onclick="M.lightbox(this.src)" alt=""></div>`).join("")}</div>` : ""}${j ? `<div class="row xs" style="margin-top:6px;gap:6px">Job #${esc(j.id)} ${statusPill(j.status)}</div>` : ""}</div></div>`; }).join("")}</div>` : ""}
      ${(c.photos || []).length ? `<div class="sec"><h3>Images</h3></div><div class="card pad"><div class="photos" style="margin:0">${c.photos.map(p => `<div class="ph-i"><img src="/api/files/${p}" onclick="M.lightbox(this.src)" alt=""></div>`).join("")}</div></div>` : ""}
      <div class="sec"><h3>Checklist</h3></div>
      <div class="card pad">${secs.map(s => `<div class="xs" style="font-weight:800;color:var(--muted);margin:10px 0 2px;text-transform:uppercase;letter-spacing:.05em">${esc(s.name)}</div>` + s.items.map(it => { const r = res(it); return `<div class="tick">${r.s === "def" ? `<span style="color:var(--red)">${I("x", 17, 3)}</span>` : r.s === "na" ? `<span class="xs muted" style="width:17px;font-weight:800">N/A</span>` : `<span style="color:var(--green-ink)">${I("check", 17, 3)}</span>`}<span>${esc(it.label)}</span></div>`; }).join("")).join("")}</div>
      <div class="sec"><h3>Signature</h3></div><div class="card pad">${c.sig ? `<img class="sigimg" src="${c.sig}" alt="Signature">` : `<div style="font-family:'Brush Script MT',cursive;font-size:30px;color:#2c3e66">${esc(X.pname(c.driverId))}</div>`}<div class="xs muted">${esc(X.pname(c.driverId))} · ${fmtDT(c.at)}</div></div>`, { back: q.done ? "#/" : "#/history" });
  }

  function history() {
    const all = S.checks.filter(c => isoOf(c.at) >= M.addDaysIso(today(), -6));
    const tabs3 = [["all", "All", all], ["mine", "Mine", all.filter(c => c.driverId === me.id)], ["def", "With defects", all.filter(c => M.defectsOf(c).length)]];
    const list = (tabs3.find(t => t[0] === ui.hTab) || tabs3[0])[2].slice().sort((a, b) => b.at - a.at);
    const byDay = {};
    list.forEach(c => { (byDay[isoOf(c.at)] = byDay[isoOf(c.at)] || []).push(c); });
    return screen("Checks", `<div class="chips" style="margin-bottom:4px">${tabs3.map(([k, l, ls]) => `<button class="chip ${ui.hTab === k ? "on" : ""}" onclick="A.htab('${k}')">${l}<span class="c">${ls.length}</span></button>`).join("")}</div>
      ${Object.keys(byDay).map(d => `<div class="sec"><h3>${fmtDay(d)}</h3></div><div class="card list">${byDay[d].map(checkRow).join("")}</div>`).join("") || `<div class="empty">No checks in the last 7 days.</div>`}`, { back: false, right: meBtn() });
  }

  /* ---------- report a defect ---------- */
  function reportDefect(q) {
    if (!defDraft) defDraft = { vehicleId: q.v || (draft && draft.vehicleId) || "", item: "", note: "", sev: "minor", photos: [] };
    const d = defDraft;
    return screen("Report a defect", `<div class="notice blue" style="margin-bottom:12px">${I("wrench")}<div>Goes straight to the workshop as a job card.</div></div>
      <div class="card pad stack">
        <div><label class="f">Vehicle *</label><select class="in" onchange="A.dd('vehicleId',this.value)"><option value="">Choose vehicle…</option>${S.vehicles.map(v => `<option value="${v.id}" ${v.id === d.vehicleId ? "selected" : ""}>${esc(v.fleet)} · ${esc(v.reg)}</option>`).join("")}</select></div>
        <div><label class="f">What's affected? *</label><select class="in" onchange="A.dd('item',this.value)"><option value="">Choose…</option>${M.SECTIONS.map(s => `<optgroup label="${esc(s.name)}">${s.items.map(([k]) => `<option value="${k}" ${d.item === k ? "selected" : ""}>${esc(M.itemShort(k))}</option>`).join("")}</optgroup>`).join("")}<option value="other" ${d.item === "other" ? "selected" : ""}>Something else</option></select></div>
        <div><label class="f">Describe it *</label><textarea class="in" placeholder="What happened, where on the vehicle, when it started" oninput="A.dd('note',this.value,1)">${esc(d.note)}</textarea></div>
        <div><label class="f">Is it safe to drive?</label><div class="sev" style="margin:0"><button class="minor ${d.sev === "minor" ? "on" : ""}" style="background:${d.sev === "minor" ? "" : "#f5f7fa"}" onclick="A.dd('sev','minor')"><b>Yes — minor</b>Needs fixing soon</button><button class="major ${d.sev === "major" ? "on" : ""}" style="background:${d.sev === "major" ? "" : "#f5f7fa"}" onclick="A.dd('sev','major')"><b>No — major</b>Take it off the road</button></div></div>
        <div><label class="f">Photos</label><div class="photos" style="margin:0">${d.photos.map(p => `<div class="ph-i"><img src="/api/files/${p}" onclick="M.lightbox(this.src)" alt=""></div>`).join("")}<label class="addph">${I("camera", 22)}<input type="file" accept="image/*" capture="environment" onchange="A.ddPhoto(this)"></label></div></div>
      </div>`, { dock: `<button class="btn lg danger block" onclick="A.sendDefect()">${I("upload", 18, 2.4)} Send to workshop</button>` });
  }

  /* ---------- job sheets (mechanics) ---------- */
  function jobsList() {
    const q = ui.jq.toLowerCase();
    const prio = { VOR: 0, High: 1, Normal: 2 };
    let list = S.jobs.filter(j => {
      const v = X.veh(j.vehicleId);
      return !q || (j.id + " " + j.title + " " + v.fleet + " " + v.reg + " " + j.type + " " + (j.customer || "")).toLowerCase().includes(q);
    });
    const active = list.filter(j => j.status !== "Complete").sort((a, b) => prio[a.priority] - prio[b.priority] || b.created - a.created);
    const mine = active.filter(j => j.mechId === me.id);
    const todayJobs = list.filter(j => j.plan && j.plan.date === today() && (me.role !== "mechanic" || j.mechId === me.id));
    const done = list.filter(j => j.status === "Complete").sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));
    const show = ui.jobsTab === "mine" ? mine : ui.jobsTab === "done" ? done : ui.jobsTab === "today" ? todayJobs : active;
    return `<div class="bar"><a class="round" href="#/" aria-label="Home">${I("left", 20, 2.4)}</a><div class="ttl">Job sheets</div>${meBtn()}</div>
      <div class="body">
        <div class="search">${I("search", 18)}<input id="jsearch" placeholder="Search job cards…" value="${esc(ui.jq)}" oninput="A.jsearch(this.value)" autocomplete="off"></div>
        <a class="btn go block lg" href="#/job/new" style="margin-top:12px">${I("plus", 20, 2.6)} Create new job card</a>
        <div class="chips" style="margin:16px 0 12px">${[["today", "Today", todayJobs.length], ["active", "Active", active.length], ["mine", "Mine", mine.length], ["done", "Complete", done.length]].map(([k, l, n]) => `<button class="chip ${ui.jobsTab === k ? "on" : ""}" onclick="A.jtab('${k}')">${l}<span class="c">${n}</span></button>`).join("")}</div>
        ${show.map(jobCard).join("") || `<div class="empty">No job cards here.</div>`}
      </div>${tabs()}`;
  }
  function jobCard(j) {
    const v = X.veh(j.vehicleId), running = (j.labour || []).some(l => !l.end);
    return `<a class="jc" href="#/job/${j.id}"><div class="row"><span class="no">#${esc(j.id)}</span>${statusPill(j.status)}<span class="grow"></span><span class="type">${esc(j.type)}</span></div>
      <div class="ttl">${j.priority === "VOR" && j.status !== "Complete" ? `<span style="color:var(--red)">● VOR</span> ` : ""}${esc(j.title)}</div>
      <div class="meta"><div><span>Reg no.</span><b>${esc(v.reg)}</b> <span class="muted xs" style="display:inline;font-weight:700;text-transform:none;letter-spacing:0">${esc(v.fleet)}</span></div><div><span>Customer</span><b>${esc(j.customer || "—")}</b>${M.isExternal(j) ? ` <span class="pill blue" style="font-size:10px;padding:1px 6px">Outside</span>` : ""}</div></div>
      ${j.plan && j.status !== "Complete" ? `<div class="xs" style="margin:-2px 0 8px;font-weight:700;color:${j.plan.date === today() ? "var(--green-ink)" : "var(--muted)"}">${I("calendar", 13)} Planned ${esc(fmtDay(j.plan.date).toLowerCase())} · ${j.plan.hours}h</div>` : ""}
      <div class="totals"><div><span class="muted">Total hours</span><span class="v">${running ? `<span style="color:var(--green-ink)">● </span>` : ""}${hrs(M.jobMins(j))}</span></div><div><span class="muted">Rate (hourly)</span><span class="v">${eur(j.rate)}</span></div><div><span class="muted">Parts</span><span class="v">${j.noParts ? "None" : eur(M.jobParts(j))}</span></div><div class="g"><span>Grand total</span><span class="v">${eur(M.jobTotal(j))}</span></div></div>
      ${j.workDone ? `<div class="worknote"><span>Work performed</span>${esc(j.workDone.length > 110 ? j.workDone.slice(0, 107) + "…" : j.workDone)}</div>` : ""}
      <div class="foot"><span>${fmtD(isoOf(j.created))}</span>${j.mechId ? `<span>· ${esc(X.pname(j.mechId))}</span>` : `<span style="color:var(--amber)">· Unassigned</span>`}${j.docket ? `<span class="row" style="gap:4px;color:var(--green-ink)">${I("file", 14)} Docket</span>` : ""}<span class="grow"></span><span class="row" style="gap:4px;font-weight:800;color:var(--green-ink)">View job ${I("chev", 14, 2.6)}</span></div></a>`;
  }

  const TABS = [["details", "file", "Details"], ["work", "wrench", "Work done"], ["parts", "box", "Parts"], ["done", "check", "Complete"]];
  function tabDone(j, k) {
    if (k === "details") return !!(j.vehicleId && j.type);
    if (k === "work") return !!(j.workDone && j.workDone.trim()) && M.jobMins(j) > 0;
    if (k === "parts") return j.noParts || (j.parts || []).length > 0;
    return j.status === "Complete";
  }

  function detailsForm(d, isNew) {
    const typeDesc = { "Defect repair": "Fix a reported defect", Service: "Scheduled service", "CVRT prep": "Pre-test inspection", Labour: "General labour", Warranty: "Covered by warranty", Installation: "Fit new equipment" };
    const f = isNew ? "A.nj" : `A.jf.bind(null,'${d.id}')`;
    const locked = !isNew && d.status === "Complete";
    return `<div class="card pad stack">
        <div class="row" style="gap:8px">${I("bus", 20)}<h2>Vehicle details</h2></div>
        <div><label class="f">Reg no. *</label><select class="in" ${locked ? "disabled" : ""} onchange="${f}('vehicleId',this.value)"><option value="">Select vehicle…</option>${(M.isExternal(d) ? (X.custOf(d).vehicles || []).map(v => Object.assign({ fleet: "" }, v)) : S.vehicles).map(v => `<option value="${v.id}" ${v.id === d.vehicleId ? "selected" : ""}>${esc(v.reg)} · ${esc(v.fleet)} ${esc(v.model)}</option>`).join("")}</select></div>
        <div><label class="f">Service due</label><input class="in" ${locked ? "disabled" : ""} placeholder="e.g. 450,000 km or date" value="${esc(d.serviceDue || (d.vehicleId ? fmtD(X.veh(d.vehicleId).serviceDue) : ""))}" onchange="${f}('serviceDue',this.value)"></div>
        <div><label class="f">Job title *</label><input class="in" ${locked ? "disabled" : ""} placeholder="e.g. B service, replace marker lamp" value="${esc(d.title || "")}" ${isNew ? `oninput="A.nj('title',this.value,1)"` : `onchange="${f}('title',this.value)"`}></div>
      </div>
      <div class="card pad stack" style="margin-top:12px"><h2>Customer information</h2>
        ${!isNew && M.isExternal(d) ? `<div><label class="f">Customer</label><div class="in" style="font-weight:700">${esc(X.custOf(d).name)}</div>${X.custOf(d).notes ? `<div class="xs muted" style="margin-top:6px">${esc(X.custOf(d).notes)}</div>` : ""}</div></div>` : `<div><label class="f">Customer name</label><input class="in" ${locked ? "disabled" : ""} placeholder="Martley's fleet" value="${esc(d.customer || "")}" ${isNew ? `oninput="A.nj('customer',this.value,1)"` : `onchange="${f}('customer',this.value)"`}></div></div>`}
      <div class="card pad" style="margin-top:12px"><div class="row" style="gap:8px;margin-bottom:12px"><h2 class="grow">Job type *</h2></div>
        ${M.JOB_TYPES.map(t => `<div class="radio ${d.type === t ? "on" : ""}" onclick="${locked ? "" : `${f}('type','${t}')`}"><span class="o"></span><div><div>${t}</div><div class="d">${typeDesc[t]}</div></div></div>`).join("")}</div>
      <div class="card pad" style="margin-top:12px"><label class="f">Priority</label><div class="chips">${M.PRIORITIES.map(p => `<button class="chip ${d.priority === p ? "on" : ""}" ${locked ? "disabled" : ""} onclick="${f}('priority','${p}')">${p === "VOR" ? "VOR · off road" : p}</button>`).join("")}</div></div>`;
  }

  function jobNew() {
    if (!jobDraft) jobDraft = { vehicleId: "", type: "", title: "", customer: "", serviceDue: "", priority: "Normal" };
    return `<div class="bar"><a class="round" href="#/jobs">${I("x", 20, 2.4)}</a><div class="ttl">New job card</div><span class="side"></span></div>
      <div class="body" style="padding-bottom:20px"><div class="seg4">${TABS.map(([k, ic, l], i) => `<button class="${i === 0 ? "on" : ""}" ${i ? "disabled" : ""}>${I(ic, 18)}${l}</button>`).join("")}</div>${detailsForm(jobDraft, true)}</div>
      <div class="dock"><button class="btn lg pri block" onclick="A.createJob()">Next ${I("chev", 18, 2.5)}</button></div>`;
  }

  function jobSheet(id, tab) {
    const j = S.jobs.find(x => x.id === id);
    if (!j) return screen("Job sheet", `<div class="empty">Job card not found.</div>`);
    const v = X.veh(j.vehicleId), locked = j.status === "Complete";
    const chk = j.checkId && S.checks.find(c => c.id === j.checkId), def = chk && chk.results[j.item];
    const running = (j.labour || []).find(l => !l.end && l.mechId === me.id);
    let body = "", dock = "";
    const nextTab = TABS[TABS.findIndex(t => t[0] === tab) + 1];
    if (nextTab && !locked) dock = `<button class="btn lg pri block" onclick="A.tab('${j.id}','${nextTab[0]}')">Next: ${nextTab[2]} ${I("chev", 18, 2.5)}</button>`;

    if (tab === "details") {
      body = `${chk || j.desc ? `<div class="card pad" style="margin-bottom:12px"><div class="row" style="gap:8px;margin-bottom:8px">${I(j.item ? "alert" : "note", 18)}<h2 class="grow">${j.item ? "Reported defect" : "Job description"}</h2>${(def && def.sev) || j.sev ? pill(((def && def.sev) || j.sev) === "major" ? "red" : "amber", ((def && def.sev) || j.sev) === "major" ? "Major" : "Minor") : ""}</div>
          ${j.item ? `<div class="xs muted" style="margin-bottom:6px">${esc(M.itemLabel(j.item))} · ${esc(X.pname(chk ? chk.driverId : j.reportedBy))}, ${fmtDT(chk ? chk.at : j.created)}${chk ? "" : " · reported during the day"}</div>` : ""}<div class="small">${esc(j.desc || "—")}</div>
          ${((def && def.photos) || []).concat(j.reportPhotos || []).length ? `<div class="photos">${((def && def.photos) || []).concat(j.reportPhotos || []).map(p => `<div class="ph-i"><img src="/api/files/${p}" onclick="M.lightbox(this.src)" alt=""></div>`).join("")}</div>` : ""}</div>` : ""}
        ${detailsForm(j, false)}
        <div class="card pad" style="margin-top:12px"><label class="f">Status</label><div class="chips">${M.STATUSES.filter(s => s !== "Complete").map(s => `<button class="chip ${j.status === s ? "on" : ""}" ${locked ? "disabled" : ""} onclick="A.jf('${j.id}','status','${s}')">${s}</button>`).join("")}</div>
          <label class="f" style="margin-top:14px">Assigned mechanic</label><select class="in" ${locked ? "disabled" : ""} onchange="A.jf('${j.id}','mechId',this.value||null)"><option value="">Unassigned</option>${S.staff.filter(s => s.role === "mechanic").map(m => `<option value="${m.id}" ${m.id === j.mechId ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></div>`;
    } else if (tab === "work") {
      const total = M.jobMins(j);
      body = `<div class="card pad"><h2 style="margin-bottom:10px">Work performed</h2><textarea class="in" ${locked ? "disabled" : ""} placeholder="Describe the work carried out in detail…" onchange="A.jf('${j.id}','workDone',this.value)" style="min-height:120px">${esc(j.workDone || "")}</textarea></div>
        <div class="sec"><h3>Time tracking</h3></div>
        <div class="clockcard"><div class="l">${running ? "On the clock" : "Total time on this job"}</div><div class="big">${running ? `<span data-since="${running.start}" data-base="${total - (Date.now() - running.start) / 60000}">${clockText(total * 60)}</span>` : clockText(total * 60)}</div>
          ${locked ? "" : running ? `<button class="btn danger block lg" onclick="A.clock('${j.id}')">${I("stop", 18)} Stop clock</button>` : `<button class="btn go block lg" onclick="A.clock('${j.id}')">${I("play", 18)} Start clock</button>`}</div>
        ${!locked ? `<div class="card pad" style="margin-top:12px"><label class="f">Or add time manually</label><div class="timein"><div><div class="xs muted" style="margin-bottom:4px">Start time</div><input type="time" class="in" id="t-start"></div><div><div class="xs muted" style="margin-bottom:4px">End time</div><input type="time" class="in" id="t-end"></div><button class="btn pri" onclick="A.addTime('${j.id}')">${I("plus", 18, 2.5)}</button></div></div>` : ""}
        ${(j.labour || []).length ? `<div class="card list" style="margin-top:12px">${j.labour.map((l, i) => `<div class="li" style="cursor:default"><span class="${avClass(X.person(l.mechId))}" style="width:32px;height:32px;font-size:11px">${initials(X.pname(l.mechId))}</span><div class="grow"><div class="t" style="font-size:14px">${fmtT(l.start)} – ${l.end ? fmtT(l.end) : "now"}</div><div class="m">${esc(X.pname(l.mechId))} · ${fmtDay(isoOf(l.start))}</div></div><b class="small">${l.end ? mins((l.end - l.start) / 60000) : `<span style="color:var(--green-ink)">running</span>`}</b>${!locked && l.end ? `<button class="round" style="width:32px;height:32px;box-shadow:none;background:var(--line2)" onclick="A.rmTime('${j.id}',${i})" aria-label="Remove">${I("x", 14, 2.6)}</button>` : ""}</div>`).join("")}<div class="li" style="cursor:default"><b class="grow">Total hours</b><b>${hrs(total)}</b></div></div>` : ""}
        <div class="sec"><h3>Job photos</h3></div>
        <div class="card pad"><div class="photos" style="margin:0">${(j.photos || []).map(p => `<div class="ph-i"><img src="/api/files/${p}" onclick="M.lightbox(this.src)" alt=""></div>`).join("")}${locked ? "" : `<label class="addph">${I("camera", 22)}<input type="file" accept="image/*" onchange="A.jobPhoto('${j.id}',this)"></label>`}</div>${locked || (j.photos || []).length ? "" : `<div class="xs muted" style="margin-top:8px">Before / after photos of the repair.</div>`}</div>`;
    } else if (tab === "parts") {
      body = `<div class="card"><div class="li" style="cursor:default"><h2 class="grow">Parts used</h2>${locked ? "" : `<button class="btn sm pri" onclick="A.sheet('part')">${I("plus", 16, 2.6)} Add part</button>`}</div>
          ${(j.parts || []).length ? `<div style="border-top:1px solid var(--line2)">${j.parts.map((p, i) => `<div class="partrow"><span class="q">${esc(p.qty)}×</span><div class="grow"><div style="font-weight:700;font-size:14px">${esc(p.desc)}</div><div class="xs muted">${esc(p.partNo || "No part no.")} · ${eur(p.cost)} each</div></div><b class="small">${eur(p.qty * p.cost)}</b>${locked ? "" : `<button class="round" style="width:30px;height:30px;box-shadow:none;background:var(--line2)" onclick="A.rmPart('${j.id}',${i})">${I("x", 13, 2.6)}</button>`}</div>`).join("")}<div class="partrow"><b class="grow">Parts total</b><b>${eur(M.jobParts(j))}</b></div></div>`
          : `<div class="empty" style="border-top:1px solid var(--line2)"><div style="color:var(--faint)">${I("cog", 40, 1.5)}</div><div style="font-weight:700;margin-top:6px">${j.noParts ? "No parts needed for this job" : "No parts added yet"}</div></div>`}</div>
        ${(j.parts || []).length || locked ? "" : `<div class="card pad" style="margin-top:12px"><div class="toggle ${j.noParts ? "on" : ""}" onclick="A.jf('${j.id}','noParts',${!j.noParts})"><span class="sw"></span><div><b>No parts used</b><div class="xs muted">Labour only</div></div></div></div>`}
        <div class="card pad" style="margin-top:12px"><h2 style="margin-bottom:10px">Additional notes</h2><textarea class="in" ${locked ? "disabled" : ""} placeholder="Any notes about parts or materials…" onchange="A.jf('${j.id}','partsNotes',this.value)">${esc(j.partsNotes || "")}</textarea></div>`;
    } else {
      const missing = TABS.slice(0, 3).filter(([k]) => !tabDone(j, k)).map(t => t[2]);
      body = `<div class="card pad"><div class="row">${I("euro", 20)}<h2 class="grow">Summary</h2>${statusPill(j.status)}</div>
          <div class="totals"><div><span class="muted">Total hours</span><span class="v">${hrs(M.jobMins(j))}</span></div><div><span class="muted">Rate (hourly)</span><span class="v">${locked ? eur(j.rate) : `<input type="number" step="0.5" class="in" style="width:96px;padding:4px 8px;text-align:right;font-size:14px" value="${j.rate}" onchange="A.jf('${j.id}','rate',Number(this.value)||0)">`}</span></div><div><span class="muted">Labour</span><span class="v">${eur(M.jobLabour(j))}</span></div><div><span class="muted">Parts</span><span class="v">${eur(M.jobParts(j))}</span></div><div class="g"><span>Grand total</span><span class="v">${eur(M.jobTotal(j))}</span></div></div></div>
        <div class="card pad" style="margin-top:12px"><div class="row" style="margin-bottom:10px">${I("file", 20)}<h2 class="grow">Docket</h2></div>
          ${j.docket ? `<a class="row" href="/api/files/${j.docket.id}" target="_blank" style="background:#f5f7fa;border-radius:12px;padding:12px">${I("file", 20)}<span class="grow ellipsis" style="font-weight:700">${esc(j.docket.name)}</span>${I("external", 16)}</a>${locked ? "" : `<button class="btn sm soft" style="margin-top:8px" onclick="A.jf('${j.id}','docket',null)">Remove</button>`}`
          : locked ? `<div class="muted small">No docket attached.</div>` : `<div class="pickrow"><label class="pickbtn">${I("camera", 18)} Photo<input type="file" accept="image/*" capture="environment" onchange="A.docket('${j.id}',this)"></label><label class="pickbtn">${I("upload", 18)} PDF / file<input type="file" accept="image/*,application/pdf" onchange="A.docket('${j.id}',this)"></label></div>`}</div>
        ${locked ? `<div class="notice green" style="margin-top:12px">${I("check")}<div><b>Signed off ${fmtDT(j.closedAt)}</b><br>by ${esc(X.pname(j.signedOffBy))}. Vehicle safe and roadworthy.</div></div>
            <div class="card pad" style="margin-top:12px">${j.sig ? `<img class="sigimg" src="${j.sig}" alt="Signature">` : `<div style="font-family:'Brush Script MT',cursive;font-size:30px;color:#2c3e66">${esc(X.pname(j.signedOffBy))}</div>`}</div>`
        : `${missing.length ? `<div class="notice amber" style="margin-top:12px">${I("alert")}<div>Still to do: <b>${missing.join(", ")}</b></div></div>` : ""}
          <div class="card pad stack" style="margin-top:12px"><h2>Sign off</h2>
            <div class="toggle ${j._rw ? "on" : ""}" onclick="A.rw('${j.id}')"><span class="sw"></span><div class="small">The work is complete and <b>${esc(v.external ? v.reg : v.fleet)}</b> is <b>safe and roadworthy</b> to return to service.</div></div>
            <div class="sigwrap"><canvas data-sig="job:${j.id}"></canvas><div class="ph">Mechanic signature</div><button class="btn sm soft clr" onclick="A.clearSig('job:${j.id}')">Clear</button></div></div>`}`;
      dock = locked ? "" : `<button class="btn lg go block" id="closebtn" ${sigs["job:" + j.id] ? "" : "disabled"} onclick="A.complete('${j.id}')">${I("check", 20, 2.6)} Complete job card</button>`;
    }
    return `<div class="bar"><a class="round" href="#/jobs">${I("left", 20, 2.4)}</a><div class="ttl">#${esc(j.id)} · ${esc(v.external ? v.reg : v.fleet)}</div><span class="side"></span></div>
      <div class="body" style="padding-bottom:${dock ? 20 : 40}px">
        ${!locked && j.priority === "VOR" ? `<div class="notice red" style="margin-bottom:12px">${I("alert")}<div><b>${esc(v.external ? v.reg : v.fleet)} is off the road</b> until this job is signed off.</div></div>` : ""}
        <div class="seg4">${TABS.map(([k, ic, l]) => `<button class="${tab === k ? "on" : ""} ${tabDone(j, k) ? "done" : ""}" onclick="A.tab('${j.id}','${k}')">${tabDone(j, k) ? I("check", 18, 3) : I(ic, 18)}${l}</button>`).join("")}</div>
        ${body}</div>${dock ? `<div class="dock">${dock}</div>` : ""}`;
  }

  /* ---------- bottom sheets ---------- */
  function sheet() {
    if (ui.sheet === "me") return `<div class="overlay" onclick="if(event.target===this)A.sheet(null)"><div class="sheet2"><div class="grab"></div>
      <div style="text-align:center"><div class="${avClass(me)} lg" style="margin:0 auto">${initials(me.name)}</div><h2 style="margin-top:10px;font-size:20px">${esc(me.name)}</h2><div class="muted small">${me.phone ? esc(me.phone) : "Martley&#39;s staff"}</div></div>
      <div class="card list" style="margin-top:16px"><div class="li" style="cursor:default">${I("clip", 18)}<span class="grow">Checks this month</span><b>${S.checks.filter(c => c.driverId === me.id).length}</b></div><div class="li" style="cursor:default">${I("phone", 18)}<span class="grow">Depot</span><b>057 862 0888</b></div></div>
      <button class="btn block lg" style="margin-top:12px;color:var(--red)" onclick="A.logout()">${I("out", 18)} Sign out</button></div></div>`;
    if (String(ui.sheet).startsWith("veh:")) {
      const v = X.veh(ui.sheet.slice(4)), vor = X.vorJob(v), oj = X.openJobs(v);
      const last = S.checks.filter(c => c.vehicleId === v.id).sort((a, b) => b.at - a.at)[0];
      return `<div class="overlay" onclick="if(event.target===this)A.sheet(null)"><div class="sheet2"><div class="grab"></div>
        <div class="vcard">${vTag(v, 1)}<div class="grow"><div style="font-weight:800;font-size:18px">${esc(v.reg)}</div><div class="muted small">${esc(v.model)} · ${esc(v.type)} · ${v.seats} seats</div></div></div>
        ${vor ? `<div class="notice red" style="margin-top:14px">${I("alert")}<div><b>Off the road — do not drive.</b><br>${esc(vor.title)}</div></div>` : ""}
        <div class="card pad" style="margin-top:14px"><div class="kv"><div><span>CVRT due</span><b>${fmtD(v.cvrtDue)}</b><div style="margin-top:4px">${duePill(v.cvrtDue)}</div></div><div><span>Service due</span><b>${fmtD(v.serviceDue)}</b><div style="margin-top:4px">${duePill(v.serviceDue)}</div></div>
          <div><span>Odometer</span><b>${km(v.odo)}</b></div><div><span>Last check</span><b>${last ? fmtDT(last.at) : "—"}</b>${last ? `<div class="xs muted">${esc(X.pname(last.driverId))}</div>` : ""}</div></div></div>
        ${oj.length ? `<div class="sec"><h3>With the workshop</h3></div><div class="card list">${oj.map(j => `<a href="#/job/${j.id}" class="li"><div class="grow"><div class="t ellipsis" style="font-size:14px">${esc(j.title)}</div><div class="m">#${esc(j.id)}</div></div>${statusPill(j.status)}</a>`).join("")}</div>` : ""}
        ${vor ? "" : `<a class="btn go block lg" style="margin-top:14px" href="#/check/new?v=${v.id}">${I("clip", 18)} Start walk-around check</a>`}</div></div>`;
    }
    if (ui.sheet === "part") return `<div class="overlay" onclick="if(event.target===this)A.sheet(null)"><div class="sheet2"><div class="grab"></div><h2 style="font-size:20px;margin-bottom:14px">Add part</h2>
      <div class="stack"><div><label class="f">From stock</label><select class="in" id="p-stock" onchange="A.pickStock(this.value)"><option value="">One-off part (type it below)</option>${X.locations().map(l => { const items = X.stock().filter(p => p.loc === l.id); return items.length ? `<optgroup label="${esc(l.name)}">${items.map(p => `<option value="${p.id}">${esc(p.desc)} · ${p.qty} left · ${esc(p.bin || "")}</option>`).join("")}</optgroup>` : ""; }).join("")}</select></div>
        <div><label class="f">Description *</label><input class="in" id="p-desc" placeholder="e.g. Brake pad set, front"></div>
        <div><label class="f">Part number</label><input class="in" id="p-no" placeholder="Optional"></div>
        <div class="row" style="align-items:flex-end"><div style="width:100px"><label class="f">Qty</label><input class="in" id="p-qty" inputmode="decimal" value="1"></div><div class="grow"><label class="f">Cost each (€)</label><input class="in" id="p-cost" inputmode="decimal" placeholder="0.00"></div></div>
        <button class="btn lg pri block" onclick="A.addPart('${route().parts[1]}')">Add part</button></div></div></div>`;
    return "";
  }

  /* ---------- actions ---------- */
  async function upload(input) {
    const f = input.files && input.files[0];
    if (!f) return null;
    toast("Uploading…");
    try { const r = await Store.upload(f); toast("Added"); return r; } catch (e) { toast(e.message); return null; }
  }
  const job = id => S.jobs.find(x => x.id === id);
  function nextBtnState() {
    const v = X.veh(draft.vehicleId), s = M.sectionsFor(v)[draft.step - 1], b = $("#nextbtn");
    if (b && s) b.disabled = !s.items.every(it => itemDone(draft.results[it.key]));
  }
  const persist = () => lsSet(LS.draft, draft);

  window.A = {
    pick(id) { pinFor = id; pin = ""; render(); },
    key(k) {
      const p = X.person(pinFor);
      pin = k === "del" ? pin.slice(0, -1) : (pin + k).slice(0, 4);
      if (pin.length === 4) {
        if (pin === p.pin) { me = p; lsSet(LS.me, p.id); pinFor = null; pin = ""; go("#/"); render(); return; }
        pin = ""; render(); $("#pindots").classList.add("shake"); return;
      }
      render();
    },
    logout() { me = null; ui.sheet = null; lsSet(LS.me, null); go("#/"); render(); },
    sheet(s) { ui.sheet = s; keep(render); if (s === "part") setTimeout(() => { const e = $("#p-desc"); if (e) e.focus(); }, 50); },

    search(v) { ui.q = v; render(); const e = $("#vsearch"); e.focus(); e.setSelectionRange(v.length, v.length); },
    odo(val) {
      draft.odo = val.replace(/\D/g, ""); persist();
      const v = X.veh(draft.vehicleId), ok = draft.odo && Number(draft.odo) >= v.odo;
      $("#odoerr").textContent = draft.odo && !ok ? "Lower than the last reading (" + km(v.odo) + ")" : "";
      $("#nextbtn").disabled = !ok;
    },
    remarks(val) { draft.remarks = val; persist(); },
    step(i) { draft.step = i; persist(); render(); toTop(); },
    cancel() { if (Object.keys(draft.results).length > 3 && !confirm("Discard this check?")) return; draft = null; lsSet(LS.draft, null); go("#/"); },
    mark(k, s) {
      const r = draft.results[k] || {};
      draft.results[k] = s === "def" ? Object.assign({ sev: "minor", photos: [] }, r, { s, auto: 0 }) : { s };
      persist(); keep(render);
      if (s === "def") { const ta = document.querySelector("#it-" + k + " textarea"); if (ta) ta.focus({ preventScroll: true }); }
    },
    allOk(si) {
      const s = M.sectionsFor(X.veh(draft.vehicleId))[si];
      s.items.forEach(it => { const r = draft.results[it.key]; if (!r || (r.s !== "def" && !(r.s === "na"))) draft.results[it.key] = { s: "ok" }; });
      persist(); keep(render); toast("Marked OK — check anything you found faulty");
    },
    note(k, val) { draft.results[k].note = val; persist(); nextBtnState(); },
    sev(k, s) { draft.results[k].sev = s; persist(); keep(render); },
    async itemPhoto(k, input) { const r = await upload(input); if (r) { draft.results[k].photos = (draft.results[k].photos || []).concat(r.id); persist(); keep(render); } },
    async chkPhoto(input) { const r = await upload(input); if (r && draft.photos.length < 6) { draft.photos.push(r.id); persist(); keep(render); } },
    rmPhoto(i) { draft.photos.splice(i, 1); persist(); keep(render); },
    clearSig(k) { if (k === "draft") { draft.sig = null; persist(); } else delete sigs[k]; keep(render); },
    submit() {
      const v = X.veh(draft.vehicleId), at = Date.now();
      const id = "WC-" + today().replace(/-/g, "").slice(2) + "-" + v.fleet + "-" + at.toString(36).slice(-3).toUpperCase();
      const results = JSON.parse(JSON.stringify(draft.results));
      Object.entries(results).forEach(([k, r]) => {
        delete r.auto;
        if (r.s !== "def") return;
        const jid = X.nextJobId();
        r.job = jid;
        S.jobs.push({ id: jid, vehicleId: v.id, type: "Defect repair", customer: "Martley's fleet", status: "Open", priority: r.sev === "major" ? "VOR" : "Normal", mechId: null, title: M.defectTitle(k, r.note), desc: r.note, created: at, labour: [], rate: (S.settings || {}).rate || 55, parts: [], noParts: false, partsNotes: "", workDone: "", photos: [], docket: null, checkId: id, item: k, reportedBy: me.id, sev: r.sev });
      });
      S.checks.push({ id, vehicleId: v.id, driverId: me.id, at, duration: Math.max(1, Math.round((at - draft.started) / 60000)), odo: Number(draft.odo), remarks: draft.remarks.trim(), results, photos: draft.photos, sig: draft.sig });
      v.odo = Number(draft.odo);
      save();
      draft = null; lsSet(LS.draft, null);
      go("#/check/" + id + "?done=1");
    },

    dd(f, val, quiet) { defDraft[f] = val; if (!quiet) keep(render); },
    async ddPhoto(input) { const r = await upload(input); if (r) { defDraft.photos.push(r.id); keep(render); } },
    sendDefect() {
      const d = defDraft;
      if (!d.vehicleId) return toast("Choose the vehicle");
      if (!d.item) return toast("Choose what's affected");
      if (!d.note.trim()) return toast("Describe the defect");
      const id = X.nextJobId();
      S.jobs.push({ id, vehicleId: d.vehicleId, type: "Defect repair", customer: "Martley's fleet", status: "Open", priority: d.sev === "major" ? "VOR" : "Normal", mechId: null, title: M.defectTitle(d.item, d.note), desc: d.note.trim(), created: Date.now(), labour: [], rate: (S.settings || {}).rate || 55, parts: [], noParts: false, partsNotes: "", workDone: "", photos: [], reportPhotos: d.photos, docket: null, item: d.item, reportedBy: me.id, sev: d.sev });
      save(); defDraft = null;
      toast("Sent to the workshop — job #" + id);
      go("#/");
    },

    jsearch(v) { ui.jq = v; render(); const e = $("#jsearch"); e.focus(); e.setSelectionRange(v.length, v.length); },
    jtab(k) { ui.jobsTab = k; render(); },
    htab(k) { ui.hTab = k; render(); },
    nj(f, val, quiet) { jobDraft[f] = val; if (f === "vehicleId") jobDraft.serviceDue = ""; if (!quiet) keep(render); },
    createJob() {
      const d = jobDraft;
      if (!d.vehicleId) return toast("Select the vehicle");
      if (!d.title.trim()) return toast("Give the job a title");
      if (!d.type) return toast("Choose a job type");
      const id = X.nextJobId();
      S.jobs.push({ id, vehicleId: d.vehicleId, type: d.type, customer: d.customer.trim() || "Martley's fleet", serviceDue: d.serviceDue, status: "Open", priority: d.priority, mechId: me.id, title: d.title.trim(), desc: "", created: Date.now(), labour: [], rate: (S.settings || {}).rate || 55, parts: [], noParts: false, partsNotes: "", workDone: "", photos: [], docket: null, reportedBy: me.id });
      save(); jobDraft = null;
      go("#/job/" + id + "?tab=work");
    },
    tab(id, t) { go("#/job/" + id + "?tab=" + t); },
    jf(id, f, val) {
      const j = job(id); j[f] = val;
      if (f === "status" && val === "In progress" && !j.mechId) j.mechId = me.id;
      save(); keep(render);
      if (f === "priority" && val === "VOR") toast(X.veh(j.vehicleId).fleet + " marked off road");
    },
    clock(id) {
      const j = job(id), run = (j.labour || []).find(l => !l.end && l.mechId === me.id);
      if (run) { run.end = Date.now(); toast(mins((run.end - run.start) / 60000) + " logged"); }
      else {
        // one job on the clock at a time
        S.jobs.forEach(o => (o.labour || []).forEach(l => { if (!l.end && l.mechId === me.id) l.end = Date.now(); }));
        j.labour = (j.labour || []).concat({ mechId: me.id, start: Date.now(), end: null });
        if (j.status === "Open") j.status = "In progress";
        if (!j.mechId) j.mechId = me.id;
      }
      save(); keep(render);
    },
    addTime(id) {
      const a = $("#t-start").value, b = $("#t-end").value;
      if (!a || !b) return toast("Enter a start and end time");
      const [ah, am] = a.split(":").map(Number), [bh, bm] = b.split(":").map(Number);
      const d0 = new Date(); d0.setSeconds(0, 0);
      const start = new Date(d0).setHours(ah, am), end = new Date(d0).setHours(bh, bm);
      if (end <= start) return toast("End time must be after start time");
      const j = job(id); j.labour = (j.labour || []).concat({ mechId: me.id, start, end });
      if (j.status === "Open") j.status = "In progress";
      save(); keep(render); toast(mins((end - start) / 60000) + " added");
    },
    rmTime(id, i) { job(id).labour.splice(i, 1); save(); keep(render); },
    async jobPhoto(id, input) { const r = await upload(input); if (r) { const j = job(id); j.photos = (j.photos || []).concat(r.id); save(); keep(render); } },
    pickStock(sid) { const p = X.stockItem(sid); if (!p) return; $("#p-desc").value = p.desc; $("#p-no").value = p.partNo; $("#p-cost").value = p.cost; },
    addPart(id) {
      const desc = $("#p-desc").value.trim(); if (!desc) return toast("Enter a description");
      const j = job(id), qty = Number($("#p-qty").value) || 1, st = X.stockItem($("#p-stock").value);
      const line = { desc, partNo: $("#p-no").value.trim(), qty, cost: Number(String($("#p-cost").value).replace(/[^\d.]/g, "")) || 0 };
      if (st && st.partNo === line.partNo) { line.stockId = st.id; M.takeStock(S, st.id, qty, j.id, me.id); }
      j.parts = (j.parts || []).concat(line);
      j.noParts = false; ui.sheet = null;
      save(); keep(render); toast(line.stockId ? "Part added · " + X.stockItem(line.stockId).qty + " left in stock" : "Part added");
    },
    rmPart(id, i) { const j = job(id); M.returnStock(S, j.parts[i], j.id, me.id); j.parts.splice(i, 1); save(); keep(render); },
    async docket(id, input) { const r = await upload(input); if (r) { job(id).docket = { id: r.id, name: r.name, type: r.type }; save(); keep(render); } },
    rw(id) { const j = job(id); j._rw = !j._rw; keep(render); },
    complete(id) {
      const j = job(id);
      if (!(j.workDone || "").trim()) { toast("Add the work performed first"); return A.tab(id, "work"); }
      if (!j._rw) return toast("Confirm the vehicle is roadworthy");
      if (!sigs["job:" + id]) return toast("Sign to complete");
      (j.labour || []).forEach(l => { if (!l.end) l.end = Date.now(); });
      Object.assign(j, { status: "Complete", closedAt: Date.now(), signedOffBy: me.id, roadworthy: true, sig: sigs["job:" + id] });
      delete j._rw; delete sigs["job:" + id];
      save(); keep(render);
      toast(j.priority === "VOR" ? X.veh(j.vehicleId).fleet + " is back in service" : "Job card completed");
    },
  };

  /* ---------- boot ---------- */
  (async function boot() {
    render();
    try { S = await Store.load(); } catch (e) { $("#app").innerHTML = `<div class="scr"><div class="empty" style="margin-top:40vh">Can't reach the server. Check your signal and try again.</div></div>`; return; }
    X = M.api(S);
    if (M.migrate(S)) Store.sync(S);
    const id = lsGet(LS.me); me = id ? X.person(id) : null;
    const d = lsGet(LS.draft); if (d && X.veh(d.vehicleId)) draft = d;
    render();
    Store.onError(() => toast("Couldn't save — check your signal"));
    const busy = () => { const a = document.activeElement, r = route(); return (r.name === "check" && r.parts[1] === "new") || ui.sheet || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) || Object.keys(sigs).length > 0; };
    Store.poll(busy, s => { S = s; X = M.api(S); keep(render); });
  })();
})();
