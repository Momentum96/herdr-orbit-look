// What the machine is using: cpu (all and each core, the load), ram (and
// swap), the disk of the home folder. This file is the same in every orbit
// mod that uses it (the status bar's widgets, orbit-dialogs' "stat" popup).
//
//   const sys = new System(); sys.start(cx);   then sys.cpu, sys.cores, ...
//
// /proc every second and `df` every 30 s on Linux; on macOS a small python3
// (ctypes into libSystem: host_processor_info, host_statistics64, sysctl) every
// second and BSD `df -P`. Elsewhere, or without python3, they stay null.

import { readTextFile, exec, home, shared, window } from "herdr";

// macOS: one line of JSON, the ticks of each core [user, system, idle, nice],
// the load, and memory as Activity Monitor counts it (app + wired + compressed).
const MAC_SAMPLE = String.raw`import ctypes as C, os, json
L = C.CDLL("/usr/lib/libSystem.dylib")
h = L.mach_host_self()
n = C.c_uint(); p = C.POINTER(C.c_int)(); k = C.c_uint()
L.host_processor_info(h, 2, C.byref(n), C.byref(p), C.byref(k))
cores = [[p[i * 4 + j] for j in range(4)] for i in range(n.value)]
U, Q = C.c_uint32, C.c_uint64
class VM(C.Structure):
    _fields_ = [(f, U) for f in ("free", "active", "inactive", "wire")] + [(f, Q) for f in ("zf", "re", "pi", "po", "fa", "cow", "lu", "hi", "pu")] + [("purgeable", U), ("spec", U)] + [(f, Q) for f in ("dc", "co", "si", "so")] + [(f, U) for f in ("compressor", "thr", "ext", "internal")] + [("tu", Q)]
v = VM(); c = U(C.sizeof(VM) // 4)
L.host_statistics64(h, 4, C.byref(v), C.byref(c))
def sysctl(name, t):
    x = t(); s = C.c_size_t(C.sizeof(x))
    L.sysctlbyname(name.encode(), C.byref(x), C.byref(s), None, C.c_size_t(0))
    return x
class SW(C.Structure):
    _fields_ = [("total", Q), ("avail", Q), ("used", Q), ("pagesize", U), ("enc", C.c_bool)]
pg = sysctl("vm.pagesize", Q).value
sw = sysctl("vm.swapusage", SW)
print(json.dumps({"cores": cores, "load": os.getloadavg(), "used": (v.internal - v.purgeable + v.wire + v.compressor) * pg,
  "total": sysctl("hw.memsize", Q).value, "swapUsed": sw.used, "swapTotal": sw.total}))`;

// The python3 to run MAC_SAMPLE with, or null. /usr/bin/python3 without the
// Command Line Tools is a stub that opens an install prompt: never run that one.
const MAC_PYTHON = `p=$(command -v python3) || exit 1
if [ "$p" = /usr/bin/python3 ] && ! xcode-select -p >/dev/null 2>&1; then exit 1; fi
printf %s "$p"`;

// `17G`, `7.1G`, `512M`: binary units, one decimal under 10.
export function bytes(n) {
  const units = ["B", "K", "M", "G", "T", "P"];
  let u = 0;
  while (n >= 1024 && u < units.length - 1) { n /= 1024; u++; }
  return n < 10 && u > 0 ? `${n.toFixed(1)}${units[u]}` : `${Math.round(n)}${units[u]}`;
}

export const pct = (v) => `${Math.round(v * 100)}%`;

// A use's colour: blue, yellow from 70%, red from 90%.
export function level(t, v) {
  return v >= 0.9 ? t.ansi1 : v >= 0.7 ? t.ansi3 : t.ansi4;
}

export class System {
  constructor() {
    this.cpu = null; // 0..1
    this.cores = []; // 0..1 each
    this.load = null; // [1, 5, 15 min]
    this.mem = null; // { used, total, available, swapUsed, swapTotal }
    this.disk = null; // { used, free, total, path }
    this.prev = null; // last /proc/stat totals: [{ idle, total }], all cpus then each core
  }

  start(cx) {
    this.mac = window()?.platform === "macos";
    this.python = undefined; // macOS: the python3 to sample with, null when there's none
    this.sample(cx);
    this.sampleDisk(cx);
    // cpu use needs two samples: the second soon, so a popup has it at once.
    cx.timer.after(250, (cx) => this.sample(cx));
    cx.timer.every(1000, (cx) => this.sample(cx));
    cx.timer.every(30000, (cx) => this.sampleDisk(cx));
  }

