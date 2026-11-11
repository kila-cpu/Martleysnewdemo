// Martley's desktop admin for the transport office: fleet overview, the
// walk-around check register, defects, job cards, fleet, team and settings.
// Same data as the phone app (store.js); edits sync both ways within seconds.
(function () {
  "use strict";
  const { I, esc, fmtD, fmtDay, fmtT, fmtDT, isoOf, today, addDaysIso, km, eur, mins, hrs, initials, pill, prioPill, statusPill, duePill, toast, lsGet, lsSet } = M;

  let S = null, X = null, me = null;
  const ui = {
    cFrom: "", cTo: "", cVeh: "", cDrv: "", cRes: "", q: "", sort: { k: "date", dir: -1 }, page: 1, per: 10,   // checks register
    defTab: "open", jobTab: "active", jq: "", fleetType: "All", jobWho: "all",
    schedWeek: M.weekStart(M.today()), custQ: "", partQ: "", partLoc: "", partLow: false,
    modal: null,
  };
  const sigs = {};
  let form = {};   // scratch values for whichever modal is open
  const $ = s => document.querySelector(s);
  const save = () => Store.sync(S);
  const avc = p => "av " + (p && p.role === "mechanic" ? "mech" : p && p.role === "admin" ? "adm" : "");
  const vTag = (v, lg) => `<span class="fleetno ${lg ? "lg" : ""} ${v.external ? "ext" : ""}" ${v.external ? `title="${esc(v.customerName)}"` : ""}>${esc(v.fleet)}</span>`;
  const roleOf = p => p.title || M.ROLE[p.role];
  function keep(fn) { const y = window.scrollY; fn(); window.scrollTo(0, y); }

  /* ---------- routing ---------- */
  function route() {
    const [path, qs] = location.hash.replace(/^#\/?/, "").split("?");
    const parts = path.split("/").filter(Boolean);
    return { parts, name: parts[0] || "", q: Object.fromEntries(new URLSearchParams(qs || "")) };
  }
  const go = h => { location.hash = h; };
  window.addEventListener("hashchange", () => { ui.modal = null; render(); window.scrollTo(0, 0); });

  function render() {
    const app = $("#app");
    if (!S) { app.innerHTML = `<div class="empty" style="padding-top:40vh">Loading…</div>`; return; }
    me = me && X.person(me.id);
    if (!me) { app.innerHTML = login(); const f = $(".pinin input"); if (f) f.focus(); return; }
    const r = route();
    document.body.classList.toggle("tvmode", r.name === "screen");
    if (r.name === "screen") { try { app.innerHTML = screenPage(); } catch (e) { console.error(e); app.innerHTML = `<div class="empty">Couldn't show the workshop screen. <a href="#/schedule">Back</a></div>`; } tick(); return; }
    let body;
    try { body = view(r); } catch (e) { console.error(e); body = `<div class="card pad">Something went wrong showing this page. <a href="#/">Back to overview</a></div>`; }
    app.innerHTML = side(r) + `<main><div class="wrap">${body}</div></main>` + (ui.modal ? modal() : "");
    // animate the modal only on the render that opens it
    if (ui.modal) ui.modal.fresh = 0;
    document.querySelectorAll("canvas[data-sig]").forEach(cv => M.sigPad(cv, sigs[cv.dataset.sig], url => { sigs[cv.dataset.sig] = url; }));
    tick();
  }
  setInterval(tick, 1000);
  function tick() { document.querySelectorAll("[data-since]").forEach(el => { el.textContent = mins((Date.now() - Number(el.dataset.since)) / 60000 + Number(el.dataset.base || 0)); }); }

  function view(r) {
    switch (r.name) {
      case "": return overview();
      case "checks": return checksPage();
      case "check": return sheetPage(r.parts[1], r.q);
      case "defects": return defectsPage();
      case "jobs": return jobsPage();
      case "job": return jobPage(r.parts[1]);
      case "schedule": return schedulePage();
      case "parts": return partsPage();
      case "customers": return customersPage();
      case "customer": return customerPage(r.parts[1]);
      case "fleet": return fleetPage();
      case "vehicle": return vehiclePage(r.parts[1]);
      case "team": return teamPage();
      case "settings": return settingsPage();
      default: return `<div class="empty">Page not found. <a href="#/">Overview</a></div>`;
    }
  }

  function side(r) {
    const openJobs = S.jobs.filter(j => j.status !== "Complete").length;
    const vor = S.vehicles.filter(X.vorJob).length;
    const openDefs = defectRows().filter(d => !d.fixed).length;
    const cur = { job: "jobs", vehicle: "fleet", check: "checks", customer: "customers" }[r.name] || r.name;
    const link = (h, ic, l, n, red) => `<a href="#/${h}" class="${cur === h ? "on" : ""}">${I(ic, 18)}<span>${l}</span>${n ? `<span class="n ${red ? "red" : ""}">${n}</span>` : ""}</a>`;
    const low = X.stock().filter(M.lowStock).length, todayN = S.jobs.filter(j => j.plan && j.plan.date === today() && j.status !== "Complete").length;
    return `<aside class="side"><div class="brand"><img src="../logo.png" alt="Martley's"><div>Fleet admin</div></div>
      <nav>${link("", "dash", "Overview")}
        <div class="grp">Compliance</div>${link("checks", "clip", "Walk-around checks")}${link("defects", "alert", "Defects", openDefs, openDefs > 0)}
        <div class="grp">Workshop</div>${link("schedule", "calendar", "Schedule", todayN ? todayN + " today" : "")}${link("jobs", "wrench", "Job cards", openJobs)}${link("parts", "box", "Parts &amp; stock", low ? low + " low" : "", low > 0)}${link("customers", "folder", "Customers")}${link("fleet", "bus", "Fleet", vor ? vor + " VOR" : "", vor > 0)}
        <div class="grp">Admin</div>${link("team", "users", "Team")}${link("settings", "cog", "Settings")}</nav>
      <a class="phone" href="../" target="_blank">${I("phone", 16)} Open mobile app ${I("external", 13)}</a>
      <div class="foot"><span class="${avc(me)}">${initials(me.name)}</span><div><div style="font-weight:700">${esc(me.name)}</div><div class="xs" style="color:#aab4c3">${esc(roleOf(me))}</div></div><button class="ic" title="Sign out" onclick="A.logout()">${I("out", 18)}</button></div></aside>`;
  }

  /* ---------- login ---------- */
  function login() {
    const admins = S.staff.filter(s => s.role === "admin");
    return `<div class="login"><div class="l"><img src="../logo.png" alt="Martley's"><h1>Fleet checks &amp; workshop admin</h1><p>See every walk-around check, defect and job card across the Martley's fleet as it happens.</p>
        <ul><li>${I("check", 18, 2.6)} Daily walk-around check register</li><li>${I("check", 18, 2.6)} Defects flow straight to the workshop</li><li>${I("check", 18, 2.6)} Job cards with labour, parts and sign-off</li><li>${I("check", 18, 2.6)} CVRT and service due dates in one place</li></ul></div>
      <div class="r"><div class="box"><h2 style="font-size:22px">Sign in</h2><p class="muted" style="margin-top:4px">Transport office &amp; workshop</p>
        <label class="f" style="margin-top:22px">Who's signing in?</label><select class="in" id="who">${admins.map(a => `<option value="${a.id}">${esc(a.name)}${a.title ? " — " + esc(a.title) : ""}</option>`).join("")}</select>
        <label class="f" style="margin-top:16px">PIN</label><div class="pinin"><input type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••" oninput="A.pinIn(this)"></div>
        <div class="xs muted">Demo PIN 3333</div><div id="pinerr" class="small" style="color:var(--red);margin-top:8px"></div>
        <div class="notice blue" style="margin-top:28px">${I("phone")}<div>Mechanics and drivers use the <a href="../" style="font-weight:700;text-decoration:underline">mobile app</a>.</div></div></div></div></div>`;
  }

  /* ---------- overview ---------- */
  function overview() {
    const t = today(), tc = X.checksOn(t);
    const vorV = S.vehicles.filter(X.vorJob), inService = S.vehicles.length - vorV.length;
    const notDone = S.vehicles.filter(v => !X.vorJob(v) && !tc.some(c => c.vehicleId === v.id));
    const open = S.jobs.filter(j => j.status !== "Complete");
    const defs = defectRows(), openDefs = defs.filter(d => !d.fixed);
    const spend = S.jobs.filter(j => j.status === "Complete" && j.closedAt > Date.now() - 30 * 864e5).reduce((a, j) => a + M.jobTotal(j), 0);
    const due = [];
    S.vehicles.forEach(v => [["CVRT", v.cvrtDue], ["Service", v.serviceDue]].forEach(([k, d]) => { if (M.daysUntil(d) <= 30) due.push({ v, k, d }); }));
    due.sort((a, b) => a.d.localeCompare(b.d));
    const days = Array.from({ length: 14 }, (_, i) => addDaysIso(t, i - 13));
    const counts = days.map(d => { const cs = X.checksOn(d); return { d, n: cs.length, def: cs.filter(c => M.defectsOf(c).length).length }; });
    const max = Math.max(S.vehicles.length, ...counts.map(c => c.n));
    const byStatus = M.STATUSES.slice(0, 3).map(s => [s, open.filter(j => j.status === s).length]);
    const colors = { Open: "var(--char)", "In progress": "var(--blue)", "Awaiting parts": "#f79009" };
    const pct = Math.round(tc.length / Math.max(1, inService) * 100);
    return `<div class="head"><div class="grow"><h1>Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, ${esc(me.name.split(" ")[0])}</h1><div class="sub">${M.DOW[new Date().getDay()]} ${fmtD(t)} · Kilminchy depot, Portlaoise</div></div>
        <button class="btn" onclick="A.newJob()">${I("plus", 16)} New job card</button><a class="btn pri" href="#/checks">${I("clip", 16)} Check register</a></div>
      <div class="grid g5">
        <a class="card kpi ${pct >= 100 ? "green" : ""}" href="#/checks"><div class="l"><span class="i">${I("clip", 16)}</span>Checks today</div><div class="n">${tc.length}<small> / ${inService}</small></div><div class="meter"><i style="width:${Math.min(100, pct)}%"></i></div><div class="s">${notDone.length ? notDone.length + " vehicles still to check" : "Every vehicle in service checked"}</div></a>
        <a class="card kpi ${openDefs.length ? "amber" : "green"}" href="#/defects"><div class="l"><span class="i">${I("alert", 16)}</span>Open defects</div><div class="n">${openDefs.length}</div><div class="s">${tc.reduce((a, c) => a + M.defectsOf(c).length, 0)} reported today</div></a>
        <a class="card kpi ${vorV.length ? "red" : "green"}" href="#/fleet"><div class="l"><span class="i">${I("bus", 16)}</span>Vehicles off road</div><div class="n">${vorV.length}</div><div class="s">${vorV.length ? vorV.map(v => v.fleet).join(", ") : "Whole fleet available"}</div></a>
        <a class="card kpi" href="#/jobs"><div class="l"><span class="i">${I("wrench", 16)}</span>Open job cards</div><div class="n">${open.length}</div><div class="s">${open.filter(j => !j.mechId).length} unassigned · ${open.filter(j => j.status === "Awaiting parts").length} awaiting parts</div></a>
        <div class="card kpi"><div class="l"><span class="i">${I("euro", 16)}</span>Workshop spend</div><div class="n" style="font-size:24px">${eur(spend)}</div><div class="s">Jobs closed in the last 30 days</div></div>
      </div>
      ${vorV.length ? `<div class="card" style="margin-top:16px;border-color:#fecdca"><div class="ch"><span style="color:var(--red)">${I("alert", 18)}</span><h2 style="color:var(--red)">Off the road</h2></div><div class="list">${vorV.map(v => { const j = X.vorJob(v); return `<a class="li" href="#/job/${j.id}">${vTag(v)}<div class="grow"><div class="t">${esc(j.title)}</div><div class="m">${esc(v.reg)} · Job #${esc(j.id)} · raised ${fmtDT(j.created)} · ${j.mechId ? esc(X.pname(j.mechId)) : "Unassigned"}</div></div>${statusPill(j.status)}<span class="muted">${I("chev", 16)}</span></a>`; }).join("")}</div></div>` : ""}
      <div class="grid g21" style="margin-top:16px;align-items:start">
        <div class="stack">
          <div class="card"><div class="ch"><h2>Checks &amp; defects — last 14 days</h2><div class="legend right" style="margin:0"><span><i class="dot" style="background:#a6e9c1"></i>Checks</span><span><i class="dot red"></i>With defects</span></div></div>
            <div class="cb"><div class="bars">${counts.map(c => `<div class="b" title="${fmtDay(c.d)}: ${c.n} checks, ${c.def} with defects"><span class="v">${c.n}</span><div class="col" style="height:${Math.max(3, c.n / max * 100)}%"><i style="height:${c.n ? c.def / c.n * 100 : 0}%"></i></div><span>${c.d === t ? "Today" : M.DOW[new Date(c.d + "T12:00").getDay()].slice(0, 2) + " " + Number(c.d.slice(8))}</span></div>`).join("")}</div></div></div>
          <div class="card"><div class="ch"><h2>Today's checks</h2><a class="right btn sm ghost" href="#/checks?range=0">View all ${I("chev", 14)}</a></div>
            ${tc.length ? `<div class="tscroll"><table class="t"><thead><tr><th>Time</th><th>Vehicle</th><th>Driver</th><th class="num">Odometer</th><th>Result</th></tr></thead><tbody>${tc.sort((a, b) => b.at - a.at).slice(0, 8).map(c => { const v = X.veh(c.vehicleId), o = M.outcome(c); return `<tr class="click" onclick="A.openCheck('${c.id}')"><td class="mono">${fmtT(c.at)}</td><td><div class="row">${vTag(v)}<span class="reg">${esc(v.reg)}</span></div></td><td>${esc(X.pname(c.driverId))}</td><td class="num">${km(c.odo)}</td><td>${pill(o.cls, o.label)}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty">No checks submitted yet today.</div>`}</div>
        </div>
        <div class="stack">
          <div class="card"><div class="ch"><h2>Not checked yet</h2><span class="right">${pill(notDone.length ? "amber" : "green", notDone.length)}</span></div>${notDone.length ? `<div class="list">${notDone.map(v => `<a class="li" href="#/vehicle/${v.id}">${vTag(v)}<div class="grow"><div class="t">${esc(v.reg)}</div><div class="m">${esc(v.type)}</div></div><span class="muted xs">Last checked ${lastCheck(v)}</span></a>`).join("")}</div>` : `<div class="empty">All vehicles in service checked today.</div>`}</div>
          ${todayWorkshopCard()}
          <div class="card"><div class="ch"><h2>Workshop</h2><a class="right btn sm ghost" href="#/jobs">Job cards ${I("chev", 14)}</a></div><div class="cb">
            <div class="stackbar">${byStatus.map(([s, n]) => n ? `<i style="width:${n / Math.max(1, open.length) * 100}%;background:${colors[s]}"></i>` : "").join("")}</div>
            <div class="legend">${byStatus.map(([s, n]) => `<span><i class="dot" style="background:${colors[s]}"></i>${s} <b style="color:var(--ink)">${n}</b></span>`).join("")}</div></div></div>
          <div class="card"><div class="ch"><h2>CVRT &amp; service due</h2><span class="right xs muted">next 30 days</span></div>${due.length ? `<div class="list">${due.map(x => `<a class="li" href="#/vehicle/${x.v.id}">${vTag(x.v)}<div class="grow"><div class="t">${x.k}</div><div class="m">${fmtD(x.d)}</div></div>${duePill(x.d)}</a>`).join("")}</div>` : `<div class="empty">Nothing due in the next 30 days.</div>`}</div>
        </div>
      </div>`;
  }
  function lastCheck(v) { const c = S.checks.filter(x => x.vehicleId === v.id).sort((a, b) => b.at - a.at)[0]; return c ? fmtDay(isoOf(c.at)).toLowerCase() : "never"; }

  /* ---------- walk-around check register ---------- */
  // Laid out like the client's current "Daily Walk Around Checklist" screen:
  // date range + vehicle filters, sortable table, PDF / images / view-edit-delete per row, paging.
  function filteredChecks() {
    const q = ui.q.toLowerCase();
    const list = S.checks.filter(c => {
      const d = isoOf(c.at);
      if (ui.cFrom && d < ui.cFrom) return false;
      if (ui.cTo && d > ui.cTo) return false;
      if (ui.cVeh && c.vehicleId !== ui.cVeh) return false;
      if (ui.cDrv && c.driverId !== ui.cDrv) return false;
      const o = M.outcome(c).res;
      if (ui.cRes === "ok" && o !== "ok") return false;
      if (ui.cRes === "def" && o === "ok") return false;
      if (q) { const v = X.veh(c.vehicleId); if (!(c.id + " " + v.reg + " " + v.fleet + " " + X.pname(c.driverId) + " " + (c.remarks || "")).toLowerCase().includes(q)) return false; }
      return true;
    });
    const key = {
      date: c => c.at, driver: c => X.pname(c.driverId), reg: c => X.veh(c.vehicleId).reg, svc: c => X.veh(c.vehicleId).serviceDue,
      odo: c => c.odo, remarks: c => c.remarks || "", result: c => ({ ok: 0, warn: 1, bad: 2 })[M.outcome(c).res],
    }[ui.sort.k];
    return list.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : b.at - a.at) * ui.sort.dir; });
  }
  const checkPhotos = c => (c.photos || []).map(p => ({ p, cap: "General" })).concat(M.defectsOf(c).flatMap(([k, r]) => (r.photos || []).map(p => ({ p, cap: M.itemShort(k) }))));

  function checksPage() {
    const r = route(); if (r.q.range !== undefined) { ui.cFrom = r.q.range === "0" ? today() : ""; ui.cTo = ""; history.replaceState(null, "", "#/checks"); }
    const list = filteredChecks(), total = list.length;
    const pages = Math.max(1, Math.ceil(total / ui.per));
    if (ui.page > pages) ui.page = pages;
    const start = (ui.page - 1) * ui.per, rows = list.slice(start, start + ui.per);
    const withDef = list.filter(c => M.defectsOf(c).length).length;
    const th = (k, l, cls = "") => `<th class="sort ${cls} ${ui.sort.k === k ? "on" : ""}" onclick="A.sort('${k}')">${l}<span class="ar">${ui.sort.k === k ? (ui.sort.dir > 0 ? "▲" : "▼") : "⇅"}</span></th>`;
    const filtered = ui.cFrom || ui.cTo || ui.cVeh || ui.cDrv || ui.cRes || ui.q;
    // page buttons: 1 … around current … last
    const nums = [...new Set([1, ui.page - 1, ui.page, ui.page + 1, pages])].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
    const pager = nums.map((n, i) => (i && n - nums[i - 1] > 1 ? `<span class="gap">…</span>` : "") + `<button class="${n === ui.page ? "on" : ""}" onclick="A.page(${n})">${n}</button>`).join("");
    return `<div class="head"><div class="grow"><h1>Daily Walk-Around Checklist</h1><div class="sub">Every vehicle check submitted from the mobile app</div></div>
        <div class="search">${I("search", 16)}<input id="q" placeholder="Search…" value="${esc(ui.q)}" oninput="A.search(this.value)"></div><button class="btn" onclick="A.csv()">${I("upload", 16)} CSV</button></div>
      <div class="card pad filterbar">
        <div><label class="f">From</label><input type="date" class="in" value="${ui.cFrom}" max="${today()}" onchange="A.cf('cFrom',this.value)"></div>
        <div><label class="f">To</label><input type="date" class="in" value="${ui.cTo}" max="${today()}" onchange="A.cf('cTo',this.value)"></div>
        <div><label class="f">Vehicle</label><select class="in" onchange="A.cf('cVeh',this.value)"><option value="">All vehicles</option>${S.vehicles.map(v => `<option value="${v.id}" ${ui.cVeh === v.id ? "selected" : ""}>${esc(v.fleet)} · ${esc(v.reg)}</option>`).join("")}</select></div>
        <div><label class="f">Driver</label><select class="in" onchange="A.cf('cDrv',this.value)"><option value="">All drivers</option>${S.staff.filter(s => s.role !== "admin").map(s => `<option value="${s.id}" ${ui.cDrv === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
        <div><label class="f">Result</label><select class="in" onchange="A.cf('cRes',this.value)"><option value="">Any result</option><option value="ok" ${ui.cRes === "ok" ? "selected" : ""}>Nil defects</option><option value="def" ${ui.cRes === "def" ? "selected" : ""}>With defects</option></select></div>
        <div class="fb-btns"><button class="btn" ${filtered ? "" : "disabled"} onclick="A.clearChecks()">${I("x", 15)} Clear</button></div>
        <div class="fb-stats"><span><b>${total}</b> checks</span><span><i class="dot green"></i><b>${total - withDef}</b> nil defects</span><span><i class="dot amber"></i><b>${withDef}</b> with defects</span></div>
      </div>
      <div class="card" style="margin-top:16px"><div class="tscroll"><table class="t reg"><thead><tr>
          <th class="num" style="width:34px">#</th>${th("date", "Date")}${th("driver", "Driver name")}${th("reg", "Vehicle reg")}${th("svc", "Service due")}${th("odo", "Odometer", "num")}${th("remarks", "General remarks")}${th("result", "Result")}<th class="ctr">Download</th><th class="ctr">Images</th><th class="ctr">Action</th></tr></thead><tbody>
        ${rows.map((c, i) => { const v = X.veh(c.vehicleId), o = M.outcome(c), ph = checkPhotos(c); return `<tr>
          <td class="num muted">${start + i + 1}</td>
          <td><div style="font-weight:700">${fmtD(isoOf(c.at))}</div><div class="xs muted">${fmtT(c.at)}</div></td>
          <td style="font-weight:600">${esc(X.pname(c.driverId))}</td>
          <td><span class="reg">${esc(v.reg)}</span><div class="xs muted" style="margin-top:3px">Fleet ${esc(v.fleet)}</div></td>
          <td><div class="row" style="gap:4px">${duePill(v.serviceDue)}<button class="iconbtn" title="Change service due date" onclick="A.svcModal('${v.id}')">${I("pen", 14)}</button></div></td>
          <td class="num">${km(c.odo)}</td>
          <td class="wrap small">${c.remarks ? esc(c.remarks) : M.defectsOf(c).length ? `<span style="color:var(--amber)">${M.defectsOf(c).map(([k]) => esc(M.itemShort(k))).join(", ")}</span>` : `<span class="muted">—</span>`}</td>
          <td>${pill(o.cls, o.label)}</td>
          <td class="ctr"><button class="pdf" title="Download PDF" onclick="A.pdf('${c.id}')">${I("file", 16)}<span>PDF</span></button></td>
          <td class="ctr">${ph.length ? `<button class="btn sm" onclick="A.imgs('${c.id}')">${I("image", 14)} ${ph.length}</button>` : `<span class="muted">—</span>`}</td>
          <td class="ctr"><div class="acts"><button title="View" onclick="A.openCheck('${c.id}')">${I("eye", 17)}</button><button title="Edit" onclick="A.chkModal('${c.id}')">${I("pen", 16)}</button><button class="del" title="Delete" onclick="A.delCheck('${c.id}')">${I("trash", 16)}</button></div></td></tr>`; }).join("") || `<tr><td colspan="11" class="empty">No checks match these filters.</td></tr>`}
      </tbody></table></div>
      <div class="pagerbar"><span class="muted small">Showing ${total ? start + 1 : 0} to ${Math.min(total, start + ui.per)} of ${total} entries</span>
        <select class="in" style="width:auto;margin-left:12px" onchange="A.per(this.value)">${[10, 25, 50, 100].map(n => `<option ${n === ui.per ? "selected" : ""} value="${n}">${n} per page</option>`).join("")}</select>
        <div class="pager right"><button ${ui.page === 1 ? "disabled" : ""} onclick="A.page(${ui.page - 1})">Previous</button>${pager}<button ${ui.page === pages ? "disabled" : ""} onclick="A.page(${ui.page + 1})">Next</button></div></div></div>`;
  }

  // Printable check sheet, laid out like the client's "Walk-Around Check Sheet" PDF.
  function sheetPage(id, q) {
    const c = S.checks.find(x => x.id === id);
    if (!c) return `<div class="empty">This check doesn't exist any more. <a href="#/checks">Back to checks</a></div>`;
    const v = X.veh(c.vehicleId), o = M.outcome(c), secs = M.sectionsFor(v), ph = checkPhotos(c);
    const res = it => M.resultOf(c, it, v);
    let ok = 0, def = 0, na = 0;
    secs.forEach(s => s.items.forEach(it => { const r = res(it); r.s === "def" ? def++ : r.s === "na" ? na++ : ok++; }));
    if (q.print && !sheetPage.printed) { sheetPage.printed = id; setTimeout(() => print(), 500); }
    const yn = r => r.s === "def" ? `<span class="yn n">${I("x", 13, 3)} No</span>` : r.s === "na" ? `<span class="yn na">N/A</span>` : `<span class="yn y">${I("check", 13, 3)} Yes</span>`;
    return `<div class="row noprint" style="margin-bottom:14px"><a class="crumb" style="margin:0" href="#/checks">${I("left", 14)} Daily checks</a><span class="grow"></span>
        <button class="btn" onclick="A.chkModal('${c.id}')">${I("pen", 15)} Edit</button><button class="btn" style="color:var(--red)" onclick="A.delCheck('${c.id}')">${I("trash", 15)} Delete</button><button class="btn pri" onclick="print()">${I("file", 15)} Download PDF</button></div>
      <div class="sheet">
        <div class="sh-head"><img src="../logo.png" alt="Martley's"><div class="grow"><div class="sh-title">Driver Walk-Around Check Sheet</div><div class="sh-sub">Martley's of Portlaoise · Kilminchy, Dublin Road, Portlaoise, Co. Laois R32 CPA4 · 057 862 0888</div></div><div class="sh-ref"><span>Ref</span>${esc(c.id)}</div></div>
        <div class="sh-info">
          <div class="w2"><span>Vehicle registration number</span><b>${esc(v.reg)}</b><em>${esc(v.fleet)} · ${esc(v.model)} · ${esc(v.type)}</em></div>
          <div><span>Mileage</span><b>${km(c.odo)}</b></div><div><span>Date</span><b>${fmtD(isoOf(c.at))}</b></div><div><span>Time</span><b>${fmtT(c.at)}</b></div>
        </div>
        <div class="sh-result ${o.res}"><div class="ic">${I(o.res === "ok" ? "check" : "alert", 20, 2.6)}</div><div class="grow"><b>${o.res === "ok" ? "Nil defects — vehicle fit for service" : o.res === "bad" ? "Major defect — vehicle taken off the road" : "Minor defects reported — vehicle fit for service"}</b><div class="small">${ok} passed · ${def} defect${def === 1 ? "" : "s"} · ${na} not applicable · completed in ${c.duration || "—"} min</div></div></div>
        <table class="sh-items"><thead><tr><th style="width:46px">ID</th><th>Item</th><th style="width:110px">Checked</th><th style="width:32%">Remark</th></tr></thead><tbody>
          ${secs.map(s => `<tr class="sec"><td colspan="4">${esc(s.name)}</td></tr>` + s.items.map((it, i) => { const r = res(it), j = r.job && S.jobs.find(x => x.id === r.job); return `<tr class="${r.s === "def" ? "bad" : ""}"><td class="muted">${i + 1}</td><td>${esc(it.label)}</td><td>${yn(r)}</td><td>${r.s === "def" ? `${pill(r.sev === "major" ? "red" : "amber", r.sev === "major" ? "Major" : "Minor")} ${esc(r.note || "")}${j ? `<div class="xs" style="margin-top:4px"><a href="#/job/${j.id}" style="font-weight:700;text-decoration:underline">Job #${esc(j.id)}</a> · ${esc(j.status)}</div>` : ""}` : r.s === "na" && it.trailer ? `<span class="muted xs">No trailer</span>` : ""}</td></tr>`; }).join("")).join("")}
        </tbody></table>
        <div class="sh-remarks"><span>General remarks</span>${c.remarks ? esc(c.remarks) : `<em class="muted">None</em>`}</div>
        ${ph.length ? `<div class="sh-photos"><span>Images (${ph.length})</span><div class="photos">${ph.map(x => `<figure><img src="/api/files/${x.p}" onclick="M.lightbox(this.src)" alt=""><figcaption>${esc(x.cap)}</figcaption></figure>`).join("")}</div></div>` : ""}
        <div class="sh-foot"><div><span>Completed by</span><b>${esc(X.pname(c.driverId))}</b><div class="sigbox">${c.sig ? `<img src="${c.sig}" alt="Signature">` : `<div class="sigtxt">${esc(X.pname(c.driverId))}</div>`}</div><em>Signed ${fmtDT(c.at)}</em></div>
          <div class="decl">I confirm I have carried out this walk-around check and that the results recorded are accurate. Any defects found have been reported.</div></div>
      </div>`;
  }

  /* ---------- defects register ---------- */
  // One row per defect, whether it came from a walk-around check or an ad-hoc report.
  function defectRows() {
    const rows = [];
    S.checks.forEach(c => M.defectsOf(c).forEach(([k, r]) => rows.push({ at: c.at, vehicleId: c.vehicleId, item: k, note: r.note, sev: r.sev, by: c.driverId, checkId: c.id, job: r.job && S.jobs.find(j => j.id === r.job), photos: r.photos || [] })));
    S.jobs.filter(j => j.item && !j.checkId).forEach(j => rows.push({ at: j.created, vehicleId: j.vehicleId, item: j.item, note: j.desc, sev: j.sev, by: j.reportedBy, job: j, photos: j.reportPhotos || [], adhoc: 1 }));
    rows.forEach(r => { r.fixed = r.job && r.job.status === "Complete"; });
    return rows.sort((a, b) => b.at - a.at);
  }
  function defectsPage() {
    const all = defectRows(), open = all.filter(d => !d.fixed), fixed = all.filter(d => d.fixed);
    const list = ui.defTab === "open" ? open : ui.defTab === "fixed" ? fixed : all;
    const age = d => Math.floor((Date.now() - d.at) / 864e5);
    return `<div class="head"><div class="grow"><h1>Defects</h1><div class="sub">Defects reported by drivers, from walk-around checks or during the day, and their repair status</div></div></div>
      <div class="grid g2" style="margin-bottom:16px">
        <div class="card kpi ${open.length ? "amber" : "green"}"><div class="l">Outstanding</div><div class="n">${open.length}</div></div>
        <div class="card kpi ${open.filter(d => d.sev === "major").length ? "red" : ""}"><div class="l">Major (vehicle off road)</div><div class="n">${open.filter(d => d.sev === "major").length}</div></div>
        <div class="card kpi green"><div class="l">Rectified (all time)</div><div class="n">${fixed.length}</div></div>
        <div class="card kpi"><div class="l">Avg. time to fix</div><div class="n">${fixed.length ? (fixed.reduce((a, d) => a + (d.job.closedAt - d.at), 0) / fixed.length / 3.6e6).toFixed(1) : "—"}<small> h</small></div></div></div>
      <div class="filters"><div class="seg">${[["open", "Outstanding", open.length], ["fixed", "Rectified", fixed.length], ["all", "All", all.length]].map(([k, l, n]) => `<button class="${ui.defTab === k ? "on" : ""}" onclick="A.set('defTab','${k}')">${l}<span class="c">${n}</span></button>`).join("")}</div></div>
      <div class="card tscroll"><table class="t"><thead><tr><th>Reported</th><th>Vehicle</th><th>Item</th><th>Description</th><th>Severity</th><th>Reported by</th><th>Job card</th><th class="num">${ui.defTab === "fixed" ? "Fixed in" : "Age"}</th></tr></thead><tbody>
        ${list.map(d => { const v = X.veh(d.vehicleId); return `<tr class="click" onclick="${d.job ? `location.hash='#/job/${d.job.id}'` : `A.openCheck('${d.checkId}')`}"><td class="mono" style="white-space:nowrap">${fmtDT(d.at)}</td><td><div class="row">${vTag(v)}<span class="reg">${esc(v.reg)}</span></div></td><td class="small" style="font-weight:700">${esc(M.itemShort(d.item))}</td><td class="small wrap" style="max-width:320px">${esc(d.note)}${d.photos.length ? ` <span class="muted">${I("camera", 13)}</span>` : ""}</td><td>${pill(d.sev === "major" ? "red" : "amber", d.sev === "major" ? "Major" : "Minor")}</td><td class="small">${esc(X.pname(d.by))}${d.adhoc ? `<div class="xs muted">Ad-hoc report</div>` : ""}</td><td>${d.job ? `<div class="row" style="gap:6px"><b class="small">#${esc(d.job.id)}</b>${statusPill(d.job.status)}</div>` : "—"}</td><td class="num small">${d.fixed ? hrs((d.job.closedAt - d.at) / 60000) : age(d) ? age(d) + "d" : "Today"}</td></tr>`; }).join("") || `<tr><td colspan="8" class="empty">Nothing here.</td></tr>`}
      </tbody></table></div>`;
  }

  /* ---------- job cards ---------- */
  function jobsPage() {
    const q = ui.jq.toLowerCase(), prio = { VOR: 0, High: 1, Normal: 2 };
    const match = j => { const v = X.veh(j.vehicleId); return !q || (j.id + " " + j.title + " " + v.fleet + " " + v.reg + " " + j.type + " " + (j.customer || "") + " " + X.pname(j.mechId)).toLowerCase().includes(q); };
    const everyone = S.jobs.filter(match);
    const ext = everyone.filter(M.isExternal);
    const all = ui.jobWho === "ext" ? ext : ui.jobWho === "fleet" ? everyone.filter(j => !M.isExternal(j)) : everyone;
    const tabs = [["active", "Active", all.filter(j => j.status !== "Complete")], ...M.STATUSES.map(s => [s, s, all.filter(j => j.status === s)]), ["all", "All", all]];
    const list = (tabs.find(t => t[0] === ui.jobTab) || tabs[0])[2].slice().sort((a, b) => (a.status === "Complete") - (b.status === "Complete") || prio[a.priority] - prio[b.priority] || b.created - a.created);
    const sum = f => list.reduce((a, j) => a + f(j), 0);
    return `<div class="head"><div class="grow"><h1>Job cards</h1><div class="sub">Workshop jobs — defect repairs, services, CVRT prep and other work</div></div><button class="btn pri" onclick="A.newJob()">${I("plus", 16)} New job card</button></div>
      <div class="filters"><div class="seg">${[["all", "All work", everyone.length], ["fleet", "Martley's fleet", everyone.length - ext.length], ["ext", "Outside customers", ext.length]].map(([k, l, n]) => `<button class="${ui.jobWho === k ? "on" : ""}" onclick="A.set('jobWho','${k}')">${l}<span class="c">${n}</span></button>`).join("")}</div>
        <div class="seg">${tabs.map(([k, l, ls]) => `<button class="${ui.jobTab === k ? "on" : ""}" onclick="A.set('jobTab','${k}')">${l}<span class="c">${ls.length}</span></button>`).join("")}</div><div class="search right">${I("search", 16)}<input id="q" placeholder="Search job no., reg, customer…" value="${esc(ui.jq)}" oninput="A.jsearch(this.value)"></div></div>
      <div class="card tscroll"><table class="t"><thead><tr><th>Job no.</th><th>Raised</th><th>Vehicle</th><th>Job</th><th>Customer</th><th>Planned</th><th>Mechanic</th><th class="num">Hours</th><th class="num">Parts</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>
        ${list.map(j => { const v = X.veh(j.vehicleId), run = (j.labour || []).some(l => !l.end), c = X.custOf(j); return `<tr class="click" onclick="location.hash='#/job/${j.id}'"><td><b>#${esc(j.id)}</b></td><td class="small mono" style="white-space:nowrap">${fmtD(isoOf(j.created))}</td><td><div class="row">${vTag(v)}<span class="reg">${esc(v.reg)}</span></div></td><td style="max-width:280px"><div class="ellipsis" style="font-weight:600">${esc(j.title)}</div><div class="xs muted">${esc(j.type)}</div>${j.status !== "Complete" && j.priority !== "Normal" ? `<div style="margin-top:3px">${prioPill(j.priority)}</div>` : ""}</td><td class="small">${c.internal ? `<span class="muted">Martley's fleet</span>` : `<a href="#/customer/${c.id}" onclick="event.stopPropagation()" style="font-weight:700">${esc(c.name)}</a>`}</td><td class="small" style="white-space:nowrap">${j.plan ? fmtDay(j.plan.date) + `<div class="xs muted">${j.plan.hours}h est.</div>` : j.status === "Complete" ? `<span class="muted">—</span>` : `<span class="muted">Not planned</span>`}</td><td class="small">${j.mechId ? `<div class="row" style="gap:6px"><span class="av mech sm">${initials(X.pname(j.mechId))}</span>${esc(X.pname(j.mechId))}</div>` : `<span style="color:var(--amber);font-weight:700">Unassigned</span>`}</td><td class="num">${run ? `<span class="dot green" title="On the clock"></span> ` : ""}${hrs(M.jobMins(j))}</td><td class="num">${eur(M.jobParts(j))}</td><td class="num"><b>${eur(M.jobTotal(j))}</b></td><td>${statusPill(j.status)}</td></tr>`; }).join("") || `<tr><td colspan="11" class="empty">No job cards here.</td></tr>`}
      </tbody>${list.length ? `<tfoot><tr><td colspan="7">${list.length} job card${list.length > 1 ? "s" : ""}</td><td class="num">${hrs(sum(M.jobMins))}</td><td class="num">${eur(sum(M.jobParts))}</td><td class="num">${eur(sum(M.jobTotal))}</td><td></td></tr></tfoot>` : ""}</table></div>`;
  }

  function jobPage(id) {
    const j = S.jobs.find(x => x.id === id);
    if (!j) return `<div class="empty">Job card not found. <a href="#/jobs">All job cards</a></div>`;
    const v = X.veh(j.vehicleId), done = j.status === "Complete";
    const chk = j.checkId && S.checks.find(c => c.id === j.checkId), def = chk && chk.results[j.item];
    const rphotos = ((def && def.photos) || []).concat(j.reportPhotos || []);
    const mechs = S.staff.filter(s => s.role === "mechanic");
    const dis = done ? "disabled" : "";
    const cust = X.custOf(j), ext = M.isExternal(j);
    const vehCard = ext
      ? `<div class="card pad"><div class="row">${vTag(v, 1)}<div class="grow"><div style="font-weight:800;font-size:16px">${esc(v.model || "Customer vehicle")}</div><div class="muted"><span class="reg">${esc(v.reg)}</span> · ${esc(v.type || "")}</div></div><a class="btn sm noprint" href="#/customer/${cust.id}">${I("folder", 14)} ${esc(cust.name)}</a></div></div>`
      : `<div class="card pad"><a href="#/vehicle/${v.id}" class="row">${vTag(v, 1)}<div class="grow"><div style="font-weight:800;font-size:16px">${esc(v.model)}</div><div class="muted"><span class="reg">${esc(v.reg)}</span> · ${esc(v.type)} · ${km(v.odo)}</div></div><div class="xs muted" style="text-align:right">Service due<br><b style="color:var(--ink);font-size:13px">${esc(j.serviceDue || fmtD(v.serviceDue))}</b></div></a></div>`;
    return `<a class="crumb noprint" href="#/jobs">${I("left", 14)} Job cards</a>
      <div class="print-only"><h2>Martley's of Portlaoise — Vehicle job card</h2><p class="small">Kilminchy, Dublin Road, Portlaoise, Co. Laois · 057 862 0888</p><br></div>
      <div class="head"><div class="grow"><div class="row" style="gap:8px;margin-bottom:8px">${statusPill(j.status)}${!done ? prioPill(j.priority) : ""}${pill("", esc(j.type))}</div><h1>#${esc(j.id)} · ${esc(j.title)}</h1><div class="sub">Raised ${fmtDT(j.created)} by ${esc(X.pname(j.reportedBy))} · ${ext ? `<a href="#/customer/${cust.id}" style="font-weight:700;text-decoration:underline">${esc(cust.name)}</a>` : "Martley's fleet"}</div></div>
        <button class="btn noprint" onclick="print()">${I("print", 16)} Print</button>${done ? `<button class="btn noprint" onclick="A.reopen('${j.id}')">Reopen</button>` : ""}</div>
      ${!done && j.priority === "VOR" ? `<div class="notice red" style="margin-bottom:16px">${I("alert")}<div><b>${esc(v.fleet)} (${esc(v.reg)}) is off the road</b> until this job card is signed off as roadworthy.</div></div>` : ""}
      <div class="grid g21" style="align-items:start">
        <div class="stack">
          ${vehCard}
          ${chk || j.desc ? `<div class="card"><div class="ch"><h2>${chk || j.item ? "Reported defect" : "Job description"}</h2>${def && def.sev || j.sev ? `<span>${pill((def && def.sev || j.sev) === "major" ? "red" : "amber", (def && def.sev || j.sev) === "major" ? "Major" : "Minor")}</span>` : ""}${chk ? `<button class="btn sm ghost right noprint" onclick="A.openCheck('${chk.id}')">View check ${I("chev", 14)}</button>` : ""}</div><div class="cb">
            ${chk ? `<div class="xs muted" style="margin-bottom:6px">${esc(M.itemLabel(j.item))} · walk-around check by ${esc(X.pname(chk.driverId))}, ${fmtDT(chk.at)}</div>` : j.item ? `<div class="xs muted" style="margin-bottom:6px">Reported during the day by ${esc(X.pname(j.reportedBy))}</div>` : ""}
            <div style="white-space:pre-wrap">${esc(j.desc || "—")}</div>${rphotos.length ? `<div class="photos">${rphotos.map(p => `<img src="/api/files/${p}" onclick="M.lightbox(this.src)" alt="">`).join("")}</div>` : ""}</div></div>` : ""}
          <div class="card"><div class="ch"><h2>Work performed</h2></div><div class="cb"><textarea class="in" ${dis} placeholder="Describe the work carried out in detail…" onchange="A.jf('${j.id}','workDone',this.value)">${esc(j.workDone || "")}</textarea></div></div>
          <div class="card"><div class="ch"><h2>Labour</h2><span class="right muted small">${hrs(M.jobMins(j))} × ${eur(j.rate)}/h = <b style="color:var(--ink)">${eur(M.jobLabour(j))}</b></span></div>
            <table class="t"><thead><tr><th>Mechanic</th><th>Date</th><th>Start</th><th>End</th><th class="num">Time</th><th></th></tr></thead><tbody>
              ${(j.labour || []).map((l, i) => `<tr><td><div class="row" style="gap:8px"><span class="av mech sm">${initials(X.pname(l.mechId))}</span>${esc(X.pname(l.mechId))}</div></td><td class="small">${fmtDay(isoOf(l.start))}</td><td class="mono">${fmtT(l.start)}</td><td class="mono">${l.end ? fmtT(l.end) : `<span class="pill green">On the clock</span>`}</td><td class="num">${l.end ? mins((l.end - l.start) / 60000) : `<span data-since="${l.start}">—</span>`}</td><td class="num">${done ? "" : `<button class="iconbtn noprint" title="Remove" onclick="A.rmTime('${j.id}',${i})">${I("trash", 15)}</button>`}</td></tr>`).join("") || `<tr><td colspan="6" class="empty" style="padding:16px">No time logged.</td></tr>`}
            </tbody></table>
            ${done ? "" : `<div class="cb noprint" style="border-top:1px solid var(--line2)"><div class="row" style="align-items:flex-end;flex-wrap:wrap"><div><label class="f">Mechanic</label><select class="in" id="l-mech" style="width:170px">${mechs.map(m => `<option value="${m.id}" ${m.id === j.mechId ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></div><div><label class="f">Date</label><input type="date" class="in" id="l-date" value="${today()}" style="width:150px"></div><div><label class="f">Start</label><input type="time" class="in" id="l-start" style="width:110px"></div><div><label class="f">End</label><input type="time" class="in" id="l-end" style="width:110px"></div><button class="btn" onclick="A.addTime('${j.id}')">${I("plus", 16)} Add time</button></div></div>`}</div>
          <div class="card"><div class="ch"><h2>Parts used</h2>${j.noParts ? pill("", "No parts used") : ""}<span class="right muted small">${eur(M.jobParts(j))}</span></div>
            <table class="t"><thead><tr><th>Part</th><th>Part no.</th><th class="num">Qty</th><th class="num">Each</th><th class="num">Total</th><th></th></tr></thead><tbody>
              ${(j.parts || []).map((p, i) => { const st = p.stockId && X.stockItem(p.stockId), lo = st && X.loc(st.loc); return `<tr><td>${esc(p.desc)}${st ? `<div class="xs muted">${I("pin", 11)} From stock · ${esc(lo ? lo.name : "")} ${esc(st.bin || "")}</div>` : ""}</td><td class="muted">${esc(p.partNo || "—")}</td><td class="num">${esc(p.qty)}</td><td class="num">${eur(p.cost)}</td><td class="num"><b>${eur(p.qty * p.cost)}</b></td><td class="num">${done ? "" : `<button class="iconbtn noprint" title="Remove" onclick="A.rmPart('${j.id}',${i})">${I("trash", 15)}</button>`}</td></tr>`; }).join("") || `<tr><td colspan="6" class="empty" style="padding:16px">${j.noParts ? "Labour only — no parts used." : "No parts added."}</td></tr>`}
            </tbody></table>
            ${done ? "" : `<div class="cb noprint" style="border-top:1px solid var(--line2)"><div style="margin-bottom:8px"><select class="in" id="p-stock" onchange="A.pickStock(this.value)"><option value="">Take from stock… (or type a one-off part below)</option>${X.locations().map(l => { const items = X.stock().filter(p => p.loc === l.id); return items.length ? `<optgroup label="${esc(l.name)}">${items.map(p => `<option value="${p.id}">${esc(p.desc)} · ${esc(p.partNo)} · ${p.qty} in stock</option>`).join("")}</optgroup>` : ""; }).join("")}</select></div><div style="display:grid;grid-template-columns:2fr 1fr 70px 100px auto;gap:8px;align-items:end"><input class="in" id="p-desc" placeholder="Part description"><input class="in" id="p-no" placeholder="Part no."><input class="in" id="p-qty" value="1" placeholder="Qty"><input class="in" id="p-cost" placeholder="€ each"><button class="btn" onclick="A.addPart('${j.id}')">${I("plus", 16)} Add</button></div></div>`}
            ${j.partsNotes ? `<div class="cb" style="border-top:1px solid var(--line2)"><div class="xs muted" style="font-weight:800;text-transform:uppercase;letter-spacing:.05em">Additional notes</div>${esc(j.partsNotes)}</div>` : ""}</div>
          <div class="card pad"><div class="row"><h2 class="grow">Job photos</h2></div><div class="photos">${(j.photos || []).map(p => `<img src="/api/files/${p}" onclick="M.lightbox(this.src)" alt="">`).join("")}${done ? "" : `<label class="addph noprint">${I("camera", 22)}<input type="file" accept="image/*" onchange="A.jobPhoto('${j.id}',this)"></label>`}</div>${(j.photos || []).length || !done ? "" : `<div class="muted small">No photos.</div>`}</div>
        </div>
        <div class="stack">
          <div class="card pad noprint"><label class="f">Status</label><div class="statusflow">${M.STATUSES.filter(s => s !== "Complete").map(s => `<button class="${j.status === s ? "on" : ""}" ${dis} onclick="A.jf('${j.id}','status','${s}')">${s}</button>`).join("")}</div>
            <div class="grid g2" style="margin-top:14px;gap:12px"><div><label class="f">Priority</label><select class="in" style="padding-right:4px" ${dis} onchange="A.jf('${j.id}','priority',this.value)">${M.PRIORITIES.map(p => `<option value="${p}" ${p === j.priority ? "selected" : ""}>${p === "VOR" ? "VOR – off road" : p}</option>`).join("")}</select></div>
              <div><label class="f">Mechanic</label><select class="in" ${dis} onchange="A.jf('${j.id}','mechId',this.value||null)"><option value="">Unassigned</option>${mechs.map(m => `<option value="${m.id}" ${m.id === j.mechId ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></div>
              <div><label class="f">Job type</label><select class="in" ${dis} onchange="A.jf('${j.id}','type',this.value)">${M.JOB_TYPES.map(t => `<option ${t === j.type ? "selected" : ""}>${t}</option>`).join("")}</select></div>
              <div><label class="f">Customer</label><a class="in custlink" href="#/customer/${cust.id}">${I("folder", 14)}<span class="ellipsis">${esc(cust.name)}</span></a></div></div></div>
          <div class="card pad noprint"><div class="row" style="margin-bottom:10px"><h2 class="grow">Workshop schedule</h2><a class="btn sm ghost" href="#/schedule">${I("calendar", 14)} Planner</a></div>
            ${done ? `<div class="muted small">${j.plan ? "Was planned for " + fmtDay(j.plan.date) + " · " + j.plan.hours + "h" : "Not planned."}</div>`
            : `<div class="grid g2" style="gap:12px"><div><label class="f">Planned day</label><input type="date" class="in" value="${j.plan ? j.plan.date : ""}" onchange="A.plan('${j.id}','date',this.value)"></div><div><label class="f">Estimated hours</label><input type="number" step="0.5" min="0.5" class="in" value="${j.plan ? j.plan.hours : ""}" placeholder="e.g. 2" onchange="A.plan('${j.id}','hours',this.value)"></div></div>
              <div class="xs muted" style="margin-top:8px">${j.plan ? `On ${esc(j.mechId ? X.pname(j.mechId) : "the unassigned row")}'s list for ${fmtDay(j.plan.date).toLowerCase()} — shows on the workshop screen.` : "Pick a day to put this on the workshop planner."}</div>`}</div>
          <div class="card pad"><h2 style="margin-bottom:10px">Costs</h2><div class="totals">
            <div><span class="muted">Total hours</span><span class="v">${hrs(M.jobMins(j))}</span></div>
            <div><span class="muted">Rate (hourly)</span><span class="v">${done ? eur(j.rate) : `<input type="number" step="0.5" class="in" style="width:100px;padding:4px 8px;text-align:right" value="${j.rate}" onchange="A.jf('${j.id}','rate',Number(this.value)||0)">`}</span></div>
            <div><span class="muted">Labour</span><span class="v">${eur(M.jobLabour(j))}</span></div><div><span class="muted">Parts</span><span class="v">${eur(M.jobParts(j))}</span></div>
            <div class="g"><span>Grand total</span><span class="v">${eur(M.jobTotal(j))}</span></div></div></div>
          <div class="card pad"><h2 style="margin-bottom:10px">Docket</h2>${j.docket ? `<a class="row" href="/api/files/${j.docket.id}" target="_blank" style="background:#f5f7fa;border-radius:10px;padding:10px 12px">${I("file", 18)}<span class="grow ellipsis" style="font-weight:700">${esc(j.docket.name)}</span>${I("external", 14)}</a>${done ? "" : `<button class="btn sm ghost noprint" style="margin-top:6px" onclick="A.jf('${j.id}','docket',null)">Remove</button>`}`
            : done ? `<div class="muted small">No docket attached.</div>` : `<label class="btn upl noprint" style="width:100%">${I("upload", 16)} Upload docket (PDF or photo)<input type="file" accept="image/*,application/pdf" onchange="A.docket('${j.id}',this)"></label>`}</div>
          ${done ? `<div class="card pad"><div class="notice green">${I("check")}<div><b>Signed off ${fmtDT(j.closedAt)}</b><br>by ${esc(X.pname(j.signedOffBy))}. Vehicle safe and roadworthy to return to service.</div></div><div style="margin-top:12px">${j.sig ? `<img class="sigimg" src="${j.sig}" alt="Signature">` : `<div style="font-family:'Brush Script MT',cursive;font-size:30px;color:#2c3e66">${esc(X.pname(j.signedOffBy))}</div>`}</div></div>`
          : `<div class="card pad stack noprint"><h2>Sign off &amp; complete</h2>
              <label class="row" style="align-items:flex-start;cursor:pointer"><input type="checkbox" id="rw" style="width:18px;height:18px;margin-top:1px"><span>The work is complete and the vehicle is <b>safe and roadworthy</b> to return to service.</span></label>
              <div><label class="f">Signed off by</label><select class="in" id="so-by">${S.staff.filter(s => s.role !== "driver").map(m => `<option value="${m.id}" ${m.id === (j.mechId || me.id) ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></div>
              <div class="sigwrap"><canvas data-sig="job:${j.id}"></canvas><div class="ph">Signature</div><button class="btn sm clr" onclick="A.clearSig('job:${j.id}')">Clear</button></div>
              <button class="btn go" onclick="A.complete('${j.id}')">${I("check", 16, 2.6)} Complete job card</button></div>`}
          <div class="card pad"><h2 style="margin-bottom:12px">History</h2><div class="timeline">
            <div class="${chk || j.item ? "r" : ""}"><b>Raised</b> by ${esc(X.pname(j.reportedBy))}<div class="xs muted">${fmtDT(j.created)}</div></div>
            ${(j.labour || []).length ? `<div><b>Work started</b> by ${esc(X.pname(j.labour[0].mechId))}<div class="xs muted">${fmtDT(j.labour[0].start)}</div></div>` : ""}
            ${j.docket ? `<div><b>Docket attached</b><div class="xs muted">${esc(j.docket.name)}</div></div>` : ""}
            ${done ? `<div class="g"><b>Completed &amp; signed off</b> by ${esc(X.pname(j.signedOffBy))}<div class="xs muted">${fmtDT(j.closedAt)}</div></div>` : `<div><b class="muted">${esc(j.status)}</b></div>`}</div></div>
        </div>
      </div>`;
  }

  /* ---------- fleet ---------- */
  function fleetPage() {
    const types = ["All", ...new Set(S.vehicles.map(v => v.type))];
    const list = S.vehicles.filter(v => ui.fleetType === "All" || v.type === ui.fleetType);
    return `<div class="head"><div class="grow"><h1>Fleet</h1><div class="sub">${S.vehicles.length} vehicles · ${S.vehicles.filter(X.vorJob).length} off road · Kilminchy depot</div></div><button class="btn pri" onclick="A.vehModal()">${I("plus", 16)} Add vehicle</button></div>
      <div class="filters"><div class="seg">${types.map(t => `<button class="${ui.fleetType === t ? "on" : ""}" onclick="A.set('fleetType','${t}')">${t}<span class="c">${t === "All" ? S.vehicles.length : S.vehicles.filter(v => v.type === t).length}</span></button>`).join("")}</div></div>
      <div class="card tscroll"><table class="t"><thead><tr><th>Vehicle</th><th>Type</th><th class="num">Seats</th><th>Status</th><th>Today's check</th><th class="num">Odometer</th><th>CVRT</th><th>Service</th><th class="num">Open jobs</th></tr></thead><tbody>
      ${list.map(v => { const c = X.checkedToday(v), vor = X.vorJob(v), oj = X.openJobs(v); return `<tr class="click" onclick="location.hash='#/vehicle/${v.id}'"><td><div class="row">${vTag(v)}<div><div style="font-weight:700"><span class="reg">${esc(v.reg)}</span></div><div class="xs muted" style="margin-top:3px">${esc(v.model)}</div></div></div></td><td class="small">${esc(v.type)}</td><td class="num">${v.seats}</td>
        <td>${vor ? pill("red", "Off road") : pill("green", "Available")}</td>
        <td>${c ? `<span class="row small" style="gap:6px"><span class="dot ${M.defectsOf(c).length ? "amber" : "green"}"></span>${fmtT(c.at)} · ${esc(X.pname(c.driverId).split(" ")[0])}</span>` : `<span class="row small muted" style="gap:6px"><span class="dot"></span>Not yet</span>`}</td>
        <td class="num">${km(v.odo)}</td><td>${duePill(v.cvrtDue)}</td><td>${duePill(v.serviceDue)}</td><td class="num">${oj.length ? `<b>${oj.length}</b>` : `<span class="muted">—</span>`}</td></tr>`; }).join("")}
      </tbody></table></div>`;
  }

  function vehiclePage(id) {
    const v = X.veh(id);
    if (!v) return `<div class="empty">Vehicle not found.</div>`;
    const checks = S.checks.filter(c => c.vehicleId === v.id).sort((a, b) => b.at - a.at);
    const jobs = S.jobs.filter(j => j.vehicleId === v.id).sort((a, b) => b.created - a.created);
    const vor = X.vorJob(v), spend = jobs.filter(j => j.status === "Complete").reduce((a, j) => a + M.jobTotal(j), 0);
    const defCount = checks.reduce((a, c) => a + M.defectsOf(c).length, 0);
    return `<a class="crumb" href="#/fleet">${I("left", 14)} Fleet</a>
      <div class="head"><div class="row grow" style="gap:14px">${vTag(v, 1)}<div><h1>${esc(v.model)}</h1><div class="sub"><span class="reg">${esc(v.reg)}</span> · ${esc(v.type)} · ${v.seats} seats · ${esc(v.depot || "Kilminchy")}</div></div></div>
        <button class="btn" onclick="A.vehModal('${v.id}')">${I("pen", 16)} Edit</button><button class="btn pri" onclick="A.newJob('${v.id}')">${I("wrench", 16)} New job card</button></div>
      ${vor ? `<div class="notice red" style="margin-bottom:16px">${I("alert")}<div><b>Off the road:</b> <a href="#/job/${vor.id}" style="text-decoration:underline">#${esc(vor.id)} ${esc(vor.title)}</a></div></div>` : ""}
      <div class="grid g5">
        <div class="card kpi ${vor ? "red" : "green"}"><div class="l">Status</div><div class="n" style="font-size:22px">${vor ? "Off road" : "Available"}</div><div class="s">${X.openJobs(v).length} open job card${X.openJobs(v).length === 1 ? "" : "s"}</div></div>
        <div class="card kpi"><div class="l">Odometer</div><div class="n" style="font-size:22px">${km(v.odo)}</div><div class="s">From last walk-around</div></div>
        <div class="card kpi"><div class="l">CVRT due</div><div class="n" style="font-size:22px">${fmtD(v.cvrtDue)}</div><div class="s">${duePill(v.cvrtDue)}</div></div>
        <div class="card kpi"><div class="l">Next service</div><div class="n" style="font-size:22px">${fmtD(v.serviceDue)}</div><div class="s">${duePill(v.serviceDue)}</div></div>
        <div class="card kpi"><div class="l">Workshop spend</div><div class="n" style="font-size:22px">${eur(spend)}</div><div class="s">${jobs.length} job cards · ${defCount} defects reported</div></div></div>
      <div class="grid g2" style="margin-top:16px;align-items:start">
        <div class="card"><div class="ch"><h2>Job cards</h2><span class="right muted small">${jobs.length}</span></div>${jobs.length ? `<div class="list">${jobs.map(j => `<a class="li" href="#/job/${j.id}"><b class="small" style="width:72px">#${esc(j.id)}</b><div class="grow"><div class="t ellipsis">${esc(j.title)}</div><div class="m">${esc(j.type)} · ${fmtD(isoOf(j.created))} · ${eur(M.jobTotal(j))}</div></div>${statusPill(j.status)}</a>`).join("")}</div>` : `<div class="empty">No job cards.</div>`}</div>
        <div class="card"><div class="ch"><h2>Walk-around checks</h2><span class="right muted small">${checks.length}</span></div>${checks.length ? `<div class="list">${checks.slice(0, 15).map(c => { const o = M.outcome(c); return `<a class="li" href="javascript:void 0" onclick="A.openCheck('${c.id}')"><div class="grow"><div class="t">${fmtDT(c.at)}</div><div class="m">${esc(X.pname(c.driverId))} · ${km(c.odo)}</div></div>${pill(o.cls, o.label)}</a>`; }).join("")}</div>` : `<div class="empty">No checks yet.</div>`}</div></div>`;
  }

  /* ---------- workshop schedule ---------- */
  const DAY_HRS = 8;
  const planned = (iso, mechId) => S.jobs.filter(j => j.plan && j.plan.date === iso && (mechId === undefined || (j.mechId || "") === mechId));
  const planHrs = js => js.filter(j => j.status !== "Complete").reduce((a, j) => a + (Number(j.plan.hours) || 0), 0);
  const jobWho = j => { const c = X.custOf(j); return c.internal ? "" : c.name; };
  const running = j => (j.labour || []).find(l => !l.end);

  function schedCard(j) {
    const v = X.veh(j.vehicleId), done = j.status === "Complete", who = jobWho(j), run = running(j);
    return `<div class="sj ${done ? "done" : ""} ${j.priority === "VOR" && !done ? "vor" : ""} st-${j.status.replace(/\s/g, "")}" draggable="true" ondragstart="A.drag(event,'${j.id}')" onclick="location.hash='#/job/${j.id}'" title="#${esc(j.id)} ${esc(j.title)}">
        <div class="row" style="gap:6px">${vTag(v)}<b class="xs">#${esc(j.id)}</b><span class="grow"></span>${run ? `<span class="dot green" title="On the clock"></span>` : ""}<span class="hh">${j.plan ? j.plan.hours + "h" : ""}</span></div>
        <div class="tt">${esc(j.title)}</div>${who ? `<div class="cu">${I("folder", 11)} ${esc(who)}</div>` : ""}<div class="sb">${done ? "Complete" : esc(j.status)}${j.priority === "VOR" && !done ? " · VOR" : ""}</div></div>`;
  }
  function todayWorkshopCard() {
    const js = planned(today()).filter(j => j.status !== "Complete");
    return `<div class="card"><div class="ch"><h2>In the workshop today</h2><a class="right btn sm ghost" href="#/schedule">Schedule ${I("chev", 14)}</a></div>${js.length ? `<div class="list">${js.map(j => { const v = X.veh(j.vehicleId); return `<a class="li" href="#/job/${j.id}">${vTag(v)}<div class="grow"><div class="t ellipsis">${esc(j.title)}</div><div class="m">${j.mechId ? esc(X.pname(j.mechId)) : "Unassigned"} · ${j.plan.hours}h${jobWho(j) ? " · " + esc(jobWho(j)) : ""}</div></div>${running(j) ? pill("green", "On the clock") : statusPill(j.status)}</a>`; }).join("")}</div>` : `<div class="empty">Nothing planned for today.</div>`}</div>`;
  }
  function schedulePage() {
    const wk = ui.schedWeek, days = Array.from({ length: 6 }, (_, i) => addDaysIso(wk, i)), t = today();
    const mechs = S.staff.filter(s => s.role === "mechanic");
    const rows = mechs.map(m => [m.id, m.name, m]).concat(days.some(d => planned(d, "").length) ? [["", "Unassigned", null]] : []);
    const tray = S.jobs.filter(j => j.status !== "Complete" && !j.plan).sort((a, b) => ({ VOR: 0, High: 1, Normal: 2 })[a.priority] - ({ VOR: 0, High: 1, Normal: 2 })[b.priority] || a.created - b.created);
    const weekJobs = days.flatMap(d => planned(d)), weekHrs = planHrs(weekJobs), cap = mechs.length * DAY_HRS * 5 + mechs.length * 4;
    const lead = S.staff.find(s => /workshop/i.test(s.title || ""));
    const sat = d => new Date(d + "T12:00").getDay() === 6;
    return `<div class="head"><div class="grow"><h1>Workshop schedule</h1><div class="sub">Week of ${fmtD(wk)}${lead ? ` · planned by ${esc(lead.name)}, ${esc(lead.title.toLowerCase())}` : ""} · drag job cards to plan or move them</div></div>
        <div class="seg"><button onclick="A.week(-1)">${I("left", 14)}</button><button class="${wk === M.weekStart(t) ? "on" : ""}" onclick="A.week(0)">This week</button><button onclick="A.week(1)" style="transform:scaleX(-1)">${I("left", 14)}</button></div>
        <a class="btn pri" href="#/screen" target="_blank">${I("tv", 16)} Open workshop screen</a></div>
      <div class="grid g4" style="margin-bottom:16px">
        <div class="card kpi"><div class="l">Planned this week</div><div class="n">${weekJobs.length}<small> jobs</small></div><div class="s">${weekJobs.filter(j => j.status === "Complete").length} done so far</div></div>
        <div class="card kpi ${weekHrs > cap ? "red" : ""}"><div class="l">Workshop load</div><div class="n">${Math.round(weekHrs * 10) / 10}<small> / ${cap}h</small></div><div class="meter"><i style="width:${Math.min(100, weekHrs / cap * 100)}%"></i></div></div>
        <div class="card kpi ${tray.length ? "amber" : "green"}"><div class="l">Not scheduled yet</div><div class="n">${tray.length}</div><div class="s">${tray.filter(j => j.priority === "VOR").length} VOR · ${tray.filter(M.isExternal).length} outside customers</div></div>
        <div class="card kpi"><div class="l">Outside customer work</div><div class="n">${weekJobs.filter(M.isExternal).length}</div><div class="s">${Math.round(planHrs(weekJobs.filter(M.isExternal)) * 10) / 10}h planned this week</div></div></div>
      <div class="schedwrap">
        <div class="card sched" style="--days:${days.length}"><div class="sg">
          <div class="sh corner"></div>${days.map(d => `<div class="sh ${d === t ? "today" : ""}"><b>${M.DOW[new Date(d + "T12:00").getDay()]} ${Number(d.slice(8))}</b><span>${M.MON[Number(d.slice(5, 7)) - 1]}${d === t ? " · Today" : ""}</span></div>`).join("")}
          ${rows.map(([mid, name, p]) => `<div class="sm"><span class="${p ? avc(p) : "av"} sm">${p ? initials(name) : "?"}</span><div><b>${esc(name)}</b><div class="xs muted">${p ? hrs(planHrs(days.flatMap(d => planned(d, mid))) * 60) + " this week" : "Needs a mechanic"}</div></div></div>`
            + days.map(d => { const js = planned(d, mid), h = planHrs(js), max = sat(d) ? 4 : DAY_HRS; return `<div class="sc ${d === t ? "today" : ""} ${d < t ? "past" : ""}" ondragover="A.over(event)" ondragleave="this.classList.remove('hot')" ondrop="A.drop(event,'${mid}','${d}')">
                ${p ? `<div class="load ${h > max ? "over" : ""}" title="${h}h of ${max}h"><i style="width:${Math.min(100, h / max * 100)}%"></i><span>${h ? h + "/" + max + "h" : ""}</span></div>` : ""}
                ${js.sort((a, b) => (a.status === "Complete") - (b.status === "Complete")).map(schedCard).join("")}</div>`; }).join("")).join("")}
        </div></div>
        <div class="card tray" ondragover="A.over(event)" ondragleave="this.classList.remove('hot')" ondrop="A.drop(event,null,null)"><div class="ch"><h2>Not scheduled</h2><span class="right">${pill(tray.length ? "amber" : "green", tray.length)}</span></div>
          <div class="cb">${tray.map(j => schedCard(j).replace('<div class="sb">', `<div class="sb"><button class="btn sm" onclick="event.stopPropagation();A.planModal('${j.id}')">Plan</button> `)).join("") || `<div class="empty" style="padding:18px 0">Every open job is on the planner.</div>`}
          <div class="xs muted" style="margin-top:8px">Drag a card onto a day, or drop one here to take it off the planner.</div></div></div>
      </div>`;
  }

  // Full-screen board for the TV in the workshop. Updates live as jobs change.
  function screenPage() {
    const t = today(), mechs = S.staff.filter(s => s.role === "mechanic"), tm = addDaysIso(t, 1);
    const col = (mid, name, p) => { const js = planned(t, mid).sort((a, b) => (a.status === "Complete") - (b.status === "Complete") || ({ VOR: 0, High: 1, Normal: 2 })[a.priority] - ({ VOR: 0, High: 1, Normal: 2 })[b.priority]);
      return `<section class="tvcol"><header><span class="${p ? avc(p) : "av"}">${p ? initials(name) : "?"}</span><div class="grow"><b>${esc(name)}</b><span>${hrs(planHrs(js) * 60)} planned · ${js.filter(j => j.status === "Complete").length}/${js.length} done</span></div></header>
        ${js.map(j => { const v = X.veh(j.vehicleId), run = running(j), done = j.status === "Complete", who = jobWho(j); return `<div class="tvjob ${done ? "done" : ""} ${j.priority === "VOR" && !done ? "vor" : ""}">
          <div class="row"><span class="tvreg">${esc(v.fleet === "EXT" ? v.reg : v.fleet + " · " + v.reg)}</span><span class="grow"></span>${run ? `<span class="tvclock"><i></i><span data-since="${run.start}">—</span></span>` : `<span class="tvst">${done ? "✓ Done" : esc(j.status)}</span>`}</div>
          <div class="tvtt">${esc(j.title)}</div><div class="tvmeta">#${esc(j.id)} · ${esc(j.type)} · ${j.plan.hours}h${who ? ` · <b>${esc(who)}</b>` : ""}${j.priority === "VOR" && !done ? ` · <b class="r">OFF ROAD</b>` : ""}</div></div>`; }).join("") || `<div class="tvempty">Nothing planned</div>`}
        <footer>Tomorrow: ${planned(tm, mid).length ? planned(tm, mid).map(j => esc(X.veh(j.vehicleId).fleet === "EXT" ? X.veh(j.vehicleId).reg : X.veh(j.vehicleId).fleet)).join(", ") : "—"}</footer></section>`; };
    const waiting = S.jobs.filter(j => j.status === "Awaiting parts"), unplanned = S.jobs.filter(j => j.status !== "Complete" && !j.plan), vor = S.vehicles.filter(X.vorJob);
    const side = (ttl, list, f) => `<div class="tvbox"><h3>${ttl}<span>${list.length}</span></h3>${list.slice(0, 5).map(f).join("") || `<div class="tvempty sm">None</div>`}</div>`;
    return `<div class="tv"><div class="tvhead"><img src="../logo.png" alt=""><div class="grow"><h1>Workshop today</h1><div>${M.DOW[new Date().getDay()]} ${fmtD(t)}</div></div><div class="tvnow" id="tvnow">${fmtT(Date.now())}</div><a class="tvx" href="#/schedule" title="Back to schedule">${I("x", 20)}</a></div>
      <div class="tvbody"><div class="tvcols" style="--n:${mechs.length + (planned(t, "").length ? 1 : 0)}">${mechs.map(m => col(m.id, m.name, m)).join("")}${planned(t, "").length ? col("", "Unassigned", null) : ""}</div>
        <aside class="tvside">${side("Off the road", vor, v => `<div class="tvli r"><b>${esc(v.fleet)}</b> ${esc(X.vorJob(v).title)}</div>`)}
          ${side("Waiting on parts", waiting, j => `<div class="tvli"><b>${esc(X.veh(j.vehicleId).fleet === "EXT" ? X.veh(j.vehicleId).reg : X.veh(j.vehicleId).fleet)}</b> ${esc(j.title)}</div>`)}
          ${side("Not scheduled", unplanned, j => `<div class="tvli"><b>#${esc(j.id)}</b> ${esc(j.title)}</div>`)}
          ${side("Low stock", X.stock().filter(M.lowStock), p => `<div class="tvli"><b>${p.qty}</b> ${esc(p.desc)}</div>`)}</aside></div></div>`;
  }

  /* ---------- parts & stock ---------- */
  function partsPage() {
    const all = X.stock(), locs = X.locations(), q = ui.partQ.toLowerCase();
    const list = all.filter(p => (!ui.partLoc || p.loc === ui.partLoc) && (!ui.partLow || M.lowStock(p)) && (!q || (p.partNo + " " + p.desc + " " + (p.cat || "") + " " + (p.supplier || "") + " " + (p.bin || "")).toLowerCase().includes(q)))
      .sort((a, b) => locs.findIndex(l => l.id === a.loc) - locs.findIndex(l => l.id === b.loc) || String(a.bin || "").localeCompare(String(b.bin || "")));
    const value = all.reduce((a, p) => a + Math.max(0, p.qty) * p.cost, 0), low = all.filter(M.lowStock);
    const since = Date.now() - 30 * 864e5, used = X.moves().filter(m => m.at > since && m.qty < 0);
    return `<div class="head"><div class="grow"><h1>Parts &amp; stock</h1><div class="sub">What's on the shelves, where it's kept, and what's been used on job cards</div></div>
        <div class="search">${I("search", 16)}<input id="q" placeholder="Search part no., description…" value="${esc(ui.partQ)}" oninput="A.psearch(this.value)"></div>
        <button class="btn" onclick="A.locModal()">${I("pin", 16)} Add stock place</button><button class="btn pri" onclick="A.stockModal()">${I("plus", 16)} Add part</button></div>
      <div class="grid g4" style="margin-bottom:16px">
        <div class="card kpi"><div class="l"><span class="i">${I("box", 16)}</span>Stock lines</div><div class="n">${all.length}</div><div class="s">across ${locs.length} stock places</div></div>
        <div class="card kpi"><div class="l"><span class="i">${I("euro", 16)}</span>Stock value</div><div class="n" style="font-size:24px">${eur(value)}</div><div class="s">at cost price</div></div>
        <a class="card kpi ${low.length ? "amber" : "green"}" href="javascript:void 0" onclick="A.set('partLow',${!ui.partLow})"><div class="l"><span class="i">${I("alert", 16)}</span>Low or out of stock</div><div class="n">${low.length}</div><div class="s">${ui.partLow ? "Showing these only — click to show all" : "Click to show only these"}</div></a>
        <div class="card kpi"><div class="l"><span class="i">${I("wrench", 16)}</span>Used on jobs</div><div class="n">${used.length}</div><div class="s">${eur(used.reduce((a, m) => { const p = X.stockItem(m.stockId); return a + (p ? -m.qty * p.cost : 0); }, 0))} in the last 30 days</div></div></div>
      <div class="filters"><div class="seg"><button class="${!ui.partLoc ? "on" : ""}" onclick="A.set('partLoc','')">All places<span class="c">${all.length}</span></button>${locs.map(l => `<button class="${ui.partLoc === l.id ? "on" : ""}" onclick="A.set('partLoc','${l.id}')">${esc(l.name)}<span class="c">${all.filter(p => p.loc === l.id).length}</span></button>`).join("")}</div></div>
      <div class="card tscroll"><table class="t"><thead><tr><th>Part no.</th><th>Description</th><th>Stock place</th><th class="num">On hand</th><th class="num">Min</th><th class="num">Cost each</th><th class="num">Value</th><th>Status</th><th class="ctr">Action</th></tr></thead><tbody>
        ${list.map(p => { const l = X.loc(p.loc); return `<tr><td class="mono"><b>${esc(p.partNo)}</b></td><td><div style="font-weight:600">${esc(p.desc)}</div><div class="xs muted">${esc(p.cat || "")}${p.supplier ? " · " + esc(p.supplier) : ""}</div></td>
          <td class="small"><div class="row" style="gap:6px"><span class="muted">${I("pin", 14)}</span><div><b>${esc(l ? l.name : "Unplaced")}</b><div class="xs muted">${esc(p.bin || "")}</div></div></div></td>
          <td class="num"><b style="font-size:15px;${p.qty <= 0 ? "color:var(--red)" : M.lowStock(p) ? "color:var(--amber)" : ""}">${p.qty}</b></td><td class="num muted">${p.min}</td><td class="num">${eur(p.cost)}</td><td class="num">${eur(Math.max(0, p.qty) * p.cost)}</td><td>${M.stockPill(p)}</td>
          <td class="ctr"><div class="acts"><button title="Book in / adjust" onclick="A.adjModal('${p.id}')">${I("plus", 16)}</button><button title="Edit" onclick="A.stockModal('${p.id}')">${I("pen", 16)}</button></div></td></tr>`; }).join("") || `<tr><td colspan="9" class="empty">No parts match.</td></tr>`}
      </tbody></table></div>
      <div class="grid g2" style="margin-top:16px;align-items:start">
        <div class="card"><div class="ch"><h2>Stock places</h2><button class="right btn sm" onclick="A.locModal()">${I("plus", 14)} Add stock place</button></div><div class="list">${locs.map(l => { const items = all.filter(p => p.loc === l.id); return `<div class="li" style="cursor:default"><span class="locic">${I("pin", 16)}</span><div class="grow"><div class="t">${esc(l.name)}</div><div class="m">${esc(l.note || "")}</div></div><span class="small muted">${items.length} parts · ${eur(items.reduce((a, p) => a + Math.max(0, p.qty) * p.cost, 0))}</span>${items.filter(M.lowStock).length ? pill("amber", items.filter(M.lowStock).length + " low") : ""}<button class="iconbtn" title="Edit" onclick="A.locModal('${l.id}')">${I("pen", 15)}</button></div>`; }).join("")}</div></div>
        <div class="card"><div class="ch"><h2>Recent stock movements</h2></div>${X.moves().length ? `<div class="list">${X.moves().slice(0, 10).map(m => { const p = X.stockItem(m.stockId); return `<div class="li" style="cursor:default"><b class="small" style="width:44px;color:${m.qty < 0 ? "var(--red)" : "var(--green-ink)"}">${m.qty > 0 ? "+" : ""}${m.qty}</b><div class="grow"><div class="t ellipsis">${esc(p ? p.desc : "Removed part")}</div><div class="m">${esc(m.why)}${m.jobId ? ` · <a href="#/job/${m.jobId}" style="text-decoration:underline">#${esc(m.jobId)}</a>` : ""} · ${esc(X.pname(m.by))}</div></div><span class="xs muted">${fmtDT(m.at)}</span></div>`; }).join("")}</div>` : `<div class="empty">Parts taken from stock on job cards, deliveries and stock counts show here.</div>`}</div></div>`;
  }

  /* ---------- customers ---------- */
  function customersPage() {
    const q = ui.custQ.toLowerCase();
    const list = X.customers().filter(c => !q || (c.name + " " + (c.contact || "") + " " + (c.phone || "") + " " + (c.vehicles || []).map(v => v.reg).join(" ")).toLowerCase().includes(q))
      .sort((a, b) => (b.internal ? 1 : 0) - (a.internal ? 1 : 0) || a.name.localeCompare(b.name));
    const ext = X.customers().filter(c => !c.internal), extJobs = S.jobs.filter(M.isExternal);
    return `<div class="head"><div class="grow"><h1>Customers</h1><div class="sub">A digital file for every customer — open one to see all of their vehicles and job cards</div></div>
        <div class="search">${I("search", 16)}<input id="q" placeholder="Search name, contact, reg…" value="${esc(ui.custQ)}" oninput="A.csearch(this.value)"></div><button class="btn pri" onclick="A.custModal()">${I("plus", 16)} Add customer</button></div>
      <div class="grid g4" style="margin-bottom:16px">
        <div class="card kpi"><div class="l">Outside customers</div><div class="n">${ext.length}</div><div class="s">${ext.reduce((a, c) => a + (c.vehicles || []).length, 0)} vehicles on file</div></div>
        <div class="card kpi"><div class="l">Open outside jobs</div><div class="n">${extJobs.filter(j => j.status !== "Complete").length}</div><div class="s">${extJobs.length} job cards all time</div></div></div>
      <div class="card tscroll"><table class="t"><thead><tr><th>Customer</th><th>Contact</th><th class="num">Vehicles</th><th class="num">Open jobs</th><th class="num">All jobs</th><th>Last job</th></tr></thead><tbody>
        ${list.map(c => { const js = X.custJobs(c), last = js.slice().sort((a, b) => b.created - a.created)[0]; return `<tr class="click" onclick="location.hash='#/customer/${c.id}'"><td><div class="row"><span class="custav ${c.internal ? "int" : ""}">${initials(c.name)}</span><div><b>${esc(c.name)}</b><div class="xs muted">${c.internal ? "Internal — Martley's own vehicles" : esc(c.address || "")}</div></div></div></td>
          <td class="small">${esc(c.contact || "—")}<div class="xs muted">${esc(c.phone || "")}</div></td><td class="num">${c.internal ? S.vehicles.length : (c.vehicles || []).length}</td><td class="num">${js.filter(j => j.status !== "Complete").length || `<span class="muted">—</span>`}</td><td class="num">${js.length}</td>
          <td class="small">${last ? fmtD(isoOf(last.created)) : "—"}</td></tr>`; }).join("") || `<tr><td colspan="6" class="empty">No customers match.</td></tr>`}
      </tbody></table></div>`;
  }
  function customerPage(id) {
    const c = X.customer(id);
    if (!c) return `<div class="empty">Customer not found. <a href="#/customers">All customers</a></div>`;
    const js = X.custJobs(c).sort((a, b) => (a.status === "Complete") - (b.status === "Complete") || b.created - a.created);
    const docs = js.flatMap(j => (j.docket ? [{ j, id: j.docket.id, name: j.docket.name, kind: "Docket" }] : []).concat((j.photos || []).map(p => ({ j, id: p, kind: "Photo" }))));
    const vehs = c.internal ? S.vehicles : (c.vehicles || []);
    return `<a class="crumb" href="#/customers">${I("left", 14)} Customers</a>
      <div class="head"><div class="row grow" style="gap:14px"><span class="custav lg ${c.internal ? "int" : ""}">${initials(c.name)}</span><div><div class="row" style="gap:8px;margin-bottom:4px">${c.internal ? pill("dark", "Internal") : pill("blue", "Outside customer")}</div><h1>${esc(c.name)}</h1><div class="sub">${esc(c.contact || "")}${c.phone ? " · " + esc(c.phone) : ""}${c.email ? " · " + esc(c.email) : ""}</div></div></div>
        ${c.internal ? "" : `<button class="btn" onclick="A.custModal('${c.id}')">${I("pen", 16)} Edit</button>`}<button class="btn pri" onclick="A.newJob(null,'${c.id}')">${I("wrench", 16)} New job card</button></div>
      <div class="grid g3">
        <div class="card kpi"><div class="l">Job cards</div><div class="n">${js.length}</div><div class="s">all time</div></div>
        <div class="card kpi ${js.some(j => j.status !== "Complete") ? "blue" : ""}"><div class="l">Open now</div><div class="n">${js.filter(j => j.status !== "Complete").length}</div><div class="s">${js.filter(j => j.status !== "Complete" && j.plan).length} on the planner</div></div>
        <div class="card kpi"><div class="l">Customer since</div><div class="n" style="font-size:22px">${c.since ? fmtD(c.since) : "—"}</div><div class="s">${c.internal ? "" : (c.vehicles || []).length + " vehicle" + ((c.vehicles || []).length === 1 ? "" : "s") + " on file"}</div></div></div>
      <div class="grid g21" style="margin-top:16px;align-items:start">
        <div class="stack">
          <div class="card"><div class="ch"><h2>All work</h2><span class="right muted small">${js.length} job card${js.length === 1 ? "" : "s"}</span></div><div class="tscroll"><table class="t"><thead><tr><th>Job no.</th><th>Raised</th><th>Vehicle</th><th>Job</th><th>Status</th></tr></thead><tbody>
            ${js.map(j => { const v = X.veh(j.vehicleId); return `<tr class="click" onclick="location.hash='#/job/${j.id}'"><td><b>#${esc(j.id)}</b></td><td class="small mono">${fmtD(isoOf(j.created))}</td><td><span class="reg">${esc(v ? v.reg : "—")}</span></td><td style="max-width:260px"><div class="ellipsis" style="font-weight:600">${esc(j.title)}</div><div class="xs muted">${esc(j.type)}${j.plan && j.status !== "Complete" ? " · planned " + fmtDay(j.plan.date).toLowerCase() : ""}</div></td><td>${statusPill(j.status)}</td></tr>`; }).join("") || `<tr><td colspan="5" class="empty">No job cards yet.</td></tr>`}
          </tbody></table></div></div>
          <div class="card pad"><h2 style="margin-bottom:10px">Dockets &amp; photos</h2>${docs.length ? `<div class="docgrid">${docs.map(d => d.kind === "Photo" ? `<figure><img src="/api/files/${d.id}" onclick="M.lightbox(this.src)" alt=""><figcaption>#${esc(d.j.id)}</figcaption></figure>` : `<a class="doc" href="/api/files/${d.id}" target="_blank">${I("file", 22)}<span class="ellipsis">${esc(d.name)}</span><em>#${esc(d.j.id)}</em></a>`).join("")}</div>` : `<div class="muted small">Dockets and photos added to this customer's job cards are kept here.</div>`}</div>
        </div>
        <div class="stack">
          <div class="card pad"><h2 style="margin-bottom:10px">Details</h2><div class="kv c1"><div><span>Contact</span><b>${esc(c.contact || "—")}</b></div><div><span>Phone</span><b>${esc(c.phone || "—")}</b></div><div><span>Email</span><b>${esc(c.email || "—")}</b></div><div><span>Address</span><b>${esc(c.address || "—")}</b></div></div></div>
          <div class="card"><div class="ch"><h2>Vehicles</h2><span class="muted small">${vehs.length}</span>${c.internal ? `<a class="right btn sm ghost" href="#/fleet">Fleet ${I("chev", 14)}</a>` : `<button class="right btn sm" onclick="A.cvModal('${c.id}')">${I("plus", 14)} Add vehicle</button>`}</div>
            ${vehs.length ? `<div class="list">${vehs.slice(0, c.internal ? 6 : 50).map(v => { const vj = js.filter(j => j.vehicleId === v.id); return `<a class="li" href="${c.internal ? "#/vehicle/" + v.id : "javascript:void 0"}" ${c.internal ? "" : `onclick="A.newJob(null,'${c.id}','${v.id}')"`}><span class="reg">${esc(v.reg)}</span><div class="grow"><div class="t ellipsis">${esc(v.model || "")}</div><div class="m">${esc(v.type || "")} · ${vj.length} job${vj.length === 1 ? "" : "s"}</div></div>${c.internal ? `<span class="muted">${I("chev", 16)}</span>` : `<span class="xs muted">New job ${I("plus", 12)}</span>`}</a>`; }).join("")}${c.internal && vehs.length > 6 ? `<a class="li" href="#/fleet"><span class="muted small">+ ${vehs.length - 6} more in the fleet list</span></a>` : ""}</div>` : `<div class="empty">No vehicles on file yet.</div>`}</div>
          <div class="card pad"><h2 style="margin-bottom:10px">Notes</h2><textarea class="in" placeholder="Anything the workshop should know about this customer…" onchange="A.custNote('${c.id}',this.value)">${esc(c.notes || "")}</textarea></div>
        </div></div>`;
  }

  /* ---------- team & settings ---------- */
  function teamPage() {
    const since = Date.now() - 30 * 864e5;
    const groups = ["driver", "mechanic", "admin"];
    return `<div class="head"><div class="grow"><h1>Team</h1><div class="sub">Who can sign in to the mobile app and admin, and their PINs</div></div><button class="btn pri" onclick="A.staffModal()">${I("plus", 16)} Add person</button></div>
      ${groups.map(g => { const ppl = S.staff.filter(s => s.role === g); return `<div class="card" style="margin-bottom:16px"><div class="ch"><h2>${M.ROLE[g]}s</h2><span class="right muted small">${ppl.length}</span></div><div class="tscroll"><table class="t"><thead><tr><th>Name</th><th>Phone</th><th>${g === "admin" ? "" : "Licence"}</th><th>Joined</th><th class="num">${g === "driver" ? "Checks (30 days)" : g === "mechanic" ? "Hours (30 days)" : ""}</th><th class="num">${g === "driver" ? "Defects reported" : g === "mechanic" ? "Jobs completed" : ""}</th><th>PIN</th><th></th></tr></thead><tbody>
        ${ppl.map(p => `<tr><td><div class="row"><span class="${avc(p)}">${initials(p.name)}</span><div><b>${esc(p.name)}</b>${p.title ? `<div class="xs muted">${esc(p.title)}</div>` : ""}</div></div></td><td class="small">${esc(p.phone || "—")}</td><td class="small">${esc(p.licence || "")}</td><td class="small">${p.joined ? fmtD(p.joined) : "—"}</td>
          <td class="num">${g === "driver" ? S.checks.filter(c => c.driverId === p.id && c.at > since).length : g === "mechanic" ? hrs(S.jobs.reduce((a, j) => a + (j.labour || []).filter(l => l.mechId === p.id && l.start > since).reduce((b, l) => b + ((l.end || Date.now()) - l.start) / 60000, 0), 0)) : ""}</td>
          <td class="num">${g === "driver" ? S.checks.filter(c => c.driverId === p.id).reduce((a, c) => a + M.defectsOf(c).length, 0) : g === "mechanic" ? S.jobs.filter(j => j.signedOffBy === p.id).length : ""}</td>
          <td class="mono muted">••••</td><td class="num"><button class="iconbtn" title="Edit" onclick="A.staffModal('${p.id}')">${I("pen", 15)}</button></td></tr>`).join("")}</tbody></table></div></div>`; }).join("")}`;
  }
  function settingsPage() {
    const st = S.settings || {};
    return `<div class="head"><div class="grow"><h1>Settings</h1><div class="sub">Workshop defaults and company details used on printed job cards</div></div></div>
      <div class="grid g2" style="align-items:start">
        <div class="card pad stack"><h2>Workshop</h2><div><label class="f">Default labour rate (€ per hour)</label><input class="in" type="number" step="0.5" value="${st.rate || 55}" onchange="A.setting('rate',Number(this.value)||0)" style="max-width:200px"><div class="xs muted" style="margin-top:6px">Used for new job cards. Existing cards keep their own rate.</div></div></div>
        <div class="card pad stack"><h2>Company</h2><div class="kv c2"><div><span>Name</span><b>Martley's of Portlaoise</b></div><div><span>Phone</span><b>057 862 0888</b></div><div><span>Depot</span><b>Kilminchy, Dublin Road, Portlaoise, Co. Laois R32 CPA4</b></div><div><span>Email</span><b>info@martleys.com</b></div></div></div>
        <div class="card pad"><h2 style="margin-bottom:10px">Walk-around checklist</h2><div class="small muted" style="margin-bottom:10px">${M.SECTIONS.reduce((a, s) => a + s.items.length, 0)} items in ${M.SECTIONS.length} sections. Trailer-only items start as N/A; wheelchair and school-bus items only show on those vehicles.</div>${M.SECTIONS.map(s => `<div class="secttl">${esc(s.name)} · ${s.items.length}</div>`).join("")}</div>
      </div>`;
  }

  /* ---------- modals ---------- */
  function modal() {
    const m = ui.modal, f = form;
    const field = (k, label, attrs = "") => `<div><label class="f">${label}</label><input class="in" value="${esc(f[k] == null ? "" : f[k])}" oninput="A.ff('${k}',this.value)" ${attrs}></div>`;
    const sel = (k, label, opts) => `<div><label class="f">${label}</label><select class="in" onchange="A.ff('${k}',this.value)">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(f[k]) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`;
    let title = "", body = "", ok = "";
    const selR = (k, label, opts) => sel(k, label, opts).replace("A.ff(", "A.ffr(");
    if (m.type === "job") {
      title = "New job card";
      const ext = f.who === "ext", c = ext && X.customer(f.customerId);
      body = `<div><label class="f">Who's the job for?</label><div class="seg wide"><button class="${!ext ? "on" : ""}" onclick="A.ffr('who','fleet')">${I("bus", 15)} Martley's fleet</button><button class="${ext ? "on" : ""}" onclick="A.ffr('who','ext')">${I("folder", 15)} Outside customer</button></div></div>
        ${ext ? `<div class="grid g2" style="gap:12px">${selR("customerId", "Customer *", [["", "Choose…"], ...X.customers().filter(x => !x.internal).map(x => [x.id, x.name])])}${c ? selR("vehicleId", "Vehicle *", [["", "Choose…"], ...(c.vehicles || []).map(v => [v.id, v.reg + " · " + (v.model || "")]), ["__new", "+ New vehicle…"]]) : `<div><label class="f">Vehicle *</label><select class="in" disabled><option>Choose the customer first</option></select></div>`}</div>
          ${f.vehicleId === "__new" ? `<div class="grid g3" style="gap:12px">${field("newReg", "Registration *", 'placeholder="e.g. 201-LS-1234"')}${field("newModel", "Make & model")}${sel("newType", "Type", [["Minibus", "Minibus"], ["Coach", "Coach"], ["School bus", "School bus"], ["Van", "Van"], ["Rigid truck", "Rigid truck"], ["Car", "Car"], ["Other", "Other"]])}</div>` : ""}
          <div class="xs muted" style="margin-top:-4px">Not on the list? <a href="javascript:void 0" onclick="A.custModal()" style="text-decoration:underline">Add a new customer</a>.</div>`
        : `<div>${sel("vehicleId", "Vehicle *", [["", "Choose…"], ...S.vehicles.map(v => [v.id, v.fleet + " · " + v.reg])])}</div>`}
        <div class="grid g2" style="gap:12px">${field("title", "Title *", 'placeholder="e.g. A service — 15,000 km"')}${sel("type", "Job type", M.JOB_TYPES.map(t => [t, t]))}</div>
        <div><label class="f">Description</label><textarea class="in" oninput="A.ff('desc',this.value)" placeholder="What needs doing">${esc(f.desc || "")}</textarea></div>
        <div class="grid g2" style="gap:12px">${sel("priority", "Priority", M.PRIORITIES.map(p => [p, p === "VOR" ? "VOR (off road)" : p]))}${sel("mechId", "Mechanic", [["", "Unassigned"], ...S.staff.filter(s => s.role === "mechanic").map(s => [s.id, s.name])])}</div>
        <div class="grid g2" style="gap:12px">${field("planDate", "Plan for (optional)", 'type="date"')}${field("planHours", "Estimated hours", 'type="number" step="0.5" min="0.5" placeholder="e.g. 2"')}</div>`;
      ok = `<button class="btn pri" onclick="A.saveJob()">Create job card</button>`;
    } else if (m.type === "plan") {
      const j = job(m.id), v = X.veh(j.vehicleId);
      title = "Plan #" + j.id + " · " + (v.fleet === "EXT" ? v.reg : v.fleet);
      body = `<div class="small" style="font-weight:600">${esc(j.title)}</div><div class="grid g3" style="gap:12px">${field("date", "Day *", 'type="date"')}${field("hours", "Estimated hours", 'type="number" step="0.5" min="0.5"')}${sel("mechId", "Mechanic", [["", "Unassigned"], ...S.staff.filter(s => s.role === "mechanic").map(s => [s.id, s.name])])}</div>`;
      ok = `<button class="btn pri" onclick="A.savePlan()">Put on planner</button>`;
    } else if (m.type === "cust") {
      title = m.id ? "Edit customer" : "Add customer";
      body = `${field("name", "Customer / business name *")}<div class="grid g2" style="gap:12px">${field("contact", "Contact person")}${field("phone", "Phone")}</div>${field("email", "Email")}${field("address", "Address")}`;
      ok = `<button class="btn pri" onclick="A.saveCust()">${m.id ? "Save" : "Add customer"}</button>`;
    } else if (m.type === "cv") {
      title = "Add vehicle · " + X.customer(m.id).name;
      body = `<div class="grid g2" style="gap:12px">${field("reg", "Registration *", 'placeholder="e.g. 201-LS-1234"')}${sel("type", "Type", [["Minibus", "Minibus"], ["Coach", "Coach"], ["School bus", "School bus"], ["Van", "Van"], ["Rigid truck", "Rigid truck"], ["Car", "Car"], ["Other", "Other"]])}</div>${field("model", "Make & model")}`;
      ok = `<button class="btn pri" onclick="A.saveCv()">Add vehicle</button>`;
    } else if (m.type === "stock") {
      title = m.id ? "Edit part" : "Add part to stock";
      body = `<div class="grid g2" style="gap:12px">${field("partNo", "Part no. *")}${field("cat", "Category", 'placeholder="e.g. Brakes, Electrical"')}</div>${field("desc", "Description *")}
        <div class="grid g2" style="gap:12px">${sel("loc", "Stock place *", X.locations().map(l => [l.id, l.name]))}${field("bin", "Shelf / bin", 'placeholder="e.g. A3-02"')}</div>
        <div class="grid g3" style="gap:12px">${field("qty", "On hand", 'type="number" step="1"')}${field("min", "Reorder at", 'type="number" step="1"')}${field("cost", "Cost each (€)", 'type="number" step="0.01"')}</div>${field("supplier", "Supplier")}`;
      ok = `${m.id ? `<button class="btn ghost" style="color:var(--red);margin-right:auto" onclick="A.delStock('${m.id}')">Remove</button>` : ""}<button class="btn pri" onclick="A.saveStock()">${m.id ? "Save" : "Add part"}</button>`;
    } else if (m.type === "adj") {
      const p = X.stockItem(m.id), l = X.loc(p.loc);
      title = "Book in / adjust · " + p.partNo;
      body = `<div class="notice blue">${I("pin")}<div><b>${esc(p.desc)}</b><br>${esc(l ? l.name : "")} ${esc(p.bin || "")} · <b>${p.qty}</b> on hand</div></div>
        <div class="grid g2" style="gap:12px">${field("qty", "Change (+ to add, − to remove) *", 'type="number" step="1" placeholder="e.g. 10 or -2"')}${sel("why", "Reason", [["Delivery received", "Delivery received"], ["Stock count correction", "Stock count correction"], ["Damaged / returned to supplier", "Damaged / returned to supplier"], ["Moved to another place", "Moved to another place"]])}</div>
        ${f.why === "Moved to another place" ? `<div class="grid g2" style="gap:12px">${sel("loc", "New stock place", X.locations().map(x => [x.id, x.name]))}${field("bin", "Shelf / bin")}</div>` : ""}`;
      ok = `<button class="btn pri" onclick="A.saveAdj()">Save</button>`;
    } else if (m.type === "loc") {
      title = m.id ? "Edit stock place" : "Add stock place";
      body = `${field("name", "Name *", 'placeholder="e.g. Rack D, Van 2, Yard container"')}${field("note", "What's kept there")}`;
      ok = `<button class="btn pri" onclick="A.saveLoc()">${m.id ? "Save" : "Add stock place"}</button>`;
    } else if (m.type === "veh") {
      title = m.id ? "Edit vehicle" : "Add vehicle";
      body = `<div class="grid g2" style="gap:12px">${field("fleet", "Fleet no. *", 'placeholder="M15"')}${field("reg", "Registration *", 'placeholder="251-LS-1234"')}</div>
        ${field("model", "Make & model")}
        <div class="grid g3" style="gap:12px">${sel("type", "Type", [["Coach", "Coach"], ["School bus", "School bus"], ["Minibus", "Minibus"], ["Accessible minibus", "Accessible minibus"]])}${field("seats", "Seats", 'type="number"')}${field("odo", "Odometer (km)", 'type="number"')}</div>
        <div class="grid g2" style="gap:12px">${field("cvrtDue", "CVRT due", 'type="date"')}${field("serviceDue", "Service due", 'type="date"')}</div>`;
      ok = `<button class="btn pri" onclick="A.saveVeh()">${m.id ? "Save changes" : "Add vehicle"}</button>`;
    } else if (m.type === "svc") {
      const v = X.veh(m.id);
      title = "Service due · " + v.fleet + " " + v.reg;
      body = `${field("serviceDue", "Next service due", 'type="date"')}<div class="xs muted">Updates the vehicle record, so it shows on every check, the fleet list and the overview.</div>`;
      ok = `<button class="btn pri" onclick="A.saveSvc()">Save</button>`;
    } else if (m.type === "chk") {
      const c = S.checks.find(x => x.id === m.id), v = X.veh(c.vehicleId);
      title = "Edit check · " + v.reg + " · " + fmtD(isoOf(c.at));
      body = `${field("odo", "Odometer reading (km)", 'inputmode="numeric"')}<div><label class="f">General remarks</label><textarea class="in" oninput="A.ff('remarks',this.value)">${esc(f.remarks || "")}</textarea></div><div class="xs muted">Checklist answers and the driver's signature can't be changed.</div>`;
      ok = `<button class="btn pri" onclick="A.saveChk()">Save changes</button>`;
    } else if (m.type === "imgs") {
      const c = S.checks.find(x => x.id === m.id), v = X.veh(c.vehicleId);
      title = "Images · " + v.reg + " · " + fmtD(isoOf(c.at));
      body = `<div class="gallery">${checkPhotos(c).map(x => `<figure><img src="/api/files/${x.p}" onclick="M.lightbox(this.src)" alt=""><figcaption>${esc(x.cap)}</figcaption></figure>`).join("")}</div>`;
      ok = `<a class="btn pri" href="#/check/${c.id}">Open check sheet</a>`;
    } else if (m.type === "staff") {
      title = m.id ? "Edit person" : "Add person";
      body = `<div class="grid g3" style="gap:12px">${field("name", "Full name *")}${sel("role", "Role", [["driver", "Driver"], ["mechanic", "Mechanic"], ["admin", "Transport office"]])}${field("title", "Job title", 'placeholder="e.g. Workshop manager"')}</div>
        <div class="grid g3" style="gap:12px">${field("phone", "Phone")}${field("licence", "Licence categories")}${field("pin", "PIN (4 digits) *", 'inputmode="numeric" maxlength="4"')}</div>`;
      ok = `${m.id && m.id !== me.id ? `<button class="btn ghost" style="color:var(--red);margin-right:auto" onclick="A.delStaff('${m.id}')">Remove</button>` : ""}<button class="btn pri" onclick="A.saveStaff()">${m.id ? "Save" : "Add person"}</button>`;
    }
    const an = m.fresh ? "anim" : "";
    return `<div class="scrim ${an}" onclick="A.close()"></div><div class="modal ${an}"><div class="mh"><h2 class="grow" style="font-size:18px">${title}</h2><button class="iconbtn" onclick="A.close()">${I("x", 20)}</button></div><div class="mb stack">${body}</div><div class="mf"><button class="btn" onclick="A.close()">${m.type === "imgs" ? "Close" : "Cancel"}</button>${ok}</div></div>`;
  }

  /* ---------- actions ---------- */
  const job = id => S.jobs.find(x => x.id === id);
  async function upload(input) {
    const f = input.files && input.files[0]; if (!f) return null;
    toast("Uploading…");
    try { const r = await Store.upload(f); toast("Uploaded"); return r; } catch (e) { toast(e.message); return null; }
  }
  const csvCell = s => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';

  window.A = {
    pinIn(el) {
      el.value = el.value.replace(/\D/g, "").slice(0, 4);
      $("#pinerr").textContent = "";
      if (el.value.length < 4) return;
      const p = X.person($("#who").value);
      if (p && p.pin === el.value) { me = p; lsSet("martleys-a-me", p.id); render(); }
      else { $("#pinerr").textContent = "Wrong PIN — try again."; el.value = ""; }
    },
    logout() { me = null; lsSet("martleys-a-me", null); go("#/"); render(); },
    set(k, v) { ui[k] = v; keep(render); },
    search(v) { ui.q = v; ui.page = 1; render(); const e = $("#q"); e.focus(); e.setSelectionRange(v.length, v.length); },
    jsearch(v) { ui.jq = v; render(); const e = $("#q"); e.focus(); e.setSelectionRange(v.length, v.length); },
    openCheck(id) { go("#/check/" + id); },
    close() { ui.modal = null; keep(render); },
    cf(k, v) { ui[k] = v; ui.page = 1; keep(render); },
    clearChecks() { Object.assign(ui, { cFrom: "", cTo: "", cVeh: "", cDrv: "", cRes: "", q: "", page: 1 }); keep(render); },
    sort(k) { ui.sort = ui.sort.k === k ? { k, dir: -ui.sort.dir } : { k, dir: k === "date" || k === "odo" || k === "result" ? -1 : 1 }; keep(render); },
    page(n) { ui.page = n; render(); const t = $("table.reg"); if (t) t.closest(".card").scrollIntoView({ block: "start" }); },
    per(n) { ui.per = Number(n); ui.page = 1; keep(render); },
    pdf(id) { sheetPage.printed = null; window.open("#/check/" + id + "?print=1", "_blank"); },
    imgs(id) { ui.modal = { type: "imgs", id, fresh: 1 }; keep(render); },
    svcModal(vid) { form = { serviceDue: X.veh(vid).serviceDue }; ui.modal = { type: "svc", id: vid, fresh: 1 }; keep(render); },
    saveSvc() { if (!form.serviceDue) return toast("Pick a date"); X.veh(ui.modal.id).serviceDue = form.serviceDue; save(); ui.modal = null; keep(render); toast("Service due date updated"); },
    chkModal(id) { const c = S.checks.find(x => x.id === id); form = { odo: c.odo, remarks: c.remarks || "" }; ui.modal = { type: "chk", id, fresh: 1 }; keep(render); },
    saveChk() {
      const c = S.checks.find(x => x.id === ui.modal.id);
      c.odo = Number(String(form.odo).replace(/\D/g, "")) || c.odo; c.remarks = String(form.remarks).trim();
      c.editedBy = me.id; c.editedAt = Date.now();
      save(); ui.modal = null; keep(render); toast("Check updated");
    },
    delCheck(id) {
      const c = S.checks.find(x => x.id === id), v = X.veh(c.vehicleId);
      if (!confirm("Delete the walk-around check on " + v.reg + " from " + fmtDT(c.at) + "? Job cards raised from it are kept.")) return;
      S.checks = S.checks.filter(x => x.id !== id); save(); ui.modal = null;
      if (route().name === "check") go("#/checks"); else keep(render);
      toast("Check deleted");
    },
    csv() {
      const rows = [["Date", "Time", "Ref", "Driver", "Fleet no", "Vehicle reg", "Service due", "Odometer", "General remarks", "Result", "Defects", "Images"]].concat(filteredChecks().map(c => { const v = X.veh(c.vehicleId); return [isoOf(c.at), fmtT(c.at), c.id, X.pname(c.driverId), v.fleet, v.reg, v.serviceDue, c.odo, c.remarks || "", M.outcome(c).label, M.defectsOf(c).map(([k, r]) => M.itemShort(k) + ": " + r.note).join(" | "), checkPhotos(c).length]; }));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" }));
      a.download = "martleys-walkaround-checks-" + today() + ".csv"; a.click();
    },

    jf(id, f, v) {
      const j = job(id); j[f] = v;
      save(); keep(render);
      if (f === "priority" && v === "VOR") toast(X.veh(j.vehicleId).fleet + " marked off road");
    },
    addTime(id) {
      const d = $("#l-date").value, a = $("#l-start").value, b = $("#l-end").value;
      if (!d || !a || !b) return toast("Enter a date, start and end time");
      const start = new Date(d + "T" + a).getTime(), end = new Date(d + "T" + b).getTime();
      if (end <= start) return toast("End must be after start");
      const j = job(id); j.labour = (j.labour || []).concat({ mechId: $("#l-mech").value, start, end });
      if (j.status === "Open") j.status = "In progress";
      if (!j.mechId) j.mechId = $("#l-mech").value;
      save(); keep(render); toast(mins((end - start) / 60000) + " added");
    },
    rmTime(id, i) { job(id).labour.splice(i, 1); save(); keep(render); },
    pickStock(sid) {
      const p = X.stockItem(sid); if (!p) return;
      $("#p-desc").value = p.desc; $("#p-no").value = p.partNo; $("#p-cost").value = p.cost; $("#p-qty").focus(); $("#p-qty").select();
    },
    addPart(id) {
      const desc = $("#p-desc").value.trim(); if (!desc) return toast("Enter a part description");
      const j = job(id), sid = $("#p-stock") && $("#p-stock").value, qty = Number($("#p-qty").value) || 1;
      const st = sid && X.stockItem(sid);
      const line = { desc, partNo: $("#p-no").value.trim(), qty, cost: Number(String($("#p-cost").value).replace(/[^\d.]/g, "")) || 0 };
      if (st && st.partNo === line.partNo) { line.stockId = st.id; M.takeStock(S, st.id, qty, j.id, me.id); }
      j.parts = (j.parts || []).concat(line);
      j.noParts = false; save(); keep(render);
      if (line.stockId) { const left = X.stockItem(line.stockId).qty; toast(left < 0 ? "Added — stock now shows " + left + ", check the shelf" : M.lowStock(st) ? "Added — only " + left + " left, time to reorder" : "Added · " + left + " left in stock"); }
    },
    rmPart(id, i) { const j = job(id); M.returnStock(S, j.parts[i], j.id, me.id); j.parts.splice(i, 1); save(); keep(render); },

    // schedule
    week(n) { ui.schedWeek = n === 0 ? M.weekStart(today()) : addDaysIso(ui.schedWeek, n * 7); keep(render); },
    drag(e, id) { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move"; },
    over(e) { e.preventDefault(); e.currentTarget.classList.add("hot"); },
    drop(e, mid, date) {
      e.preventDefault(); const j = job(e.dataTransfer.getData("text/plain")); if (!j) return;
      if (date === null) { if (!j.plan) return keep(render); delete j.plan; save(); keep(render); return toast("#" + j.id + " taken off the planner"); }
      j.plan = { date, hours: (j.plan && j.plan.hours) || 2 }; j.mechId = mid || null;
      save(); keep(render); toast("#" + j.id + " → " + (mid ? X.pname(mid).split(" ")[0] : "Unassigned") + ", " + fmtDay(date));
    },
    plan(id, k, v) {
      const j = job(id);
      if (k === "date" && !v) delete j.plan;
      else { j.plan = Object.assign({ date: today(), hours: 2 }, j.plan, { [k]: k === "hours" ? Math.max(0.5, Number(v) || 2) : v }); }
      save(); keep(render);
    },
    planModal(id) { const j = job(id); form = { date: (j.plan && j.plan.date) || today(), hours: (j.plan && j.plan.hours) || 2, mechId: j.mechId || "" }; ui.modal = { type: "plan", id, fresh: 1 }; keep(render); },
    savePlan() {
      if (!form.date) return toast("Pick a day"); const j = job(ui.modal.id);
      j.plan = { date: form.date, hours: Math.max(0.5, Number(form.hours) || 2) }; j.mechId = form.mechId || null;
      save(); ui.modal = null; keep(render); toast("Planned for " + fmtDay(form.date));
    },


    // customers
    csearch(v) { ui.custQ = v; render(); const e = $("#q"); e.focus(); e.setSelectionRange(v.length, v.length); },
    custModal(id) {
      const c = id && X.customer(id), back = ui.modal && ui.modal.type === "job" ? { ...form } : null;
      form = c ? { ...c } : { name: "", contact: "", phone: "", email: "", address: "" };
      ui.modal = { type: "cust", id, back, fresh: 1 }; keep(render);
    },
    saveCust() {
      if (!String(form.name).trim()) return toast("Enter the customer's name");
      const m = ui.modal, data = { name: form.name.trim(), contact: form.contact, phone: form.phone, email: form.email, address: form.address };
      let id = m.id;
      if (id) Object.assign(X.customer(id), data);
      else { id = "c-" + Date.now().toString(36); X.customers().push(Object.assign({ id, vehicles: [], notes: "", since: today() }, data)); }
      S.jobs.filter(j => j.customerId === id).forEach(j => { j.customer = data.name; });
      save();
      if (m.back) { form = Object.assign(m.back, { who: "ext", customerId: id, vehicleId: "__new" }); ui.modal = { type: "job" }; keep(render); }
      else { ui.modal = null; m.id ? keep(render) : go("#/customer/" + id); }
      toast("Customer saved");
    },
    custNote(id, v) { X.customer(id).notes = v; save(); toast("Notes saved"); },
    cvModal(cid) { form = { reg: "", model: "", type: "Minibus" }; ui.modal = { type: "cv", id: cid, fresh: 1 }; keep(render); },
    saveCv() {
      if (!String(form.reg).trim()) return toast("Enter the registration");
      const c = X.customer(ui.modal.id); c.vehicles = (c.vehicles || []).concat({ id: "cv-" + Date.now().toString(36), reg: form.reg.trim().toUpperCase(), model: form.model, type: form.type });
      save(); ui.modal = null; keep(render); toast("Vehicle added");
    },

    // parts & stock
    psearch(v) { ui.partQ = v; render(); const e = $("#q"); e.focus(); e.setSelectionRange(v.length, v.length); },
    stockModal(id) { const p = id && X.stockItem(id); form = p ? { ...p } : { partNo: "", desc: "", cat: "", loc: ui.partLoc || (X.locations()[0] || {}).id, bin: "", qty: 0, min: 1, cost: "", supplier: "" }; ui.modal = { type: "stock", id, fresh: 1 }; keep(render); },
    saveStock() {
      if (!String(form.partNo).trim() || !String(form.desc).trim()) return toast("Part no. and description are required");
      if (!form.loc) return toast("Add a stock place first");
      const data = { partNo: form.partNo.trim().toUpperCase(), desc: form.desc.trim(), cat: form.cat, loc: form.loc, bin: form.bin, qty: Number(form.qty) || 0, min: Number(form.min) || 0, cost: Number(form.cost) || 0, supplier: form.supplier };
      if (ui.modal.id) Object.assign(X.stockItem(ui.modal.id), data);
      else { if (X.stock().some(p => p.partNo === data.partNo)) return toast(data.partNo + " is already in stock — use Book in instead"); X.stock().push(Object.assign({ id: "st" + Date.now().toString(36) }, data)); if (data.qty) X.moves().unshift({ at: Date.now(), stockId: X.stock()[X.stock().length - 1].id, qty: data.qty, by: me.id, why: "Opening stock" }); }
      save(); ui.modal = null; keep(render); toast("Part saved");
    },
    delStock(id) { const p = X.stockItem(id); if (!confirm("Remove " + p.partNo + " " + p.desc + " from stock? Job cards that used it keep their part lines.")) return; S.settings.stock = X.stock().filter(x => x.id !== id); save(); ui.modal = null; keep(render); },
    adjModal(id) { const p = X.stockItem(id); form = { qty: "", why: "Delivery received", loc: p.loc, bin: p.bin }; ui.modal = { type: "adj", id, fresh: 1 }; keep(render); },
    saveAdj() {
      const p = X.stockItem(ui.modal.id), n = Number(form.qty) || 0, moving = form.why === "Moved to another place";
      if (!n && !moving) return toast("Enter how many to add or remove");
      if (n) { p.qty = Math.round((p.qty + n) * 100) / 100; X.moves().unshift({ at: Date.now(), stockId: p.id, qty: n, by: me.id, why: form.why }); }
      if (moving) { const from = X.loc(p.loc); p.loc = form.loc; p.bin = form.bin; X.moves().unshift({ at: Date.now(), stockId: p.id, qty: 0, by: me.id, why: "Moved from " + (from ? from.name : "?") + " to " + X.loc(form.loc).name }); }
      save(); ui.modal = null; keep(render); toast(p.partNo + " · " + p.qty + " on hand");
    },
    locModal(id) { const l = id && X.loc(id); form = l ? { ...l } : { name: "", note: "" }; ui.modal = { type: "loc", id, fresh: 1 }; keep(render); },
    saveLoc() {
      if (!String(form.name).trim()) return toast("Name the stock place");
      if (ui.modal.id) Object.assign(X.loc(ui.modal.id), { name: form.name.trim(), note: form.note });
      else X.locations().push({ id: "l" + Date.now().toString(36), name: form.name.trim(), note: form.note });
      save(); ui.modal = null; keep(render); toast("Stock place saved");
    },
    async jobPhoto(id, input) { const r = await upload(input); if (r) { const j = job(id); j.photos = (j.photos || []).concat(r.id); save(); keep(render); } },
    async docket(id, input) { const r = await upload(input); if (r) { job(id).docket = { id: r.id, name: r.name, type: r.type }; save(); keep(render); } },
    clearSig(k) { delete sigs[k]; keep(render); },
    complete(id) {
      const j = job(id);
      if (!(j.workDone || "").trim()) return toast("Add the work performed first");
      if (!$("#rw").checked) return toast("Confirm the vehicle is roadworthy");
      if (!sigs["job:" + id]) return toast("Sign to complete the job card");
      (j.labour || []).forEach(l => { if (!l.end) l.end = Date.now(); });
      Object.assign(j, { status: "Complete", closedAt: Date.now(), signedOffBy: $("#so-by").value, roadworthy: true, sig: sigs["job:" + id] });
      delete sigs["job:" + id];
      save(); keep(render);
      toast(j.priority === "VOR" ? X.veh(j.vehicleId).fleet + " is back in service" : "Job card completed");
    },
    reopen(id) { Object.assign(job(id), { status: "In progress", closedAt: null, signedOffBy: null, roadworthy: false, sig: null }); save(); keep(render); },

    ff(k, v) { form[k] = v; },
    ffr(k, v) { form[k] = v; if (k === "customerId" || k === "who") form.vehicleId = ""; keep(render); },
    newJob(vid, cid, cvid) {
      const ext = cid && cid !== M.INTERNAL;
      form = { who: ext ? "ext" : "fleet", customerId: ext ? cid : "", vehicleId: (ext ? cvid : vid) || "", type: ext ? "Service" : "Service", priority: "Normal", mechId: "", title: "", desc: "", newReg: "", newModel: "", newType: "Minibus", planDate: "", planHours: "" };
      ui.modal = { type: "job", fresh: 1 }; keep(render);
    },
    saveJob() {
      const ext = form.who === "ext", c = ext && X.customer(form.customerId);
      if (ext && !c) return toast("Choose the customer");
      if (!form.vehicleId) return toast("Choose a vehicle");
      if (form.vehicleId === "__new" && !String(form.newReg).trim()) return toast("Enter the vehicle registration");
      if (!String(form.title).trim()) return toast("Give the job a title");
      let vehicleId = form.vehicleId;
      if (vehicleId === "__new") { vehicleId = "cv-" + Date.now().toString(36); c.vehicles = (c.vehicles || []).concat({ id: vehicleId, reg: form.newReg.trim().toUpperCase(), model: form.newModel, type: form.newType }); }
      const id = X.nextJobId();
      S.jobs.push({ id, vehicleId, type: form.type, customerId: ext ? c.id : M.INTERNAL, customer: ext ? c.name : "Martley's fleet", status: "Open", priority: form.priority, mechId: form.mechId || null, title: form.title.trim(), desc: form.desc, created: Date.now(), labour: [], rate: (S.settings || {}).rate || 55, parts: [], noParts: false, partsNotes: "", workDone: "", photos: [], docket: null, reportedBy: me.id,
        ...(form.planDate ? { plan: { date: form.planDate, hours: Math.max(0.5, Number(form.planHours) || 2) } } : {}) });
      save(); ui.modal = null; go("#/job/" + id); toast("Job #" + id + " created");
    },
    vehModal(id) { const v = id ? X.veh(id) : null; form = v ? { ...v } : { fleet: "", reg: "", model: "", type: "Coach", seats: 49, odo: 0, cvrtDue: addDaysIso(today(), 365), serviceDue: addDaysIso(today(), 90) }; ui.modal = { type: "veh", id, fresh: 1 }; keep(render); },
    saveVeh() {
      if (!String(form.fleet).trim() || !String(form.reg).trim()) return toast("Fleet number and registration are required");
      const data = { ...form, fleet: form.fleet.trim().toUpperCase(), reg: form.reg.trim().toUpperCase(), seats: Number(form.seats) || 0, odo: Number(form.odo) || 0 };
      if (ui.modal.id) Object.assign(X.veh(ui.modal.id), data);
      else {
        if (S.vehicles.some(v => v.fleet === data.fleet)) return toast("Fleet number " + data.fleet + " is already used");
        S.vehicles.push(Object.assign(data, { id: data.fleet.toLowerCase().replace(/\W/g, ""), depot: "Kilminchy, Portlaoise", trailer: false }));
      }
      save(); ui.modal = null; keep(render); toast("Vehicle saved");
    },
    staffModal(id) { const p = id ? X.person(id) : null; form = p ? { ...p } : { name: "", role: "driver", phone: "", licence: "", pin: "" }; ui.modal = { type: "staff", id, fresh: 1 }; keep(render); },
    saveStaff() {
      if (!String(form.name).trim()) return toast("Enter a name");
      if (!/^\d{4}$/.test(form.pin)) return toast("PIN must be 4 digits");
      if (ui.modal.id) Object.assign(X.person(ui.modal.id), form, { name: form.name.trim() });
      else S.staff.push(Object.assign({}, form, { id: "s" + Date.now().toString(36), name: form.name.trim(), joined: today() }));
      save(); ui.modal = null; keep(render); toast("Saved");
    },
    delStaff(id) { if (!confirm("Remove " + X.pname(id) + "? Their past checks and job cards are kept.")) return; S.staff = S.staff.filter(s => s.id !== id); save(); ui.modal = null; keep(render); },
    setting(k, v) { S.settings = Object.assign({}, S.settings, { [k]: v }); save(); toast("Saved"); },
  };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && ui.modal) A.close(); });

  /* ---------- boot ---------- */
  (async function boot() {
    render();
    try { S = await Store.load(); } catch (e) { $("#app").innerHTML = `<div class="empty" style="padding-top:40vh">Can't reach the server. Refresh to try again.</div>`; return; }
    X = M.api(S);
    if (M.migrate(S)) Store.sync(S);
    const id = lsGet("martleys-a-me"); me = id ? X.person(id) : null;
    if (me && me.role !== "admin") me = null;
    render();
    Store.onError(() => toast("Couldn't save — check your connection"));
    const busy = () => { const a = document.activeElement; return ui.modal || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) || Object.keys(sigs).length > 0; };
    // keep the workshop screen's clock ticking
    setInterval(() => { const n = document.getElementById("tvnow"); if (n) n.textContent = fmtT(Date.now()); }, 10000);
    Store.poll(busy, s => { S = s; X = M.api(S); keep(render); });
  })();
})();
