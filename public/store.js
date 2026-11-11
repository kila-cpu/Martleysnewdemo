// Shared client for the Martleys backend. Screens mutate a plain state
// object as before; Store.sync() diffs it against the last server copy and
// sends only the records that changed. Store.poll() picks up changes made
// on other devices (drivers, workshop and office share the same data).
window.Store = (function () {
  "use strict";
  const COLLS = { vehicles: "id", staff: "id", checks: "id", jobs: "id" };
  const KV = ["nextJ", "settings"];
  let snap = null, version = 0, pending = 0, queue = Promise.resolve(), onErr = null;

  function snapshot(S) {
    const m = {};
    for (const c in COLLS) { m[c] = {}; (S[c] || []).forEach(x => { m[c][x[COLLS[c]]] = JSON.stringify(x); }); }
    for (const k of KV) m["kv:" + k] = JSON.stringify(S[k] === undefined ? null : S[k]);
    return m;
  }
  async function req(method, url, body) {
    const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    if (!r.ok) throw new Error(method + " " + url + " → " + r.status);
    return r.json();
  }
  async function load() {
    const s = await req("GET", "/api/state");
    version = s.version; snap = snapshot(s);
    return s;
  }
  function sync(S) {
    if (!snap) return;
    const now = snapshot(S), ops = [];
    for (const c in COLLS) {
      for (const id in now[c]) if (now[c][id] !== snap[c][id]) ops.push(["PUT", "/api/" + c + "/" + encodeURIComponent(id), JSON.parse(now[c][id])]);
      for (const id in snap[c]) if (!(id in now[c])) ops.push(["DELETE", "/api/" + c + "/" + encodeURIComponent(id)]);
    }
    for (const k of KV) if (now["kv:" + k] !== snap["kv:" + k]) ops.push(["PUT", "/api/kv/" + k, { value: JSON.parse(now["kv:" + k]) }]);
    snap = now;
    if (!ops.length) return;
    pending++;
    queue = queue.then(async () => {
      for (const o of ops) {
        try {
          const r = await req(o[0], o[1], o[2]);
          // Only adopt the server version if nobody else wrote in between;
          // otherwise leave it stale so the next poll pulls their changes.
          if (r.version === version + 1) version = r.version;
        } catch (e) { console.warn("sync failed", e); if (onErr) onErr(e); }
      }
    }).finally(() => { pending--; });
  }
  function poll(isBusy, onState, ms) {
    const check = async () => {
      if (pending || document.hidden || (isBusy && isBusy())) return;
      try {
        const v = await req("GET", "/api/version");
        if (v.version !== version && !pending) onState(await load());
      } catch (e) { /* offline: try again next tick */ }
    };
    setInterval(check, ms || 4000);
    // catch up as soon as a backgrounded tab or phone comes back
    document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  }

  // Upload a photo or PDF; resolves to {id, name, type, size}. View it at /api/files/<id>.
  async function upload(file) {
    const r = await fetch("/api/files?name=" + encodeURIComponent(file.name || "photo"), { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Upload failed");
    return j;
  }
  return { load, sync, poll, upload, onError: fn => { onErr = fn; } };
})();