  sample(cx) {
    if (this.mac) return this.sampleMac(cx);
    cx.spawn(async (cx) => {
      try {
        const stat = (await readTextFile("/proc/stat")) ?? "";
        const now = stat.split("\n").filter((l) => /^cpu\d*\s/.test(l)).map((l) => {
          const f = l.trim().split(/\s+/).slice(1).map(Number);
          return { idle: f[3] + (f[4] ?? 0), total: f.reduce((a, b) => a + b, 0) };
        });
        const use = (n, p) => (p && n.total > p.total ? 1 - (n.idle - p.idle) / (n.total - p.total) : null);
        if (this.prev && now.length) {
          const all = use(now[0], this.prev[0]);
          if (all !== null) this.cpu = all;
          this.cores = now.slice(1).map((c, i) => use(c, this.prev[i + 1]) ?? 0);
          // tools/regress.py: a machine with this many cores (the rest idle).
          const fake = shared("orbit.probe") === true ? shared("orbit.probe.cores") : null;
          if (Number.isInteger(fake) && fake > this.cores.length) this.cores = [...this.cores, ...Array(fake - this.cores.length).fill(0)];
        }
        this.prev = now;
        const load = ((await readTextFile("/proc/loadavg")) ?? "").trim().split(/\s+/).slice(0, 3).map(Number);
        if (load.length === 3 && load.every((x) => !Number.isNaN(x))) this.load = load;
        const info = {};
        for (const line of ((await readTextFile("/proc/meminfo")) ?? "").split("\n")) {
          const m = line.match(/^(\w+):\s+(\d+)/);
          if (m) info[m[1]] = Number(m[2]) * 1024;
        }
        if (info.MemTotal) {
          this.mem = { used: info.MemTotal - info.MemAvailable, total: info.MemTotal, available: info.MemAvailable,
            swapUsed: info.SwapTotal - info.SwapFree, swapTotal: info.SwapTotal };
        }
      } catch (_) { /* not Linux: those widgets stay hidden */ }
      cx.notify();
    });
  }

  // Per-core ticks turned into use as on Linux: [all, ...each core].
  cpuFrom(now) {
    const use = (n, p) => (p && n.total > p.total ? 1 - (n.idle - p.idle) / (n.total - p.total) : null);
    if (this.prev && now.length) {
      const all = use(now[0], this.prev[0]);
      if (all !== null) this.cpu = all;
      this.cores = now.slice(1).map((c, i) => use(c, this.prev[i + 1]) ?? 0);
    }
    this.prev = now;
  }

  sampleMac(cx) {
    if (this.busy) return; // one python at a time, however slow the machine is
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        if (this.python === undefined) {
          const r = await exec("sh", ["-c", MAC_PYTHON]);
          this.python = r.code === 0 && r.stdout ? r.stdout : null;
        }
        if (this.python) {
          const r = await exec(this.python, ["-S", "-c", MAC_SAMPLE]);
          const d = JSON.parse(r.stdout);
          const cores = d.cores.map(([u, s, i, n]) => ({ idle: i, total: u + s + i + n }));
          const all = cores.reduce((a, c) => ({ idle: a.idle + c.idle, total: a.total + c.total }), { idle: 0, total: 0 });
          this.cpuFrom([all, ...cores]);
          if (d.load?.length === 3) this.load = d.load;
          if (d.total) this.mem = { used: d.used, total: d.total, available: d.total - d.used, swapUsed: d.swapUsed, swapTotal: d.swapTotal };
        }
      } catch (_) { /* those widgets stay hidden */ }
      this.busy = false;
      cx.notify();
    });
  }

  sampleDisk(cx) {
    cx.spawn(async (cx) => {
      try {
        if (this.mac) {
          // BSD df: 1024-blocks, used, available; the mount point may have spaces.
          const r = await exec("df", ["-P", "-k", home()]);
          const f = r.stdout.trim().split("\n").pop().trim().split(/\s+/);
          this.disk = { used: Number(f[2]) * 1024, free: Number(f[3]) * 1024, total: Number(f[1]) * 1024, path: f.slice(5).join(" ") };
          if (Number.isNaN(this.disk.used)) this.disk = null;
          cx.notify();
          return;
        }
        const r = await exec("df", ["-B1", "--output=used,avail,size,target", home()]);
        const [used, free, total, path] = r.stdout.trim().split("\n").pop().trim().split(/\s+/);
        this.disk = { used: Number(used), free: Number(free), total: Number(total), path };
      } catch (_) { this.disk = null; }
      cx.notify();
    });
  }

  // How full the disk is, 0..1, or null while unknown.
  full() {
    const d = this.disk, room = d ? d.used + d.free : 0;
    return room ? d.used / room : null;
  }
}
