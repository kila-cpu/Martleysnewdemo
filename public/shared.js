// Shared by the phone app (drivers & mechanics) and the desktop admin:
// the walk-around checklist, job sheet maths, formatting and small UI helpers.
window.M = (function () {
  "use strict";

  /* ---------- icons ---------- */
  const P = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    checks: '<path d="m2 12 5 5L18 6M13 17l1 0L22 8"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11l2 2 4-4M9 17h6"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    bus: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 18v3M16 18v3"/><circle cx="8" cy="14.5" r=".8"/><circle cx="16" cy="14.5" r=".8"/>',
    alert: '<path d="M12 3 2 20h20zM12 10v4M12 17.5v.01"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
    box: '<path d="m3 7 9-4 9 4v10l-9 4-9-4z"/><path d="m3 7 9 4 9-4M12 11v10"/>',
    note: '<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8 9h8M8 13h5"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    euro: '<path d="M17 6.5A7 7 0 1 0 17 17.5M4 10h9M4 14h9"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
    gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 14 4-5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    tv: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  };
  const I = (n, s = 18, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;

  /* ---------- the walk-around checklist ----------
     Grouped under the sections of the RSA / HSA "Bus & PSV Driver Walkaround Checks" poster.
     Items from the client's current check sheet keep their exact wording; poster items are
     added wherever the sheet doesn't already cover them. Items flagged `trailer` start as N/A
     on vehicles without a trailer; `na` allows N/A ("if fitted"); `only` limits an item to
     vehicle types. */
  const SECTIONS = [
    { key: "cab", name: "In Cab Checks", items: [
      ["visibility", "Good visibility for driver through cab windows and mirrors. All required mirrors fitted and adjusted correctly."],
      ["controls", "Driving controls, seat and driver safety belt adjusted correctly."],
      ["washers", "Windscreen washer, wipers, demister and horn operating correctly"],
      ["heater", "Heater / demister working properly"],
      ["tacho", "Tachograph calibrated with correct hours. Speed limiter plaque displayed.", { na: 1 }],
      ["gauges", "All instruments, gauges and other warning devices operating correctly (including ABS/EBS in-cab warning lights)"],
      ["air", "No air leaks or pressure drop"],
      ["cab", "Is the dash and the cab free from rubbish?"],
    ] },
    { key: "ext", name: "External Checks", items: [
      ["square", "Vehicle sitting square and not leaning to one side"],
      ["discs", "Tax, insurance and transport discs (if applicable) present and valid. Number plates clearly visible."],
      ["exhaust", "Exhaust secure with no excess noise or smoke."],
      ["levels", "Engine oil, water, windscreen washer reservoir and fuel levels checked and no leaks"],
      ["fuelcutoff", "Fuel cut off clearly marked & accessible"],
      ["fuelcap", "Fuel cap seal: in place, in good condition & no leaks"],
      ["luggagedoor", "Luggage door secure", { na: 1 }],
      ["body", "Vehicle body / wings / guards, side and rear / curtains and straps / doors / tail lift in good condition."],
      ["airsusp", "Air suspension correctly set."],
      ["suzies", "Air & electrical suzies and connectors fitted correctly (inc. ABS / EBS cable).", { trailer: 1 }],
      ["fifth", "Fifth wheel located and locked correctly, landing legs and handle in correct position.", { trailer: 1 }],
      ["trailerbrake", "Trailer park brake operating correctly", { trailer: 1 }],
    ] },
    { key: "tyres", name: "Wheels & Tyres", items: [
      ["wheels", "Wheels in good condition and secure. Tyres undamaged with correct inflation and tread depth."],
      ["nutindicators", "Wheel nut indicators correctly aligned (if fitted)", { na: 1 }],
      ["wheelnuts", "Road wheel nuts all in place, correctly fitted & secure"],
    ] },
    { key: "lights", name: "Lights, Indicators & Reflectors", items: [
      ["lights", "All lights, reflectors and markings fitted, clean and in good condition."],
      ["lightswork", "All lights & indicators working and the correct colour"],
    ] },
    { key: "glass", name: "Windows & Mirrors", items: [
      ["windows", "Windscreen & side windows clean & in good condition"],
      ["view", "View not obstructed, e.g. by stickers, etc."],
      ["mirrors", "Mirrors clean, in good condition & correctly aligned"],
      ["elecmirror", "Correct operation of electrical mirror (if fitted)", { na: 1 }],
    ] },
    { key: "access", name: "Vehicle Access", items: [
      ["access", "Vehicle access, steps, catwalk or drawbar coupling in good condition"],
      ["steps", "Steps undamaged, clean & with a good unworn surface"],
      ["handholds", "Good handholds"],
      ["door", "Passenger door working properly"],
    ] },
    { key: "psv", name: "Internal PSV Checks", items: [
      ["extinguisher", "Fire extinguisher in place, fully charged & in date"],
      ["firstaid", "First aid kit in place & in date"],
      ["seatbelts", "Passenger safety belts working (if fitted)", { na: 1 }],
      ["seats", "Seats & handrails in good condition"],
      ["walkways", "All walkways clear"],
      ["intlights", "Internal lighting working & luggage racks in good condition"],
      ["hammer", "Emergency exit hammer in place (if fitted)", { na: 1 }],
      ["buzzer", "Emergency door warning buzzer working (if fitted)", { na: 1 }],
      ["exits", "Emergency exit doors & signs"],
      ["lift", "Wheelchair lift / ramp deploys and stows; restraints present", { only: ["Accessible minibus"] }],
      ["schoolsigns", "School bus signs displayed front and rear", { only: ["School bus"] }],
    ] },
    { key: "dep", name: "Prior to leaving Depot", items: [
      ["steerbrakes", "Steering and brakes operating correctly."],
      ["loads", "Loads secured and weight distributed correctly."],
    ] },
    { key: "road", name: "On-the-Road", items: [
      ["tachoroad", "Tachograph, speedometer and speed limiter operating correctly.", { na: 1 }],
      ["abs", "ABS/EBS warning lights off"],
    ] },
  ];
  function sectionsFor(v) {
    return SECTIONS.map(s => ({
      key: s.key, name: s.name,
      items: s.items.filter(it => !(it[2] && it[2].only) || it[2].only.includes(v.type))
        .map(([key, label, o]) => ({ key, label, na: !!(o && (o.na || o.trailer)), trailer: !!(o && o.trailer) })),
    })).filter(s => s.items.length);
  }
  const ITEM = {};
  SECTIONS.forEach(s => s.items.forEach(([key, label]) => { ITEM[key] = { label, section: s.name }; }));
  const itemLabel = k => (ITEM[k] && ITEM[k].label) || (k === "other" ? "Other" : k);
  // Short names for job card titles and tables (the full wording is long).
  const SHORT = {
    visibility: "Visibility & mirrors", controls: "Controls, seat & belt", washers: "Washers, wipers & horn", heater: "Heater / demister",
    tacho: "Tachograph calibration", gauges: "Instruments & warning lights", air: "Air leaks", cab: "Cab cleanliness",
    square: "Vehicle sitting square", discs: "Discs & number plates", exhaust: "Exhaust", levels: "Fluid levels & leaks",
    fuelcutoff: "Fuel cut off", fuelcap: "Fuel cap seal", luggagedoor: "Luggage door", body: "Bodywork & doors", airsusp: "Air suspension",
    suzies: "Suzies & connectors", fifth: "Fifth wheel", trailerbrake: "Trailer park brake",
    wheels: "Wheels & tyres", nutindicators: "Wheel nut indicators", wheelnuts: "Wheel nuts",
    lights: "Lights & reflectors", lightswork: "Lights & indicators", windows: "Windows", view: "View obstructed", mirrors: "Mirrors", elecmirror: "Electric mirror",
    access: "Access & steps", steps: "Steps", handholds: "Handholds", door: "Passenger door",
    extinguisher: "Fire extinguisher", firstaid: "First aid kit", seatbelts: "Passenger seatbelts", seats: "Seats & handrails", walkways: "Walkways",
    intlights: "Internal lighting & racks", hammer: "Emergency hammer", buzzer: "Emergency door buzzer", exits: "Emergency exits", lift: "Wheelchair lift",
    schoolsigns: "School bus signs", steerbrakes: "Steering & brakes", loads: "Loads secured", tachoroad: "Tacho & speed limiter", abs: "ABS/EBS lights",
  };
  const itemShort = k => SHORT[k] || itemLabel(k);

  const JOB_TYPES = ["Defect repair", "Service", "CVRT prep", "Labour", "Warranty", "Installation"];
  const STATUSES = ["Open", "In progress", "Awaiting parts", "Complete"];
  const PRIORITIES = ["VOR", "High", "Normal"];
  const ROLE = { driver: "Driver", mechanic: "Mechanic", admin: "Transport office" };

  /* ---------- formatting ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const isoOf = d => { const x = new Date(d); return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); };
  const today = () => isoOf(Date.now());
  const addDaysIso = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return isoOf(new Date(y, m - 1, d + n)); };
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtD = iso => { if (!iso) return "—"; const [y, m, d] = iso.split("-").map(Number); return d + " " + MON[m - 1] + " " + y; };
  const fmtDay = iso => { const [y, m, d] = iso.split("-").map(Number); const dt = new Date(y, m - 1, d); return iso === today() ? "Today" : iso === addDaysIso(today(), -1) ? "Yesterday" : DOW[dt.getDay()] + " " + d + " " + MON[m - 1]; };
  const fmtT = ts => { const d = new Date(ts); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  const fmtDT = ts => fmtDay(isoOf(ts)) + ", " + fmtT(ts);
  const daysUntil = iso => { const [y, m, d] = iso.split("-").map(Number); const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(y, m - 1, d) - t) / 864e5); };
  const km = n => (Number(n) || 0).toLocaleString("en-IE") + " km";
  const eur = n => "€" + (Number(n) || 0).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mins = m => { m = Math.max(0, Math.round(m)); return m >= 60 ? Math.floor(m / 60) + "h " + pad(m % 60) + "m" : m + "m"; };
  const hrs = m => (Math.round(m / 6) / 10).toFixed(1) + "h";
  const initials = n => String(n || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();

  /* ---------- domain logic (all derived, nothing cached) ---------- */
  /* ---------- customers, parts stock, workshop schedule ----------
     Customers and the parts stock live inside the `settings` value so they
     sync through the existing /api/kv/settings route with no backend change.
     When the server gets its own customers / stock collections, move them to
     Store's COLLS and drop these accessors. */
  const INTERNAL = "martleys";
  const customersOf = S => { S.settings = S.settings || {}; return (S.settings.customers = S.settings.customers || []); };
  const stockOf = S => { S.settings = S.settings || {}; return (S.settings.stock = S.settings.stock || []); };
  const locationsOf = S => { S.settings = S.settings || {}; return (S.settings.locations = S.settings.locations || []); };
  const movesOf = S => { S.settings = S.settings || {}; return (S.settings.moves = S.settings.moves || []); };
  const isExternal = j => !!j && !!j.customerId && j.customerId !== INTERNAL;
  const lowStock = p => (Number(p.qty) || 0) <= (Number(p.min) || 0);
  const stockPill = p => (Number(p.qty) || 0) <= 0 ? pill("red", "Out of stock") : lowStock(p) ? pill("amber", "Low · reorder") : pill("green", "In stock");
  // Monday of the week containing iso
  const weekStart = iso => { const [y, m, d] = iso.split("-").map(Number); const dt = new Date(y, m - 1, d); return addDaysIso(iso, -((dt.getDay() + 6) % 7)); };

  // Take parts out of stock for a job line, or put them back when the line is removed.
  function takeStock(S, stockId, qty, jobId, by) {
    const p = stockOf(S).find(x => x.id === stockId); if (!p) return null;
    p.qty = Math.round(((Number(p.qty) || 0) - qty) * 100) / 100;
    movesOf(S).unshift({ at: Date.now(), stockId, qty: -qty, jobId, by, why: "Used on job" });
    S.settings.moves = S.settings.moves.slice(0, 300);
    return p;
  }
  function returnStock(S, part, jobId, by) {
    if (!part || !part.stockId) return;
    const p = stockOf(S).find(x => x.id === part.stockId); if (!p) return;
    p.qty = Math.round(((Number(p.qty) || 0) + (Number(part.qty) || 0)) * 100) / 100;
    movesOf(S).unshift({ at: Date.now(), stockId: p.id, qty: Number(part.qty) || 0, jobId, by, why: "Returned from job" });
  }

  // Data set-up, run once per step. Returns true if it changed S.
  function migrate(S) { const a = migrate1(S), b = migrate2(S); return a || b; }

  // Step 2: past outside-customer work, so the mobile Customer History has a record to show.
  function migrate2(S) {
    S.settings = S.settings || {};
    if (!(S.settings.workshopV >= 1) || S.settings.workshopV >= 2) return false;
    const at = (iso, h) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d, h || 9).getTime(); };
    const cs = customersOf(S), nameOf = id => (cs.find(c => c.id === id) || {}).name || "";
    const sp = id => { const p = stockOf(S).find(x => x.id === id); return p ? { desc: p.desc, partNo: p.partNo, cost: p.cost, stockId: p.id } : null; };
    const part = (id, qty, desc, partNo, cost) => Object.assign(sp(id) || { desc, partNo, cost }, { qty });
    [
      ["2025-288", "c-dun", "cv-1", "Defect repair", "Heater blower not working", "Blower stops on speeds 1–3.", "kd", "2025-11-18", 2.5, "Blower resistor pack failed. Replaced resistor and checked all four speeds. Cleaned pollen filter housing.", [part(null, 1, "Blower resistor pack — Sprinter", "MB-A9068", 46)]],
      ["2026-031", "c-dun", "cv-2", "Service", "A service — 180,000 km", "", "lc", "2026-02-10", 3, "A service to schedule. Oil and filters changed, brakes checked (front pads 6mm, rear 8mm). Wipers OK.", [part("st12", 12), part("st6", 1)]],
      ["2026-084", "c-dun", "cv-1", "CVRT prep", "CVRT pre-test inspection", "Test booked Thursday.", "kd", "2026-05-06", 3.5, "Pre-test inspection. Replaced two marker lamps and a number plate lamp, adjusted headlamp aim. Passed CVRT 07/05.", [part("st3", 2), part("st2", 1)]],
      ["2026-129", "c-dun", "cv-3", "Labour", "Fit new seat belts to rows 4–5", "", "lc", "2026-08-21", 2, "Fitted four new lap belt buckle assemblies on rows 4 and 5. Torqued to spec and tested.", [part("st9", 4)]],
      ["2025-301", "c-omh", "cv-4", "CVRT prep", "CVRT pre-test inspection", "PO 4120.", "lc", "2025-12-02", 4, "Pre-test. Replaced rear fog lamp lens, topped up AdBlue, fixed air leak on trailer coupling. Passed.", [part("st13", 1), part(null, 1, "Rear fog lamp lens", "DAF-FOG-R", 18)]],
      ["2026-052", "c-omh", "cv-5", "Defect repair", "Air leak — rear suspension", "Driver reports truck sitting low on nearside rear overnight.", "kd", "2026-03-17", 3, "Nearside rear air bag perished. Replaced air bag and checked levelling valve. No further leaks after 2h test.", [part(null, 1, "Air spring bellows — Scania rear", "SC-1730", 212)]],
      ["2026-118", "c-omh", "cv-4", "Service", "B service — 240,000 km", "", "lc", "2026-07-29", 5, "B service. Oil, fuel and air filters changed. Front pads replaced. Greased all points.", [part("st12", 22), part("st4", 1), part("st5", 1), part("st7", 1)]],
      ["2026-001", "c-hst", "cv-6", "Defect repair", "Wheelchair lift slow to raise", "", "kd", "2026-01-13", 2, "Lift hydraulic fluid low. Topped up, bled system and lubricated hinges. Lift cycling normally.", [part(null, 1, "Hydraulic fluid HV46 (litre)", "HV46-1", 9)]],
      ["2026-123", "c-hst", "cv-6", "Service", "Summer service before school year", "Must be ready for 1 September.", "lc", "2026-08-12", 4.5, "Full service before the school year. Two new front tyres fitted, all seat belts checked, first aid kit and fire extinguisher in date.", [part("st12", 8), part("st16", 2)]],
    ].forEach(([id, cust, veh, type, title, desc, mech, date, hours, workDone, parts]) => {
      if (S.jobs.some(j => j.id === id)) return;
      const start = at(date, 9), end = start + hours * 36e5;
      S.jobs.push({ id, customerId: cust, customer: nameOf(cust), vehicleId: veh, type, title, desc, status: "Complete", priority: "Normal", mechId: mech, created: at(date, 8) - 864e5, closedAt: end, signedOffBy: mech, roadworthy: true,
        labour: [{ mechId: mech, start, end }], rate: S.settings.rate || 55, parts, noParts: false, partsNotes: "", workDone, photos: [], docket: null, reportedBy: "lm", plan: { date, hours } });
    });
    S.settings.workshopV = 2;
    return true;
  }

  // Step 1: the workshop features (Leanne, customers, stock, external job cards, the week's schedule).
  function migrate1(S) {
    S.settings = S.settings || {};
    if (S.settings.workshopV >= 1) return false;
    const t = today(), wk = weekStart(t), at = (iso, h) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d, h || 9).getTime(); };
    const day = n => addDaysIso(wk, n);   // 0 = Monday this week

    if (!S.staff.some(s => /^leanne/i.test(s.name))) S.staff.push({ id: "lm", name: "Leanne", role: "admin", title: "Workshop manager", pin: "3333", phone: "087 455 2019", joined: addDaysIso(t, -21) });

    const locs = locationsOf(S);
    if (!locs.length) locs.push(
      { id: "ra", name: "Rack A", note: "Filters, belts & service parts" }, { id: "rb", name: "Rack B", note: "Electrical, lamps & switches" },
      { id: "rc", name: "Rack C", note: "Body, glass & interior" }, { id: "oil", name: "Oil store", note: "Bulk oils, AdBlue & fluids" },
      { id: "tyre", name: "Tyre bay", note: "Coach & minibus tyres" }, { id: "cab", name: "Bay 2 cabinet", note: "Small fixings & consumables" });

    const stock = stockOf(S);
    if (!stock.length) [
      ["VB-21876", "Door micro-switch", "Electrical", "rb", "B2-04", 3, 2, 18.5, "Volvo Bus Parts"],
      ["H7-24", "Headlamp bulb H7 24V", "Electrical", "rb", "B1-01", 14, 10, 6.4, "Lamp Supplies"],
      ["LED-MKR", "LED side marker lamp, amber", "Electrical", "rb", "B1-06", 4, 4, 12.9, "Lamp Supplies"],
      ["VO-21707132", "Oil filter — Volvo D13", "Service", "ra", "A1-02", 6, 4, 24.6, "Volvo Bus Parts"],
      ["VO-21479498", "Fuel filter kit — Volvo D13", "Service", "ra", "A1-03", 2, 3, 48.0, "Volvo Bus Parts"],
      ["MB-AIR-0028", "Air filter element — Sprinter", "Service", "ra", "A2-01", 5, 2, 31.5, "Mercedes Commercial"],
      ["PAD-CF-22", "Brake pad set, front axle (coach)", "Brakes", "ra", "A3-02", 3, 2, 168.0, "Knorr-Bremse"],
      ["PAD-SPR-F", "Brake pad set, front — Sprinter", "Brakes", "ra", "A3-04", 1, 2, 74.0, "Mercedes Commercial"],
      ["SB-LB-2PT", "Lap belt buckle assembly", "Interior", "rc", "C2-03", 6, 4, 38.0, "Coach Seating Ltd"],
      ["VDL-1452", "Washer jet", "Body", "rc", "C1-05", 8, 3, 9.8, "VDL Parts"],
      ["WB-24-700", "Wiper blade 700mm", "Body", "rc", "C1-01", 0, 4, 21.5, "VDL Parts"],
      ["OIL-1040", "Engine oil 10W-40 (litre)", "Fluids", "oil", "Drum 1", 186, 60, 4.2, "Fleet Lubes"],
      ["ADB-10", "AdBlue 10L", "Fluids", "oil", "Shelf 2", 9, 6, 14.0, "Fleet Lubes"],
      ["MI-295-XZ", "Michelin X Coach Z 295/80 R22.5", "Tyres", "tyre", "Stack 1", 4, 2, 486.0, "Laois Tyre Centre"],
      ["BS-295-R", "Bridgestone R-Steer 295/80 R22.5", "Tyres", "tyre", "Stack 2", 2, 2, 455.0, "Laois Tyre Centre"],
      ["CT-235-65", "Van tyre 235/65 R16C", "Tyres", "tyre", "Stack 4", 6, 4, 132.0, "Laois Tyre Centre"],
      ["HW-12", "Hard-wire kit", "Electrical", "cab", "Drawer 3", 3, 1, 24.0, "Lamp Supplies"],
      ["CT-FIX", "Cable ties, assorted (bag)", "Consumables", "cab", "Drawer 1", 11, 5, 3.5, "Fleet Lubes"],
    ].forEach(([partNo, desc, cat, loc, bin, qty, min, cost, supplier], i) => stock.push({ id: "st" + (i + 1), partNo, desc, cat, loc, bin, qty, min, cost, supplier }));
    // link the parts already on job cards to their stock lines
    S.jobs.forEach(j => (j.parts || []).forEach(p => { const s = stock.find(x => x.partNo && x.partNo === p.partNo); if (s && !p.stockId) p.stockId = s.id; }));

    const cs = customersOf(S);
    if (!cs.length) cs.push(
      { id: INTERNAL, name: "Martley's fleet", internal: true, contact: "Transport office", phone: "057 862 0888", email: "info@martleys.com", address: "Kilminchy, Dublin Road, Portlaoise", vehicles: [], notes: "Internal work on Martley's own coaches, buses and minibuses.", since: "2008-01-01" },
      { id: "c-dun", name: "Dunamase Hackney & Tours", contact: "Ger Lalor", phone: "086 201 7734", email: "ger@dunamasetours.ie", address: "Main Street, Stradbally, Co. Laois", terms: "30 days", since: "2023-03-14",
        notes: "Two Sprinters and a Ford Transit. Prefers Saturday morning drop-offs. Invoice to accounts@ address.",
        vehicles: [{ id: "cv-1", reg: "221-LS-4410", model: "Mercedes Sprinter 519", type: "Minibus" }, { id: "cv-2", reg: "191-LS-882", model: "Mercedes Sprinter 516", type: "Minibus" }, { id: "cv-3", reg: "202-KE-1170", model: "Ford Transit 17-seat", type: "Minibus" }] },
      { id: "c-omh", name: "O'Moore Haulage Ltd", contact: "Siobhán Moore", phone: "057 868 3321", email: "workshop@omoorehaulage.ie", address: "Togher Industrial Estate, Portlaoise", terms: "30 days", since: "2024-06-02",
        notes: "Rigid trucks — CVRT prep and brake work only. PO number required on every invoice.",
        vehicles: [{ id: "cv-4", reg: "182-LS-2290", model: "DAF LF 220", type: "Rigid truck" }, { id: "cv-5", reg: "211-LS-905", model: "Scania P280", type: "Rigid truck" }] },
      { id: "c-hst", name: "Heywood School Transport", contact: "Declan Phelan", phone: "087 663 1408", email: "declan@heywoodtransport.ie", address: "Ballinakill, Co. Laois", terms: "14 days", since: "2025-09-01",
        notes: "School runs Mon–Fri — work must be done outside 8–9:30am and 2:30–4pm.",
        vehicles: [{ id: "cv-6", reg: "171-LS-3318", model: "Iveco Daily 33-seat", type: "School bus" }] },
      { id: "c-pd", name: "Pat Dooley", contact: "Pat Dooley", phone: "085 140 2276", email: "", address: "Mountrath, Co. Laois", terms: "On collection", since: addDaysIso(t, -9),
        notes: "Private customer — campervan conversion.", vehicles: [{ id: "cv-7", reg: "08-LS-3141", model: "VW Crafter campervan", type: "Van" }] });

    S.jobs.forEach(j => { if (!j.customerId) { j.customerId = INTERNAL; j.customer = "Martley's fleet"; } });

    // a few outside-customer job cards so the demo has something to show
    const mk = (o) => { const id = new Date().getFullYear() + "-" + (S.nextJ = (S.nextJ || 200) + 1); S.jobs.push(Object.assign({ id, status: "Open", priority: "Normal", mechId: null, desc: "", labour: [], rate: S.settings.rate || 55, parts: [], noParts: false, partsNotes: "", workDone: "", photos: [], docket: null, reportedBy: "lm" }, o, { id })); return id; };
    const nameOf = id => cs.find(c => c.id === id).name;
    if (!S.jobs.some(j => isExternal(j))) {
      mk({ customerId: "c-dun", customer: nameOf("c-dun"), vehicleId: "cv-1", type: "Service", title: "B service + front brake pads", desc: "Customer reports squeal from front brakes. Full B service due.", mechId: "kd", status: "In progress", created: at(addDaysIso(t, -1), 8), plan: { date: t, hours: 5 },
        labour: [{ mechId: "kd", start: at(t, 8) + 30 * 6e4, end: at(t, 10) + 15 * 6e4 }], parts: [{ desc: "Brake pad set, front — Sprinter", partNo: "PAD-SPR-F", qty: 1, cost: 74, stockId: "st8" }, { desc: "Air filter element — Sprinter", partNo: "MB-AIR-0028", qty: 1, cost: 31.5, stockId: "st6" }] });
      mk({ customerId: "c-omh", customer: nameOf("c-omh"), vehicleId: "cv-4", type: "CVRT prep", title: "CVRT pre-test inspection", desc: "Test booked at Portlaoise CVRT centre Friday. PO 4471.", mechId: "lc", created: at(addDaysIso(t, -2), 15), plan: { date: addDaysIso(t, 1), hours: 4 } });
      mk({ customerId: "c-hst", customer: nameOf("c-hst"), vehicleId: "cv-6", type: "Defect repair", title: "Wheelchair lift intermittent", desc: "Lift stops halfway on the way down. Needs to be back for the 2:30 school run.", priority: "High", mechId: "lc", created: at(t, 7), plan: { date: t, hours: 2 } });
      mk({ customerId: "c-pd", customer: nameOf("c-pd"), vehicleId: "cv-7", type: "Installation", title: "Fit leisure battery + split charge relay", mechId: null, created: at(addDaysIso(t, -1), 11), status: "Awaiting parts", partsNotes: "Relay on order from Lamp Supplies — due Thursday." });
      const done = mk({ customerId: "c-dun", customer: nameOf("c-dun"), vehicleId: "cv-3", type: "Defect repair", title: "Replace wiper blades & washer jets", mechId: "kd", status: "Complete", created: at(addDaysIso(t, -8), 9), closedAt: at(addDaysIso(t, -7), 12), signedOffBy: "kd", roadworthy: true,
        workDone: "Replaced both wiper blades and the nearside washer jet. Washer system tested OK.", labour: [{ mechId: "kd", start: at(addDaysIso(t, -7), 10), end: at(addDaysIso(t, -7), 11) + 15 * 6e4 }],
        parts: [{ desc: "Wiper blade 700mm", partNo: "WB-24-700", qty: 2, cost: 21.5, stockId: "st11" }, { desc: "Washer jet", partNo: "VDL-1452", qty: 1, cost: 9.8, stockId: "st10" }], plan: { date: addDaysIso(t, -7), hours: 1.5 } });
      const done2 = mk({ customerId: "c-omh", customer: nameOf("c-omh"), vehicleId: "cv-5", type: "Service", title: "A service — 30,000 km", mechId: "lc", status: "Complete", created: at(addDaysIso(t, -14), 9), closedAt: at(addDaysIso(t, -13), 16), signedOffBy: "lc", roadworthy: true,
        workDone: "A service carried out to schedule. Oil and filter changed, all levels topped up.", labour: [{ mechId: "lc", start: at(addDaysIso(t, -13), 9), end: at(addDaysIso(t, -13), 12) + 30 * 6e4 }],
        parts: [{ desc: "Engine oil 10W-40 (litre)", partNo: "OIL-1040", qty: 28, cost: 4.2, stockId: "st12" }], plan: { date: addDaysIso(t, -13), hours: 3.5 } });
    }

    // put this week's open fleet work on the planner
    const slots = [[0, 3], [1, 2.5], [2, 4], [1, 1.5], [3, 6], [4, 2]];
    S.jobs.filter(j => j.status !== "Complete" && !j.plan && !isExternal(j) && j.mechId).forEach((j, i) => { const s = slots[i % slots.length]; const d = addDaysIso(t, s[0] % 3); j.plan = { date: d, hours: s[1] }; });
    S.settings.workshopV = 1;
    return true;
  }

  function api(S) {
    const fleetVeh = id => S.vehicles.find(v => v.id === id);
    // Outside customers' vehicles look like fleet vehicles to the screens, flagged external.
    const extVeh = id => {
      for (const c of customersOf(S)) { const v = (c.vehicles || []).find(x => x.id === id); if (v) return Object.assign({ odo: 0, seats: 0, serviceDue: null, cvrtDue: null }, v, { fleet: "EXT", external: true, customerId: c.id, customerName: c.name }); }
      return null;
    };
    const veh = id => fleetVeh(id) || extVeh(id);
    const customer = id => customersOf(S).find(c => c.id === id);
    const custOf = j => customer(j.customerId || INTERNAL) || { id: INTERNAL, name: j.customer || "Martley's fleet", internal: true };
    const custJobs = c => S.jobs.filter(j => (j.customerId || INTERNAL) === c.id);
    const stockItem = id => stockOf(S).find(p => p.id === id);
    const loc = id => locationsOf(S).find(l => l.id === id);
    const person = id => S.staff.find(s => s.id === id);
    const pname = id => (person(id) || { name: "—" }).name;
    const openJobs = v => S.jobs.filter(j => j.vehicleId === v.id && j.status !== "Complete");
    // A vehicle is off the road while it has an open VOR job card.
    const vorJob = v => openJobs(v).find(j => j.priority === "VOR");
    const checksOn = iso => S.checks.filter(c => isoOf(c.at) === iso);
    const checkedToday = v => checksOn(today()).find(c => c.vehicleId === v.id);
    const nextJobId = () => { S.nextJ = (S.nextJ || 200) + 1; return new Date().getFullYear() + "-" + S.nextJ; };
    return { veh, person, pname, openJobs, vorJob, checksOn, checkedToday, nextJobId, customer, custOf, custJobs, stockItem, loc, customers: () => customersOf(S), stock: () => stockOf(S), locations: () => locationsOf(S), moves: () => movesOf(S) };
  }
  // Answer for one item; items not stored count as passed (trailer-only ones as N/A on rigid vehicles).
  const resultOf = (c, it, v) => (c.results || {})[it.key] || (it.trailer && !(v && v.trailer) ? { s: "na" } : { s: "ok" });
  const defectsOf = c => Object.entries(c.results || {}).filter(([, r]) => r.s === "def");
  const outcome = c => {
    const d = defectsOf(c);
    if (!d.length) return { cls: "green", label: "Nil defects", res: "ok" };
    if (d.some(([, r]) => r.sev === "major")) return { cls: "red", label: "Off road", res: "bad" };
    return { cls: "amber", label: d.length + " defect" + (d.length > 1 ? "s" : ""), res: "warn" };
  };
  // Job sheet totals: labour = logged time × hourly rate, plus parts.
  const jobMins = j => (j.labour || []).reduce((a, l) => a + ((l.end || Date.now()) - l.start) / 60000, 0);
  const jobParts = j => (j.parts || []).reduce((a, p) => a + (Number(p.qty) || 0) * (Number(p.cost) || 0), 0);
  const jobLabour = j => jobMins(j) / 60 * (Number(j.rate) || 0);
  const jobTotal = j => jobLabour(j) + jobParts(j);
  // "Tyres: Nearside rear inner tyre looks soft…" — the driver's own words make the best title.
  function defectTitle(k, note) {
    const n = String(note || "").trim().split(/[.\n]/)[0];
    const head = k === "other" || !k ? "Defect" : itemShort(k);
    return n ? head + ": " + (n.length > 60 ? n.slice(0, 57).trim() + "…" : n) : head + " — defect";
  }

  /* ---------- small UI pieces (class names shared by both stylesheets) ---------- */
  const pill = (cls, txt) => `<span class="pill ${cls}">${txt}</span>`;
  const prioPill = p => pill(p === "VOR" ? "red" : p === "High" ? "amber" : "", p === "VOR" ? "VOR · off road" : esc(p));
  const statusPill = s => pill(s === "Complete" ? "green" : s === "Awaiting parts" ? "amber" : s === "In progress" ? "blue" : "dark", esc(s));
  const duePill = iso => { const n = daysUntil(iso); return pill(n < 0 ? "red" : n <= 30 ? "amber" : "green", n < 0 ? "Overdue " + -n + "d" : n === 0 ? "Due today" : n <= 30 ? "Due in " + n + "d" : fmtD(iso)); };
  const avClass = p => "av " + (p && p.role === "mechanic" ? "mech" : p && p.role === "admin" ? "adm" : "");

  // Finger/mouse signature pad on any <canvas>; calls onDone(dataUrl) after each stroke.
  function sigPad(cv, existing, onDone) {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = ctx.fillStyle = "#1c2a4a";
    const ph = cv.parentElement.querySelector(".ph");
    if (existing) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, r.width, r.height); im.src = existing; if (ph) ph.hidden = true; }
    let drawing = false, last = null;
    const pt = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    cv.onpointerdown = e => { drawing = true; last = pt(e); cv.setPointerCapture(e.pointerId); if (ph) ph.hidden = true; ctx.beginPath(); ctx.arc(last[0], last[1], 1.2, 0, 7); ctx.fill(); };
    cv.onpointermove = e => { if (!drawing) return; const p = pt(e); ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); last = p; };
    cv.onpointerup = cv.onpointercancel = () => { if (!drawing) return; drawing = false; onDone(cv.toDataURL("image/png")); };
  }

  function lightbox(src) {
    const d = document.createElement("div");
    d.className = "lightbox"; d.innerHTML = `<img src="${src}" alt="">`;
    d.onclick = () => d.remove();
    document.body.appendChild(d);
  }
  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2600);
  }
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };

  return {
    I, SECTIONS, sectionsFor, itemLabel, itemShort, JOB_TYPES, STATUSES, PRIORITIES, ROLE,
    esc, pad, isoOf, today, addDaysIso, DOW, MON, fmtD, fmtDay, fmtT, fmtDT, daysUntil, km, eur, mins, hrs, initials,
    api, resultOf, defectsOf, outcome, jobMins, jobParts, jobLabour, jobTotal, defectTitle,
    pill, prioPill, statusPill, duePill, avClass, sigPad, lightbox, toast, lsGet, lsSet,
    INTERNAL, isExternal, lowStock, stockPill, weekStart, takeStock, returnStock, migrate,
  };
})();
