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
  const ui = { q: "", jobsTab: "all", jobsWho: "all", jq: "", hTab: "all", hq: "", sheet: null, sWeek: null, sDay: null, sWho: "all", sq: "", sLoc: "", sLow: false };
  const sigs = {};
  const LS = { me: "martleys-m-me", draft: "martleys-m-draft" };

  const $ = s => document.querySelector(s);
  // On a phone the page itself scrolls; in the desktop phone frame the .body pane does.
  const panes = () => [$("#app > .scr > .body"), $("#app > .scr")].filter(Boolean);
  const scroller = () => panes().find(s => s.scrollHeight > s.clientHeight && getComputedStyle(s).overflowY === "auto") || document.scrollingElement;
  const toTop = () => { panes().forEach(s => { s.scrollTop = 0; }); window.scrollTo(0, 0); };
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
        if (k === "draft") { if (draft) { draft.sig = url; lsSet(LS.draft, draft); } }
        else { sigs[k] = url; const b = $("#closebtn"); if (b) b.disabled = false; }
      });
    });
    tick();
  }
  // White status-bar text while a dark header (home hero, login) sits under it; dark otherwise.
  function sbTone() { document.body.dataset.sb = ui.sheet ? "dark" : "light"; }
  setInterval(tick, 1000);
  function tick() {
    document.querySelectorAll("[data-since]").forEach(el => { el.textContent = clockText((Date.now() - Number(el.dataset.since)) / 1000 + Number(el.dataset.base || 0) * 60); });
    document.querySelectorAll("[data-clock]").forEach(el => { const d = new Date(); el.textContent = M.pad(d.getHours()) + ":" + M.pad(d.getMinutes()) + (el.dataset.clock === "s" ? ":" + M.pad(d.getSeconds()) : ""); });
  }
  // "Wed, 4 Nov 2026 at 10:09"
  const fmtLong = ts => { const d = new Date(ts); return M.DOW[d.getDay()] + ", " + d.getDate() + " " + M.MON[d.getMonth()] + " " + d.getFullYear() + " at " + fmtT(ts); };
  const fmtSlash = ts => { const d = new Date(ts); return M.pad(d.getDate()) + "/" + M.pad(d.getMonth() + 1) + "/" + d.getFullYear(); };
  const clockText = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 3600) + ":" + M.pad(Math.floor(s / 60) % 60) + ":" + M.pad(s % 60); };

  function view(r) {
    switch (r.name) {
      case "": return home();
      case "fleet": return fleet();
      case "check": return r.parts[1] === "new" ? checkFlow(r.q) : checkView(r.parts[1], r.q);
      case "history": return history();
      case "profile": return profile();
      case "schedule": return schedule();
      case "stock": return stock();
      case "defect": return reportDefect(r.q);
      case "jobs": if (r.q.tab) { ui.jobsTab = r.q.tab; window.history.replaceState(null, "", "#/jobs"); } return jobsList();
      case "job": return r.parts[1] === "new" ? jobNew(r.q) : jobSheet(r.parts[1], r.q.tab || "details");
      default: return screen("Not found", `<div class="empty">Page not found. <a href="#/">Home</a></div>`);
    }
  }

  // Standard screen: sticky top bar, body, optional dock or bottom tabs.
  function screen(title, body, opt = {}) {
    const back = opt.back === false ? `<span class="side"></span>` : `<a class="round" href="${opt.back || "#/"}" aria-label="Back">${I("left", 20, 2.6)}</a>`;
    return `<div class="bar"><span style="width:42px">${back}</span><div class="ttl">${esc(title)}</div><span class="side">${opt.right || ""}</span></div>
      <div class="body">${body}</div>${opt.dock ? `<div class="dock">${opt.dock}</div>` : ""}${opt.noTabs ? "" : tabs()}`;
  }
  function tabs() {
    const r = route();
    const items = [["check/new", "bus", "Checklist"], ["", "dash", "Home"], ["profile", "users", "Profile"]];
    const cur = r.name === "check" || r.name === "history" ? "check/new" : r.name === "profile" ? "profile" : "";
    return `<nav class="tabs">${items.map(([h, ic, l]) => `<a href="#/${h}" class="${cur === h ? "on" : ""}"><span class="ti">${I(ic, 22)}</span>${l}</a>`).join("")}</nav>`;
  }
  const meBtn = () => `<a class="${avClass(me)}" style="width:38px;height:38px" href="#/profile" aria-label="Profile">${initials(me.name)}</a>`;
  const vTag = (v, lg) => `<span class="fleetno ${lg ? "lg" : ""}">${esc(v.fleet)}</span>`;

  /* ---------- login ---------- */
  function login() {
    const ppl = S.staff.filter(s => s.role !== "admin").sort((a, b) => (a.role === "mechanic" ? 0 : 1) - (b.role === "mechanic" ? 0 : 1) || a.name.localeCompare(b.name));   // workshop first
    return `<div class="login2"><div class="logoc"><img src="logo.png" alt="Martley's"></div>
      <div class="lpanel"><select class="lin" id="luser" onchange="document.getElementById('lerr').textContent=''"><option value="">SELECT USER</option>${ppl.map(p => `<option value="${p.id}">${esc(p.name)} · ${esc(M.ROLE[p.role])}</option>`).join("")}</select>
        <input class="lin" id="lpin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="PIN" onkeydown="if(event.key==='Enter')A.login()"></div>
      <button class="lbtn" onclick="A.login()">Login</button><div class="lerr" id="lerr"></div>
      <p class="lhint">Demo PIN 1111 for everyone. The office and workshop manager use the <a href="/admin/">desktop admin</a>.</p></div>`;
  }

  /* ---------- home ---------- */
  function qa(href, ic, title, sub, opt = {}) {
    if (opt.locked) return `<div class="qa2 locked"><span class="qi">${I(ic, 22, 2.2)}</span><div class="grow"><b>${title}</b><span>${sub}</span></div><span class="lockpill">${I("lock", 13, 2.4)} Checklist first</span></div>`;
    return `<a class="qa2" href="${href}"><span class="qi">${I(ic, 22, 2.2)}</span><div class="grow"><b>${title}</b><span>${sub}</span></div>${opt.badge ? `<span class="badge">${opt.badge}</span>` : ""}<span class="qc">${I("chev", 18, 2.4)}</span></a>`;
  }
  function attention() {
    return S.jobs.filter(j => j.status !== "Complete" && (j.priority === "VOR" || !j.mechId)).sort((a, b) => (a.priority === "VOR" ? 0 : 1) - (b.priority === "VOR" ? 0 : 1) || b.created - a.created);
  }
  function home() {
    const hr = new Date().getHours(), c = me.clock;
    const open = S.jobs.filter(j => j.status !== "Complete"), mineOpen = open.filter(j => j.mechId === me.id);
    const todays = S.checks.filter(x => x.driverId === me.id && isoOf(x.at) === today()).sort((a, b) => b.at - a.at);
    const vor = S.vehicles.filter(X.vorJob), att = attention();
    const dv = draft && X.veh(draft.vehicleId);
    const run = S.jobs.find(j => (j.labour || []).some(l => !l.end && l.mechId === me.id));
    const checked = todays.length > 0;
    const head = `<div class="hhead"><div class="row" style="gap:12px"><span class="hav">${initials(me.name)}</span><div class="grow"><h1>Good ${hr < 12 ? "Morning" : hr < 18 ? "Afternoon" : "Evening"}, ${esc(me.name.split(" ")[0])}</h1><div class="htime"><i class="dot green"></i><span data-clock="m">${fmtT(Date.now())}</span>${c ? ` · on ${esc(c.type)} since ${fmtT(c.at)}` : ""}</div></div>
          <a class="hic" href="#/fleet" aria-label="Fleet status">${I("bus", 19)}</a><button class="hic" onclick="A.sheet('alerts')" aria-label="Needs attention">${I("alert", 19)}${att.length ? `<span class="hdot">${att.length}</span>` : ""}</button></div>
        <div class="hbtns">${c ? `<button class="hout" onclick="A.sheet('clockout')">${I("clock", 18)} Clock Out</button>` : `<button class="hin" onclick="A.clockIn()">${I("check", 18, 2.6)} Clock In</button>`}<button class="hsw" onclick="A.sheet('switch')">${I("refresh", 18)} Switch</button></div></div>`;
    let now = "";
    if (run) {
      const v = X.veh(run.vehicleId), l = run.labour.find(x => !x.end && x.mechId === me.id);
      now = `<div class="oncl2"><div class="row"><span class="dot green"></span><b class="grow">On the clock · #${esc(run.id)} ${esc(v.external ? v.reg : v.fleet)}</b><span class="bigt" data-since="${l.start}">${clockText((Date.now() - l.start) / 1000)}</span></div><div class="small ellipsis" style="margin-top:4px">${esc(run.title)}</div>
        <div class="row" style="margin-top:12px"><a class="btn pri grow" href="#/job/${run.id}?tab=work">Open job sheet</a><button class="btn danger" onclick="A.clock('${run.id}')">${I("stop", 16)} Stop</button></div></div>`;
    }
    return head + `<div class="body home2">${now}<h2 class="qah">Quick Access</h2>
      ${qa("#/jobs", "wrench", "Job Sheets", mineOpen.length ? mineOpen.length + " assigned to you · " + open.length + " open" : open.length + " open job cards", { badge: mineOpen.length || "" })}
      ${qa("#/schedule", "calendar", "Workshop Schedule", (() => { const tj = S.jobs.filter(j => j.plan && j.plan.date === today() && j.status !== "Complete"); const mt = tj.filter(j => j.mechId === me.id).length; return tj.length ? tj.length + " planned today" + (mt ? " · " + mt + " yours" : "") : "Nothing planned today"; })())}
      ${qa("#/stock", "box", "Parts & Stock", (() => { const low = X.stock().filter(M.lowStock).length; return X.stock().length + " parts" + (low ? " · " + low + " low" : " · all in stock"); })(), { badge: X.stock().filter(M.lowStock).length || "" })}
      ${qa("#/check/new", "clip", "Walk-around Checklist", dv ? "Continue check on " + esc(dv.fleet) + " · " + Object.keys(draft.results).length + " items done" : checked ? "Done today at " + fmtT(todays[0].at) + " · " + esc(X.veh(todays[0].vehicleId).fleet) : "Complete before shift")}
      ${qa("#/defect", "alert", "Report a Defect", "Goes straight to the workshop")}
      ${qa("#/history", "list", "Check History", "This week's submissions")}
      ${qa("#/fleet", "bus", "Fleet Status", vor.length ? vor.length + " off road · " + S.vehicles.filter(v => X.checkedToday(v)).length + "/" + S.vehicles.length + " checked" : "Whole fleet available", { badge: vor.length || "" })}
      ${qa("tel:0578620888", "phone", "Call the Depot", "057 862 0888")}
      <div class="appver">App Version : 2.4.0</div></div>${tabs()}`;
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

  function checkFlow(q) {
    if (q.v && (!draft || draft.vehicleId !== q.v)) startDraft(q.v);
    const v = draft && X.veh(draft.vehicleId), secs = v ? M.sectionsFor(v) : [];
    const total = secs.reduce((a, s) => a + s.items.length, 0);
    const done = secs.reduce((a, s) => a + s.items.filter(it => itemDone(draft.results[it.key])).length, 0);
    const defs = draft ? Object.values(draft.results).filter(r => r.s === "def") : [];
    const nil = v && done === total && !defs.length;
    const vor = v && X.vorJob(v), known = v ? X.openJobs(v).filter(j => j !== vor) : [];
    const body = `<div class="infobox"><div>Employee : <b>${esc(me.name)}</b></div><div>Date : <b>${fmtSlash(Date.now())}</b></div><div>Reg : <b>${v ? esc(v.reg) : "—"}</b></div><div>Time : <b data-clock="s">${fmtT(Date.now())}</b></div></div>
      <label class="fl">Select Vehicle *</label>
      <select class="in dk" onchange="A.pickVeh(this.value)"><option value="">Select Vehicle</option>${S.vehicles.map(x => `<option value="${x.id}" ${v && x.id === v.id ? "selected" : ""}>${esc(x.fleet)} · ${esc(x.reg)} · ${esc(x.model)}${X.vorJob(x) ? " (off road)" : X.checkedToday(x) ? " ✓" : ""}</option>`).join("")}</select>
      ${vor ? `<div class="notice red" style="margin-top:12px">${I("alert")}<div><b>Off the road — do not drive.</b><br>${esc(vor.title)}. Speak to the transport office.</div></div>` : ""}
      ${known.length ? `<div class="notice amber" style="margin-top:12px">${I("wrench")}<div><b>Already with the workshop</b> — no need to report again:<br>${known.map(j => "• " + esc(j.title)).join("<br>")}</div></div>` : ""}
      ${v ? `<label class="fl">General Remarks</label><input class="in" placeholder="Enter general remarks…" value="${esc(draft.remarks)}" oninput="A.remarks(this.value)">
      <label class="fl">Odometer Reading *</label><input class="in" id="odo" inputmode="numeric" placeholder="Enter odometer reading…" value="${draft.odo}" oninput="A.odo(this.value)"><div class="xs muted" style="margin-top:5px">Last recorded ${km(v.odo)}</div><div class="xs" id="odoerr" style="color:var(--red);margin-top:2px"></div>` : ""}
      <div class="ctable"><div class="chd"><span>Item</span><span>Checked</span><span>Remark</span></div>
        ${v ? secs.map(sec => `<div class="csec">${esc(sec.name)}</div>` + sec.items.map(itemRow).join("")).join("") : `<div class="cnone">Select a vehicle to load the checklist</div>`}</div>
      ${v ? `<div class="cprog">${done} of ${total} checked${defs.length ? ` · <b style="color:var(--red)">${defs.length} defect${defs.length > 1 ? "s" : ""}</b>` : ""}</div>
      <button class="nilrow" onclick="A.nil()"><span class="nbox ${nil ? "on" : ""}">${I(nil ? "check" : "x", 18, 3)}</span>NIL Defects</button>
      <button class="selall" onclick="A.allOkAll()">${I("checks", 18, 2.4)} Select All</button>
      <div class="phead">${I("camera", 18)} Photos (${draft.photos.length}/6)</div>
      <div class="phgrid">${draft.photos.map((ph, i) => `<div class="ph-i"><img src="/api/files/${ph}" onclick="M.lightbox(this.src)" alt=""><button class="rm" onclick="A.rmPhoto(${i})">${I("x", 12, 3)}</button></div>`).join("")}${draft.photos.length < 6 ? `<label class="addph2">${I("camera", 26)}<span>Add Photo</span><input type="file" accept="image/*" onchange="A.chkPhoto(this)"></label>` : ""}</div>
      <div class="phead" style="margin-top:18px">Signature</div>
      <button class="sigrow" onclick="A.sheet('sig')">${draft.sig ? `<img src="${draft.sig}" alt="Signature">` : `${I("pen", 18)}<span class="grow">Add Signature</span>`}<span class="chev">${I("chev", 16)}</span></button>` : ""}`;
    return `<div class="bar"><span style="width:42px"><button class="round" onclick="A.cancel()" aria-label="Back">${I("left", 20, 2.6)}</button></span><div class="ttl">Vehicle Checklist</div><span class="side"><a class="hist" href="#/history" aria-label="Check history">${I("list", 20)}</a></span></div>
      <div class="body" style="padding-bottom:20px">${body}</div><div class="dock"><button class="btn lg brand block" onclick="A.submit()">Submit</button></div>${tabs()}`;
  }

  function itemRow(it) {
    const r = draft.results[it.key] || {};
    const mark = r.s === "ok" ? `<span class="mk ok">${I("check", 18, 3)}</span>` : r.s === "def" ? `<span class="mk def">${I("x", 18, 3)}</span>` : r.s === "na" ? `<span class="mk na">N/A</span>` : `<span class="mk"></span>`;
    return `<div class="crow ${r.s || ""}" id="it-${it.key}"><div class="ci">${esc(it.label)}${it.trailer ? `<em>Trailers only</em>` : ""}</div><button class="cc" onclick="A.cycle('${it.key}')" aria-label="Checked">${mark}</button><button class="cr" onclick="A.mark('${it.key}','def')">${r.s === "def" ? (r.note ? `<span class="rn">${esc(r.note)}</span>` : `<span class="rn need">Add remark</span>`) : "Remark"}</button></div>
      ${r.s === "def" ? `<div class="defbox"><textarea class="in" placeholder="What's wrong? Where is it?" oninput="A.note('${it.key}',this.value)">${esc(r.note || "")}</textarea>
        <div class="sev"><button class="minor ${r.sev === "minor" ? "on" : ""}" onclick="A.sev('${it.key}','minor')"><b>Minor</b>Safe to drive</button><button class="major ${r.sev === "major" ? "on" : ""}" onclick="A.sev('${it.key}','major')"><b>Major</b>Do not drive</button></div>
        <div class="photos">${(r.photos || []).map(ph => `<div class="ph-i"><img src="/api/files/${ph}" onclick="M.lightbox(this.src)" alt=""></div>`).join("")}<label class="addph">${I("camera", 22)}<input type="file" accept="image/*" capture="environment" onchange="A.itemPhoto('${it.key}',this)"></label></div></div>` : ""}`;
  }

  function checkView(id, q) {
    const c = S.checks.find(x => x.id === id);
    if (!c) return screen("Check", `<div class="empty">Check not found.</div>`, { back: "#/history" });
    const v = X.veh(c.vehicleId), o = M.outcome(c), defs = M.defectsOf(c), secs = M.sectionsFor(v);
    const res = it => M.resultOf(c, it, v);
    const top = q.done ? `<div class="result ${o.res}"><div class="ic">${I(o.res === "ok" ? "check" : "alert", 36, 2.6)}</div><div class="big">${o.res === "ok" ? "Fit to drive" : o.res === "bad" ? "Do not drive" : "Defects reported"}</div><p>${o.res === "ok" ? "Nil defects. Have a safe trip, " + esc(me.name.split(" ")[0]) + "." : o.res === "bad" ? esc(v.fleet) + " is off the road. The workshop has been alerted — contact the office for another vehicle." : "The workshop has a job card for each defect. You can use the vehicle."}</p></div>
      <a class="btn block lg brand" style="margin:12px 0 4px" href="#/">Done</a>` : "";
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
    const from = M.addDaysIso(today(), -6), q = ui.hq.toLowerCase();
    const all = S.checks.filter(c => isoOf(c.at) >= from);
    const tabs3 = [["all", "All", all], ["mine", "Mine", all.filter(c => c.driverId === me.id)], ["def", "With defects", all.filter(c => M.defectsOf(c).length)]];
    const list = (tabs3.find(t => t[0] === ui.hTab) || tabs3[0])[2].filter(c => { const v = X.veh(c.vehicleId) || {}; return !q || (v.reg + " " + v.fleet + " " + X.pname(c.driverId)).toLowerCase().includes(q); }).sort((a, b) => b.at - a.at);
    return screen("Walk-around Checks", `<div class="search">${I("search", 18)}<input id="hsearch" placeholder="Search…" value="${esc(ui.hq)}" oninput="A.hsearch(this.value)" autocomplete="off"></div>
      <div class="pills" style="margin-top:12px">${tabs3.map(([k, l, ls]) => `<button class="pl ${ui.hTab === k ? "on" : ""}" onclick="A.htab('${k}')">${l} <span>${ls.length}</span></button>`).join("")}</div>
      <div class="wkhead"><span>THIS WEEK'S SUBMISSIONS</span><span>${fmtD(from)} – ${fmtD(today())}</span></div>
      ${list.map(c => { const v = X.veh(c.vehicleId) || { reg: "?", fleet: "?" }, o = M.outcome(c); return `<div class="subcard"><div class="row" style="align-items:flex-start"><div class="grow"><div class="sreg">${esc(v.reg)}</div><div class="swhen">${fmtLong(c.at)}</div></div>${pill(o.cls, o.label)}</div>
        <div class="row" style="margin-top:10px"><span class="muted">Driver</span><b>${esc(X.pname(c.driverId))}</b><span class="grow"></span><a class="pdfb" href="#/check/${c.id}"><span class="pdfi">PDF</span> View PDF</a></div></div>`; }).join("") || `<div class="empty">No checks match.</div>`}`,
      { back: "#/", dock: `<a class="newbar" href="#/check/new">+ New Checklist</a>`, noTabs: true });
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
    const q = ui.jq.toLowerCase(), prio = { VOR: 0, High: 1, Normal: 2 };
    const base = S.jobs.filter(j => {
      const v = X.veh(j.vehicleId) || {};
      if (ui.jobsWho === "fleet" && M.isExternal(j)) return false;
      if (ui.jobsWho === "ext" && !M.isExternal(j)) return false;
      return !q || (j.id + " " + j.title + " " + v.fleet + " " + v.reg + " " + j.type + " " + (j.customer || "")).toLowerCase().includes(q);
    });
    const active = base.filter(j => j.status !== "Complete"), done = base.filter(j => j.status === "Complete");
    const todayJobs = base.filter(j => j.plan && j.plan.date === today() && (me.role !== "mechanic" || j.mechId === me.id));
    const mine = active.filter(j => j.mechId === me.id);
    const sets = { all: base, today: todayJobs, mine, active, done };
    const show = (sets[ui.jobsTab] || base).slice().sort((a, b) => (a.status === "Complete") - (b.status === "Complete") || prio[a.priority] - prio[b.priority] || b.created - a.created);
    const pl = (k, l, n, fn, cur) => `<button class="pl ${cur === k ? "on" : ""}" onclick="${fn}('${k}')">${l}${n === undefined ? "" : ` <span>${n}</span>`}</button>`;
    return screen("Job Sheets", `<div class="search">${I("search", 18)}<input id="jsearch" placeholder="Search job cards…" value="${esc(ui.jq)}" oninput="A.jsearch(this.value)" autocomplete="off"></div>
      <div class="pills" style="margin-top:12px">${pl("all", "All", base.length, "A.jtab", ui.jobsTab)}${pl("today", "Today", todayJobs.length, "A.jtab", ui.jobsTab)}${pl("mine", "Mine", mine.length, "A.jtab", ui.jobsTab)}${pl("active", "Active", active.length, "A.jtab", ui.jobsTab)}${pl("done", "Completed", done.length, "A.jtab", ui.jobsTab)}</div>
      <div class="pills" style="margin-top:8px">${pl("all", "All Types", undefined, "A.jwho", ui.jobsWho)}<button class="pl ${ui.jobsWho === "fleet" ? "on" : ""}" onclick="A.jwho('fleet')">${I("bus", 14)} Fleet</button><button class="pl ${ui.jobsWho === "ext" ? "on" : ""}" onclick="A.jwho('ext')">${I("folder", 14)} Outside</button></div>
      <a class="btn lg brand block" href="#/job/new" style="margin-top:14px">+ Create New Job Card</a>
      <div class="twobtn"><a href="#/schedule">${I("calendar", 17)} Schedule</a><a href="#/stock">${I("box", 17)} Parts &amp; Stock</a></div>
      <div class="wkhead" style="margin-top:18px"><span>${{ all: "ALL", today: "TODAY'S", mine: "MY", active: "ACTIVE", done: "COMPLETED" }[ui.jobsTab] || "ALL"} JOB CARDS (${show.length})</span></div>
      ${show.map(jobCard).join("") || `<div class="empty">No job cards here.</div>`}`, { back: "#/" });
  }
  function jobCard(j) {
    const v = X.veh(j.vehicleId), running = (j.labour || []).some(l => !l.end), ext = M.isExternal(j);
    const st = j.status === "Complete" ? "done" : j.status === "In progress" ? "prog" : j.status === "Awaiting parts" ? "wait" : "open";
    return `<div class="jc2"><div class="row" style="gap:8px"><span class="jno">#${esc(j.id)}</span><span class="jtag ${ext ? "ext" : ""}">${I(ext ? "folder" : "bus", 12)} ${esc(j.type)}</span><span class="grow"></span><span class="jst ${st}">${esc(j.status.toLowerCase())}</span></div>
      <div class="jsub">${esc(v.external ? v.reg : v.fleet + " " + v.reg)} · ${esc(j.customer || "Martley's fleet")} · ${isoOf(j.created)}</div>
      <div class="jttl">${j.priority === "VOR" && j.status !== "Complete" ? `<span style="color:var(--red)">● VOR</span> ` : ""}${esc(j.title)}</div>
      ${j.plan && j.status !== "Complete" ? `<div class="xs" style="margin-top:4px;font-weight:700;color:${j.plan.date === today() ? "var(--green-ink)" : "var(--muted)"}">${I("calendar", 13)} Planned ${esc(fmtDay(j.plan.date).toLowerCase())} · ${j.plan.hours}h</div>` : ""}
      <div class="row" style="margin-top:12px"><span class="${avClass(X.person(j.mechId))} sm">${j.mechId ? initials(X.pname(j.mechId)) : "?"}</span><span class="small">${j.mechId ? esc(X.pname(j.mechId).split(" ")[0]) : `<span style="color:var(--amber);font-weight:700">Unassigned</span>`} · ${running ? `<b style="color:var(--green-ink)">● </b>` : ""}${hrs(M.jobMins(j))}</span><span class="grow"></span><a class="pdfb" href="#/job/${j.id}${j.status === "Complete" ? "?tab=done" : ""}"><span class="pdfi">PDF</span> View PDF</a></div></div>`;
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
        ${locked ? "" : `<div class="card pad schedcard"><div class="row">${I("calendar", 20)}<div class="grow"><b>${j.plan ? "Planned " + esc(fmtDay(j.plan.date).toLowerCase()) + " · " + j.plan.hours + "h" : "Not on the schedule"}</b><div class="xs muted">${j.plan ? (j.mechId ? esc(X.pname(j.mechId)) : "No mechanic yet") : "Add it so it shows on the workshop planner"}</div></div><button class="btn sm brand" onclick="A.sheet('plan:${j.id}')">${j.plan ? "Amend" : "Add"}</button></div></div>`}
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

  /* ---------- workshop schedule ---------- */
  const DAY_H = d => new Date(d + "T12:00").getDay() === 6 ? 4 : 8;
  const planHrs = js => js.filter(j => j.status !== "Complete").reduce((a, j) => a + (Number(j.plan.hours) || 0), 0);
  function schedule() {
    const t = today(), wk = ui.sWeek || M.weekStart(t), days = Array.from({ length: 6 }, (_, i) => M.addDaysIso(wk, i));
    const day = days.includes(ui.sDay) ? ui.sDay : days.includes(t) ? t : days[0];
    const onDay = d => S.jobs.filter(j => j.plan && j.plan.date === d && (ui.sWho !== "mine" || j.mechId === me.id));
    const mechs = S.staff.filter(x => x.role === "mechanic" && (ui.sWho !== "mine" || x.id === me.id));
    const js = onDay(day), tray = S.jobs.filter(j => j.status !== "Complete" && !j.plan);
    const group = (mid, name, person) => {
      const list = js.filter(j => (j.mechId || "") === mid).sort((a, b) => (a.status === "Complete") - (b.status === "Complete") || ({ VOR: 0, High: 1, Normal: 2 })[a.priority] - ({ VOR: 0, High: 1, Normal: 2 })[b.priority]);
      if (!person && !list.length) return "";
      const h = planHrs(list), max = DAY_H(day);
      return `<div class="sgrp"><div class="row sgh"><span class="${person ? avClass(person) : "av"} sm">${person ? initials(name) : "?"}</span><b class="grow">${esc(name)}${person && person.id === me.id ? " (you)" : ""}</b><span class="xs muted">${h}/${max}h</span></div>
        <div class="sload ${h > max ? "over" : ""}"><i style="width:${Math.min(100, h / max * 100)}%"></i></div>
        ${list.map(j => schedJob(j)).join("") || `<div class="sempty">Nothing planned</div>`}</div>`;
    };
    return screen("Workshop Schedule", `<div class="row wknav"><button class="round2" onclick="A.sweek(-1)" aria-label="Previous week">${I("left", 18, 2.4)}</button><div class="grow" style="text-align:center"><b>Week of ${fmtD(wk)}</b>${wk !== M.weekStart(t) ? `<div><button class="linkbtn" onclick="A.sweek(0)">Back to this week</button></div>` : ""}</div><button class="round2" onclick="A.sweek(1)" aria-label="Next week" style="transform:scaleX(-1)">${I("left", 18, 2.4)}</button></div>
      <div class="dstrip">${days.map(d => { const n = onDay(d).filter(j => j.status !== "Complete").length; return `<button class="dd ${d === day ? "on" : ""} ${d === t ? "today" : ""}" onclick="A.sday('${d}')"><span>${M.DOW[new Date(d + "T12:00").getDay()]}</span><b>${Number(d.slice(8))}</b><i>${n || ""}</i></button>`; }).join("")}</div>
      <div class="pills" style="margin-top:12px"><button class="pl ${ui.sWho !== "mine" ? "on" : ""}" onclick="A.swho('all')">Whole workshop</button><button class="pl ${ui.sWho === "mine" ? "on" : ""}" onclick="A.swho('mine')">My jobs</button></div>
      <button class="btn lg brand block" style="margin-top:14px" onclick="A.sheet('planpick')">+ Add to Schedule</button>
      <div class="wkhead" style="margin-top:18px"><span>${esc(fmtDay(day).toUpperCase())} · ${fmtD(day).toUpperCase()}</span><span>${js.length} job${js.length === 1 ? "" : "s"}</span></div>
      ${mechs.map(m => group(m.id, m.name, m)).join("")}${ui.sWho === "mine" ? "" : group("", "Unassigned", null)}
      <div class="wkhead" style="margin-top:20px"><span>NOT SCHEDULED YET</span><span>${tray.length}</span></div>
      ${tray.length ? tray.slice(0, 12).map(j => schedJob(j, true)).join("") : `<div class="empty" style="padding:14px">Every open job is on the schedule.</div>`}`, { back: "#/" });
  }
  function schedJob(j, unplanned) {
    const v = X.veh(j.vehicleId), done = j.status === "Complete", run = (j.labour || []).some(l => !l.end);
    return `<div class="sj2 ${done ? "done" : ""} ${j.priority === "VOR" && !done ? "vor" : ""}"><a class="grow" href="#/job/${j.id}"><div class="row" style="gap:6px"><span class="jtag ${v.external ? "ext" : ""}">${esc(v.external ? v.reg : v.fleet)}</span><b class="xs">#${esc(j.id)}</b>${run ? `<span class="dot green"></span>` : ""}<span class="grow"></span><span class="xs muted">${j.plan ? j.plan.hours + "h" : esc(j.status)}</span></div>
      <div class="sjt">${esc(j.title)}</div><div class="xs muted">${done ? "Complete" : esc(j.status)}${M.isExternal(j) ? " · " + esc(j.customer) : ""}${unplanned && j.mechId ? " · " + esc(X.pname(j.mechId).split(" ")[0]) : ""}${j.priority === "VOR" && !done ? ` · <b style="color:var(--red)">VOR</b>` : ""}</div></a>
      ${done ? "" : `<button class="btn sm ${unplanned ? "brand" : ""}" onclick="A.sheet('plan:${j.id}')">${unplanned ? "Add" : "Amend"}</button>`}</div>`;
  }

  /* ---------- parts & stock ---------- */
  function stock() {
    const q = ui.sq.toLowerCase(), locs = X.locations(), all = X.stock();
    const list = all.filter(p => (!ui.sLoc || p.loc === ui.sLoc) && (!ui.sLow || M.lowStock(p)) && (!q || (p.partNo + " " + p.desc + " " + (p.cat || "") + " " + (p.bin || "")).toLowerCase().includes(q)))
      .sort((a, b) => locs.findIndex(l => l.id === a.loc) - locs.findIndex(l => l.id === b.loc) || String(a.bin || "").localeCompare(String(b.bin || "")));
    const low = all.filter(M.lowStock).length;
    return screen("Parts & Stock", `<div class="search">${I("search", 18)}<input id="ssearch" placeholder="Search part no. or description…" value="${esc(ui.sq)}" oninput="A.ssearch(this.value)" autocomplete="off"></div>
      <div class="pills" style="margin-top:12px"><button class="pl ${!ui.sLoc ? "on" : ""}" onclick="A.sloc('')">All places <span>${all.length}</span></button>${locs.map(l => `<button class="pl ${ui.sLoc === l.id ? "on" : ""}" onclick="A.sloc('${l.id}')">${esc(l.name)} <span>${all.filter(p => p.loc === l.id).length}</span></button>`).join("")}</div>
      <div class="pills" style="margin-top:8px"><button class="pl ${ui.sLow ? "on" : ""}" onclick="A.slow()">${I("alert", 14)} Low or out <span>${low}</span></button></div>
      <button class="btn lg brand block" style="margin-top:14px" onclick="A.sheet('newpart')">+ Add New Part</button>
      <div class="wkhead" style="margin-top:18px"><span>${ui.sLoc ? esc((X.loc(ui.sLoc) || {}).name || "").toUpperCase() : "ALL STOCK"} (${list.length})</span><span>Tap Book In when a delivery arrives</span></div>
      ${list.map(stockCard).join("") || `<div class="empty">No parts match.</div>`}
      ${X.moves().length ? `<div class="wkhead" style="margin-top:20px"><span>RECENT STOCK MOVEMENTS</span></div><div class="card list">${X.moves().slice(0, 8).map(m => { const pt = X.stockItem(m.stockId); return `<div class="li" style="cursor:default"><b class="small" style="width:40px;color:${m.qty < 0 ? "var(--red)" : m.qty > 0 ? "var(--green-ink)" : "var(--muted)"}">${m.qty > 0 ? "+" : ""}${m.qty || "↔"}</b><div class="grow"><div class="t ellipsis" style="font-size:14px">${esc(pt ? pt.desc : "Removed part")}</div><div class="m">${esc(m.why)}${m.jobId ? " · #" + esc(m.jobId) : ""} · ${esc(X.pname(m.by).split(" ")[0])} · ${fmtDT(m.at)}</div></div></div>`; }).join("")}</div>` : ""}`, { back: "#/" });
  }
  function stockCard(p) {
    const l = X.loc(p.loc), out = p.qty <= 0, low = M.lowStock(p);
    return `<div class="stk"><div class="row" style="align-items:flex-start"><div class="grow"><div class="stkt">${esc(p.desc)}</div><div class="xs muted">${esc(p.partNo)}${p.cat ? " · " + esc(p.cat) : ""} · ${eur(p.cost)} each</div></div><div class="stkq ${out ? "out" : low ? "low" : ""}"><b>${p.qty}</b><span>on hand</span></div></div>
      <div class="row" style="margin-top:10px"><span class="stkl">${I("pin", 14)} ${esc(l ? l.name : "Unplaced")}${p.bin ? " · " + esc(p.bin) : ""}</span>${M.stockPill(p)}<span class="grow"></span><button class="btn sm brand" onclick="A.sheet('stk:${p.id}')">+ Book In</button></div></div>`;
  }

  const CERTS = [["licence", "Driving Licence", 1], ["cpc", "Driver CPC Card", 0], ["manual", "Manual Handling", 0], ["safepass", "Safe Pass", 0]];
  function profile() {
    const docs = me.docs || {}, since = Date.now() - 30 * 864e5;
    const myChecks = S.checks.filter(c => c.driverId === me.id && c.at > since);
    const myHrs = S.jobs.reduce((a, j) => a + (j.labour || []).filter(l => l.mechId === me.id && l.start > since).reduce((b, l) => b + ((l.end || Date.now()) - l.start) / 60000, 0), 0);
    const shifts = (me.shifts || []).filter(x => x.start > since);
    const fileRow = (k, label) => { const d = docs[k] || {}; return `<label class="fl">${label}</label><label class="filein"><span class="fb">Choose file</span><span class="fn">${d.file ? `<a href="/api/files/${d.file.id}" target="_blank" onclick="event.stopPropagation()">${esc(d.file.name)}</a>` : "No file chosen"}</span><input type="file" accept="image/*,application/pdf" onchange="A.certFile('${k}',this)"></label>`; };
    return screen("Profile", `<div class="card pad rec"><h2 class="uh">Employee Record</h2>
        <div class="row" style="gap:14px;margin-bottom:14px"><span class="${avClass(me)} lg">${initials(me.name)}</span><div><div style="font-weight:800;font-size:19px">${esc(me.name)}</div><div class="muted small">${esc(me.title || M.ROLE[me.role])} · Martley's of Portlaoise</div></div></div>
        <div class="kvl"><div><span>Phone</span><b>${esc(me.phone || "—")}</b></div><div><span>Licence categories</span><b>${esc(me.licence || "—")}</b></div><div><span>Start date</span><b>${me.joined ? fmtD(me.joined) : "—"}</b></div><div><span>Depot</span><b>Kilminchy, Portlaoise</b></div></div></div>
      <div class="card pad rec"><h2 class="uh">Last 30 Days</h2><div class="kvl c3"><div><span>Checks</span><b>${myChecks.length}</b></div><div><span>Defects reported</span><b>${myChecks.reduce((a, c) => a + M.defectsOf(c).length, 0)}</b></div><div><span>${me.role === "mechanic" ? "Hours on jobs" : "Shifts"}</span><b>${me.role === "mechanic" ? hrs(myHrs) : shifts.length}</b></div></div></div>
      ${CERTS.map(([k, label, two]) => { const d = docs[k] || {}, days = d.exp ? M.daysUntil(d.exp) : null; return `<div class="card pad rec"><h2 class="uh">${label}${d.exp ? `<span class="right">${duePill(d.exp)}</span>` : ""}</h2>
        ${fileRow(k, label + " Document")}
        <label class="fl">Expiry Date *</label><input type="date" class="in" value="${d.exp || ""}" onchange="A.certExp('${k}',this.value)">${days !== null && days < 0 ? `<div class="xs" style="color:var(--red);margin-top:4px">Expired — upload the renewed ${label.toLowerCase()}.</div>` : ""}
        ${two ? fileRow(k + "B", "Upload Back of Licence") : ""}</div>`; }).join("")}
      <button class="btn block lg" style="margin-top:4px;color:var(--red)" onclick="A.logout()">${I("out", 18)} Sign out</button>`, { back: "#/" });
  }

  /* ---------- bottom sheets ---------- */
  const JOB_KINDS = ["Driving — school run", "Driving — private hire", "Driving — scheduled route", "Workshop", "Yard & cleaning", "Training", "Office"];
  function sheet() {
    const wrap = (title, body) => `<div class="overlay" onclick="if(event.target===this)A.sheet(null)"><div class="sheet2"><div class="grab"></div><h2 style="font-size:20px;margin-bottom:14px">${title}</h2>${body}</div></div>`;
    if (ui.sheet === "planpick") { const tray = S.jobs.filter(j => j.status !== "Complete" && !j.plan); return wrap("Add to Schedule", tray.length ? `<div class="xs muted" style="margin-bottom:10px">Pick a job card to put on the planner.</div><div class="card list">${tray.map(j => { const v = X.veh(j.vehicleId); return `<button class="li" style="width:100%;border:0;background:none;text-align:left" onclick="A.sheet('plan:${j.id}')"><span class="jtag ${v.external ? "ext" : ""}">${esc(v.external ? v.reg : v.fleet)}</span><div class="grow"><div class="t ellipsis" style="font-size:14px">${esc(j.title)}</div><div class="m">#${esc(j.id)} · ${esc(j.status)}${j.mechId ? " · " + esc(X.pname(j.mechId).split(" ")[0]) : ""}</div></div><span class="chev">${I("chev", 16)}</span></button>`; }).join("")}</div>` : `<div class="card pad small">Every open job card is already on the schedule.</div>`); }
    if (String(ui.sheet).startsWith("plan:")) {
      const j = job(ui.sheet.slice(5)), v = X.veh(j.vehicleId), def = j.plan ? j.plan.date : (ui.sDay && ui.sDay >= today() ? ui.sDay : today());
      return wrap(j.plan ? "Amend Schedule" : "Add to Schedule", `<div class="card pad" style="margin-bottom:12px"><div class="row" style="gap:8px"><span class="jtag ${v.external ? "ext" : ""}">${esc(v.external ? v.reg : v.fleet)}</span><b>#${esc(j.id)}</b></div><div style="font-weight:700;margin-top:6px">${esc(j.title)}</div></div>
        <div class="stack"><div class="row" style="gap:10px;align-items:flex-end"><div class="grow"><label class="f">Day *</label><input type="date" class="in dk" id="pl-date" value="${def}"></div><div style="width:110px"><label class="f">Est. hours *</label><input type="number" class="in dk" id="pl-hrs" step="0.5" min="0.5" inputmode="decimal" value="${j.plan ? j.plan.hours : 2}"></div></div>
          <div><label class="f">Mechanic</label><select class="in dk" id="pl-mech"><option value="">Unassigned</option>${S.staff.filter(x => x.role === "mechanic").map(m => `<option value="${m.id}" ${m.id === (j.mechId || (j.plan ? "" : me.role === "mechanic" ? me.id : "")) ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></div></div>
        <div class="row" style="margin-top:16px"><button class="btn lg grow" onclick="A.sheet(null)">Cancel</button><button class="btn lg brand grow" onclick="A.savePlan('${j.id}')">${j.plan ? "Save changes" : "Add to Schedule"}</button></div>
        ${j.plan ? `<button class="btn block" style="margin-top:10px;color:var(--red)" onclick="A.unplan('${j.id}')">Remove from schedule</button>` : ""}`);
    }
    if (String(ui.sheet).startsWith("stk:")) {
      const pt = X.stockItem(ui.sheet.slice(4)), l = X.loc(pt.loc);
      return wrap("Book In / Adjust Stock", `<div class="card pad" style="margin-bottom:12px"><div class="row"><div class="grow"><div style="font-weight:800">${esc(pt.desc)}</div><div class="xs muted">${esc(pt.partNo)} · ${I("pin", 12)} ${esc(l ? l.name : "")} ${esc(pt.bin || "")}</div></div><div class="stkq ${pt.qty <= 0 ? "out" : M.lowStock(pt) ? "low" : ""}"><b>${pt.qty}</b><span>on hand</span></div></div></div>
        <div class="stack"><div><label class="f">How many? (use − to take stock out)</label><div class="row" style="gap:8px"><input type="number" class="in dk" id="adj-qty" step="1" inputmode="numeric" placeholder="e.g. 10" style="flex:1">${[1, 5, 10].map(n => `<button class="btn sm" onclick="const e=document.getElementById('adj-qty');e.value=(Number(e.value)||0)+${n}">+${n}</button>`).join("")}</div></div>
          <div><label class="f">Reason</label><select class="in dk" id="adj-why">${["Delivery received", "Stock count correction", "Used — not on a job card", "Damaged / returned to supplier"].map(r => `<option>${r}</option>`).join("")}</select></div>
          <div class="row" style="gap:10px"><div class="grow"><label class="f">Stock place</label><select class="in dk" id="adj-loc">${X.locations().map(x => `<option value="${x.id}" ${x.id === pt.loc ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div><div style="width:120px"><label class="f">Shelf / bin</label><input class="in dk" id="adj-bin" value="${esc(pt.bin || "")}"></div></div></div>
        <div class="row" style="margin-top:16px"><button class="btn lg grow" onclick="A.sheet(null)">Cancel</button><button class="btn lg brand grow" onclick="A.saveAdj('${pt.id}')">Save</button></div>`);
    }
    if (ui.sheet === "newpart") return wrap("Add New Part", `<div class="stack"><div class="row" style="gap:10px"><div class="grow"><label class="f">Part no. *</label><input class="in dk" id="np-no"></div><div class="grow"><label class="f">Category</label><input class="in dk" id="np-cat" placeholder="e.g. Brakes"></div></div>
        <div><label class="f">Description *</label><input class="in dk" id="np-desc" placeholder="e.g. Brake pad set, rear"></div>
        <div class="row" style="gap:10px"><div class="grow"><label class="f">Stock place *</label><select class="in dk" id="np-loc">${X.locations().map(x => `<option value="${x.id}" ${x.id === ui.sLoc ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div><div style="width:120px"><label class="f">Shelf / bin</label><input class="in dk" id="np-bin"></div></div>
        <div class="row" style="gap:10px"><div class="grow"><label class="f">Qty in</label><input type="number" class="in dk" id="np-qty" value="1" inputmode="numeric"></div><div class="grow"><label class="f">Reorder at</label><input type="number" class="in dk" id="np-min" value="1" inputmode="numeric"></div><div class="grow"><label class="f">Cost € each</label><input type="number" class="in dk" id="np-cost" step="0.01" inputmode="decimal"></div></div>
        <div><label class="f">Supplier</label><input class="in dk" id="np-sup"></div></div>
      <div class="row" style="margin-top:16px"><button class="btn lg grow" onclick="A.sheet(null)">Cancel</button><button class="btn lg brand grow" onclick="A.saveNewPart()">Add Part</button></div>`);
    if (ui.sheet === "alerts") { const att = attention(); return wrap("Needs attention", att.length ? `<div class="card list">${att.slice(0, 8).map(j => { const v = X.veh(j.vehicleId); return `<a class="li" href="#/job/${j.id}">${vTag(v)}<div class="grow"><div class="t ellipsis">${esc(j.title)}</div><div class="m">#${esc(j.id)} · ${fmtDT(j.created)}</div></div>${j.priority === "VOR" ? pill("red", "Off road") : pill("amber", "Unassigned")}</a>`; }).join("")}</div>` : `<div class="card pad small">Nothing urgent — no vehicles off road and every job is assigned.</div>`); }
    if (ui.sheet === "clockout") { const c = me.clock || {}, v = c.vehicleId && X.veh(c.vehicleId); return wrap("Clock Out", `<div class="card pad"><div class="kvl"><div><span>Working on</span><b>${esc(c.type || "—")}</b></div><div><span>Vehicle</span><b>${v ? esc(v.fleet + " · " + v.reg) : "—"}</b></div><div><span>Clocked in</span><b>${c.at ? fmtT(c.at) : "—"}</b></div><div><span>Time today</span><b>${c.at ? `<span data-since="${c.at}">${clockText((Date.now() - c.at) / 1000)}</span>` : "—"}</b></div></div></div>
      <div class="row" style="margin-top:14px"><button class="btn lg grow" onclick="A.sheet(null)">Cancel</button><button class="btn lg dark grow" onclick="A.clockOut()">Clock Out</button></div>`); }
    if (ui.sheet === "switch") { const c = me.clock || {}; return wrap("Update Timesheet", `<div class="stack"><div><label class="f">Job type *</label><select class="in dk" id="sw-type">${JOB_KINDS.map(k => `<option ${k === (c.type || (me.role === "mechanic" ? "Workshop" : "")) ? "selected" : ""}>${k}</option>`).join("")}</select></div>
      <div><label class="f">Vehicle</label><select class="in dk" id="sw-veh"><option value="">No vehicle</option>${S.vehicles.map(v => `<option value="${v.id}" ${v.id === c.vehicleId ? "selected" : ""}>${esc(v.fleet)} · ${esc(v.reg)}</option>`).join("")}</select></div>
      <div class="xs muted">${me.clock ? "Ends your current entry now and starts a new one." : "You're not clocked in — this clocks you in."}</div></div>
      <div class="row" style="margin-top:14px"><button class="btn lg grow" onclick="A.sheet(null)">Cancel</button><button class="btn lg brand grow" onclick="A.switchJob()">Submit</button></div>`); }
    if (ui.sheet === "sig") return wrap("Signature", `<div class="small muted" style="margin-bottom:10px">I confirm I have carried out this walk-around check${draft ? ` on <b style="color:var(--ink)">${esc(X.veh(draft.vehicleId).reg)}</b>` : ""} and the results are accurate.</div>
      <div class="sigwrap"><canvas data-sig="draft"></canvas><div class="ph">Sign with your finger</div><button class="btn sm soft clr" onclick="A.clearSig('draft')">Clear</button></div>
      <button class="btn lg brand block" style="margin-top:14px" onclick="A.sheet(null)">Done</button>`);
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
  function nextBtnState() { /* the one-page checklist validates on Submit */ }
  const persist = () => lsSet(LS.draft, draft);

  window.A = {
    login() {
      const p = X.person($("#luser").value), pin = $("#lpin").value, err = $("#lerr");
      if (!p) { err.textContent = "Select your name"; return; }
      if (pin !== p.pin) { err.textContent = "Wrong PIN — try again"; $("#lpin").value = ""; $("#lpin").focus(); return; }
      me = p; lsSet(LS.me, p.id); go("#/"); render();
    },
    clockIn() {
      me.clock = { at: Date.now(), type: me.role === "mechanic" ? "Workshop" : "Driving — scheduled route", vehicleId: null };
      save(); keep(render); toast("Clocked in at " + fmtT(me.clock.at));
    },
    clockOut() {
      const c = me.clock; if (!c) return;
      me.shifts = [{ start: c.at, end: Date.now(), type: c.type, vehicleId: c.vehicleId }].concat(me.shifts || []).slice(0, 60);
      me.clock = null; ui.sheet = null; save(); keep(render); toast("Clocked out · " + mins((Date.now() - c.at) / 60000) + " today");
    },
    switchJob() {
      const type = $("#sw-type").value, vehicleId = $("#sw-veh").value || null, now = Date.now();
      if (me.clock) me.shifts = [{ start: me.clock.at, end: now, type: me.clock.type, vehicleId: me.clock.vehicleId }].concat(me.shifts || []).slice(0, 60);
      me.clock = { at: now, type, vehicleId }; ui.sheet = null; save(); keep(render); toast("Timesheet updated · " + type);
    },
    async certFile(k, input) { const r = await upload(input); if (r) { me.docs = Object.assign({}, me.docs, { [k]: Object.assign({}, (me.docs || {})[k], { file: { id: r.id, name: r.name } }) }); save(); keep(render); } },
    certExp(k, v) { me.docs = Object.assign({}, me.docs, { [k]: Object.assign({}, (me.docs || {})[k], { exp: v }) }); save(); keep(render); toast("Expiry date saved"); },
    pickVeh(vid) {
      if (draft && Object.keys(draft.results).some(k => !draft.results[k].auto) && vid !== draft.vehicleId && !confirm("Start again on the other vehicle? Answers so far will be cleared.")) return keep(render);
      if (vid) startDraft(vid); else { draft = null; lsSet(LS.draft, null); }
      keep(render);
    },
    cycle(k) {
      const it = M.sectionsFor(X.veh(draft.vehicleId)).flatMap(s => s.items).find(x => x.key === k), r = draft.results[k] || {};
      const order = ["", "ok", "def"].concat(it && it.na ? ["na"] : []);
      const next = order[(order.indexOf(r.s || "") + 1) % order.length];
      if (!next) delete draft.results[k]; else return A.mark(k, next);
      persist(); keep(render);
    },
    allOkAll() {
      M.sectionsFor(X.veh(draft.vehicleId)).forEach(s => s.items.forEach(it => { const r = draft.results[it.key]; if (!r) draft.results[it.key] = { s: "ok" }; }));
      persist(); keep(render); toast("All items ticked — untick anything you found faulty");
    },
    nil() {
      const defs = Object.keys(draft.results).filter(k => draft.results[k].s === "def");
      if (defs.length && !confirm("Clear the " + defs.length + " defect" + (defs.length > 1 ? "s" : "") + " you've recorded and mark NIL defects?")) return;
      M.sectionsFor(X.veh(draft.vehicleId)).forEach(s => s.items.forEach(it => { const r = draft.results[it.key]; if (!r || r.s !== "na") draft.results[it.key] = { s: "ok" }; }));
      persist(); keep(render);
    },
    hsearch(v) { ui.hq = v; render(); const e = $("#hsearch"); e.focus(); e.setSelectionRange(v.length, v.length); },
    jwho(k) { ui.jobsWho = k; render(); },
    // schedule
    sweek(n) { ui.sWeek = n === 0 ? null : M.addDaysIso(ui.sWeek || M.weekStart(today()), n * 7); ui.sDay = n === 0 ? null : ui.sWeek; render(); },
    sday(d) { ui.sDay = d; keep(render); },
    swho(k) { ui.sWho = k; keep(render); },
    savePlan(id) {
      const j = job(id), date = $("#pl-date").value, hours = Math.max(0.5, Number($("#pl-hrs").value) || 0);
      if (!date) return toast("Pick a day");
      if (!Number($("#pl-hrs").value)) return toast("Enter the estimated hours");
      const was = j.plan;
      j.plan = { date, hours }; j.mechId = $("#pl-mech").value || null;
      ui.sheet = null; ui.sDay = date; ui.sWeek = M.weekStart(date) === M.weekStart(today()) ? null : M.weekStart(date);
      save(); keep(render); toast((was ? "Moved to " : "Added for ") + fmtDay(date) + (j.mechId ? " · " + X.pname(j.mechId).split(" ")[0] : ""));
    },
    unplan(id) { delete job(id).plan; ui.sheet = null; save(); keep(render); toast("Taken off the schedule"); },
    // stock
    ssearch(v) { ui.sq = v; render(); const e = $("#ssearch"); e.focus(); e.setSelectionRange(v.length, v.length); },
    sloc(id) { ui.sLoc = id; keep(render); },
    slow() { ui.sLow = !ui.sLow; keep(render); },
    saveAdj(id) {
      const pt = X.stockItem(id), n = Number($("#adj-qty").value) || 0, loc = $("#adj-loc").value, bin = $("#adj-bin").value.trim();
      const moved = loc !== pt.loc || bin !== (pt.bin || "");
      if (!n && !moved) return toast("Enter how many");
      if (n) { pt.qty = Math.round((pt.qty + n) * 100) / 100; X.moves().unshift({ at: Date.now(), stockId: pt.id, qty: n, by: me.id, why: $("#adj-why").value }); }
      if (moved) { const from = X.loc(pt.loc); pt.loc = loc; pt.bin = bin; X.moves().unshift({ at: Date.now(), stockId: pt.id, qty: 0, by: me.id, why: from && from.id === loc ? "Moved to shelf " + (bin || "—") + " in " + from.name : "Moved from " + (from ? from.name : "?") + " to " + X.loc(loc).name + (bin ? " · " + bin : "") }); }
      S.settings.moves = X.moves().slice(0, 300);
      ui.sheet = null; save(); keep(render); toast(pt.partNo + " · " + pt.qty + " on hand");
    },
    saveNewPart() {
      const partNo = $("#np-no").value.trim().toUpperCase(), desc = $("#np-desc").value.trim();
      if (!partNo || !desc) return toast("Part no. and description are needed");
      if (X.stock().some(x => x.partNo === partNo)) return toast(partNo + " is already in stock — use Book In");
      const pt = { id: "st" + Date.now().toString(36), partNo, desc, cat: $("#np-cat").value.trim(), loc: $("#np-loc").value, bin: $("#np-bin").value.trim(), qty: Number($("#np-qty").value) || 0, min: Number($("#np-min").value) || 0, cost: Number($("#np-cost").value) || 0, supplier: $("#np-sup").value.trim() };
      X.stock().push(pt);
      if (pt.qty) X.moves().unshift({ at: Date.now(), stockId: pt.id, qty: pt.qty, by: me.id, why: "New part added" });
      ui.sheet = null; ui.sq = ""; ui.sLoc = pt.loc; save(); keep(render); toast(desc + " added to stock");
    },
    logout() { me = null; ui.sheet = null; lsSet(LS.me, null); go("#/"); render(); },
    sheet(s) { ui.sheet = s; keep(render); sbTone(); if (s === "part") setTimeout(() => { const e = $("#p-desc"); if (e) e.focus(); }, 50); },

    search(v) { ui.q = v; render(); const e = $("#vsearch"); e.focus(); e.setSelectionRange(v.length, v.length); },
    odo(val) {
      draft.odo = val.replace(/\D/g, ""); persist();
      const v = X.veh(draft.vehicleId), ok = draft.odo && Number(draft.odo) >= v.odo;
      $("#odoerr").textContent = draft.odo && !ok ? "Lower than the last reading (" + km(v.odo) + ")" : "";
    },
    remarks(val) { draft.remarks = val; persist(); },
    step(i) { draft.step = i; persist(); render(); toTop(); },
    cancel() { if (draft && Object.keys(draft.results).filter(k => !draft.results[k].auto).length > 3 && !confirm("Discard this check?")) return; draft = null; lsSet(LS.draft, null); go("#/"); },
    mark(k, s) {
      const r = draft.results[k] || {};
      draft.results[k] = s === "def" ? Object.assign({ sev: "minor", photos: [] }, r, { s, auto: 0 }) : { s };
      persist(); keep(render);
      if (s === "def") { const ta = document.querySelector("#it-" + k + " + .defbox textarea"); if (ta) ta.focus({ preventScroll: true }); }
    },
    allOk(si) {
      const s = M.sectionsFor(X.veh(draft.vehicleId))[si];
      s.items.forEach(it => { const r = draft.results[it.key]; if (!r || (r.s !== "def" && !(r.s === "na"))) draft.results[it.key] = { s: "ok" }; });
      persist(); keep(render); toast("Marked OK — check anything you found faulty");
    },
    note(k, val) { draft.results[k].note = val; persist(); const rn = document.querySelector("#it-" + k + " .rn"); if (rn) { rn.textContent = val || "Add remark"; rn.classList.toggle("need", !val); } },
    sev(k, s) { draft.results[k].sev = s; persist(); keep(render); },
    async itemPhoto(k, input) { const r = await upload(input); if (r) { draft.results[k].photos = (draft.results[k].photos || []).concat(r.id); persist(); keep(render); } },
    async chkPhoto(input) { const r = await upload(input); if (r && draft.photos.length < 6) { draft.photos.push(r.id); persist(); keep(render); } },
    rmPhoto(i) { draft.photos.splice(i, 1); persist(); keep(render); },
    clearSig(k) { if (k === "draft") { draft.sig = null; persist(); } else delete sigs[k]; keep(render); },
    submit() {
      if (!draft) return toast("Select the vehicle first");
      const v = X.veh(draft.vehicleId), secs = M.sectionsFor(v);
      if (!draft.odo || Number(draft.odo) < v.odo) { toast("Enter the odometer reading"); const o = $("#odo"); if (o) o.focus(); return; }
      const missing = secs.flatMap(s => s.items).filter(it => !itemDone(draft.results[it.key]));
      if (missing.length) { toast(missing.length + " item" + (missing.length > 1 ? "s" : "") + " still to check" + (missing.some(it => (draft.results[it.key] || {}).s === "def") ? " — defects need a remark" : "")); const e = document.getElementById("it-" + missing[0].key); if (e) e.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
      if (!draft.sig) { toast("Add your signature"); return A.sheet("sig"); }
      const at = Date.now();
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
    const busy = () => { const a = document.activeElement, r = route(); return (r.name === "check" && r.parts[1] === "new") || r.name === "profile" || ui.sheet || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) || Object.keys(sigs).length > 0; };
    Store.poll(busy, s => { S = s; X = M.api(S); keep(render); });
  })();
})();
