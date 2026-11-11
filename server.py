#!/usr/bin/env python3
"""Martley's staff app + admin: static front end and a small JSON backend.

Python standard library only, no dependencies.

  /            phone staff app         (public/index.html)
  /admin/      desktop admin           (public/admin/index.html)
  GET  /api/state, /api/version, /api/files/<id>
  PUT  /api/<collection>/<id>, /api/kv/<key>      DELETE /api/<collection>/<id>
  POST /api/files?name=...

Data is kept in DATA_DIR (default ./data): state.json plus uploaded files.
On first start state.json is created from seed-state.json. On Railway, attach
a volume and set DATA_DIR to its mount path (e.g. /data) so data survives
redeploys. Delete state.json to reset the demo.
"""
import json, os, shutil, sys, threading, uuid
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote

ROOT = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(ROOT, "public")
DATA = os.environ.get("DATA_DIR") or os.path.join(ROOT, "data")
STATE = os.path.join(DATA, "state.json")
FILES = os.path.join(DATA, "files")
COLLS = {"vehicles", "staff", "checks", "jobs"}
KV = {"nextJ", "settings"}
MAX_UPLOAD = 15 * 1024 * 1024

os.makedirs(FILES, exist_ok=True)
if not os.path.exists(STATE):
    shutil.copy(os.path.join(ROOT, "seed-state.json"), STATE)
with open(STATE) as f:
    state = json.load(f)
lock = threading.Lock()


def persist():
    tmp = STATE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f)
    os.replace(tmp, STATE)


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=PUB, **k)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.command, fmt % args))

    def end_headers(self):
        # always fetch fresh HTML/JS/CSS so phones pick up new versions straight away
        if not self.path.startswith("/api/files/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_json(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def body(self, limit=2 * 1024 * 1024):
        n = int(self.headers.get("Content-Length") or 0)
        if n > limit:
            raise ValueError("too large")
        return self.rfile.read(n) if n else b""

    def bump(self):
        state["version"] = state.get("version", 0) + 1
        persist()
        return {"version": state["version"]}

    def route(self):
        return [unquote(x) for x in urlparse(self.path).path.split("/") if x]

    def do_GET(self):
        p = urlparse(self.path).path
        if p == "/api/state":
            with lock:
                return self.send_json(state)
        if p == "/api/version":
            return self.send_json({"version": state.get("version", 0)})
        if p.startswith("/api/files/"):
            fid = os.path.basename(p)
            fp = os.path.join(FILES, fid)
            if not fid.isalnum() or not os.path.exists(fp):
                return self.send_json({"error": "not found"}, 404)
            try:
                ctype = open(fp + ".type").read().strip()
            except OSError:
                ctype = "application/octet-stream"
            b = open(fp, "rb").read()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(b)))
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
            self.end_headers()
            return self.wfile.write(b)
        if p.startswith("/api/"):
            return self.send_json({"error": "not found"}, 404)
        return super().do_GET()

    def do_PUT(self):
        parts = self.route()
        try:
            val = json.loads(self.body() or b"null")
        except ValueError:
            return self.send_json({"error": "bad request"}, 400)
        with lock:
            if len(parts) == 3 and parts[:2] == ["api", "kv"] and parts[2] in KV:
                state[parts[2]] = (val or {}).get("value")
                return self.send_json(self.bump())
            if len(parts) == 3 and parts[0] == "api" and parts[1] in COLLS and isinstance(val, dict):
                lst = state.setdefault(parts[1], [])
                for i, x in enumerate(lst):
                    if x.get("id") == parts[2]:
                        lst[i] = val
                        break
                else:
                    lst.append(val)
                return self.send_json(self.bump())
        self.send_json({"error": "bad route"}, 404)

    def do_DELETE(self):
        parts = self.route()
        with lock:
            if len(parts) == 3 and parts[0] == "api" and parts[1] in COLLS:
                state[parts[1]] = [x for x in state.get(parts[1], []) if x.get("id") != parts[2]]
                return self.send_json(self.bump())
        self.send_json({"error": "bad route"}, 404)

    def do_POST(self):
        u = urlparse(self.path)
        if u.path != "/api/files":
            return self.send_json({"error": "bad route"}, 404)
        try:
            b = self.body(MAX_UPLOAD)
        except ValueError:
            return self.send_json({"error": "File is over 15 MB"}, 413)
        fid = uuid.uuid4().hex
        ctype = self.headers.get("Content-Type", "application/octet-stream")
        open(os.path.join(FILES, fid), "wb").write(b)
        open(os.path.join(FILES, fid + ".type"), "w").write(ctype)
        name = parse_qs(u.query).get("name", ["file"])[0]
        self.send_json({"id": fid, "name": name, "type": ctype, "size": len(b)})


if __name__ == "__main__":
    port = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8080))
    host = "0.0.0.0" if os.environ.get("PORT") else "127.0.0.1"
    print("Martley's app on http://%s:%d (data in %s)" % (host, port, DATA), flush=True)
    ThreadingHTTPServer((host, port), H).serve_forever()
