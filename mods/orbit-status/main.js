// The status bar: on the left, the sidebar toggle, a thin line and the
// taskbar (taskbar.js: a card per space that's pinned, shown, waiting for you
// or at work), then "herdr offline" while the core can't be reached, how many
// tabs are folded away (settled) and an update pill; on the right, cpu, ram
// and disk use as small bars (blue,
// yellow from 70%, red from 90%), and the clock.
//
// A taskbar card: the space's symbol filled in its agents' state colour (its
// outline in the space's colour on the shown space) and its name. Click shows
// the space, right-click pins or unpins it (orbit-dialogs' menu, tab
// "taskbar"; shared "orbit.pinned"), a drag onto another card moves it there
// and pins it (an accent bar shows where it lands). A pinned card shows a pin
// after its name. What doesn't fit is cut.
//
// cpu, ram and disk open their popup above the widget (orbit-dialogs' "stat"),
// a second click closes it. The popup gets props.pin (its title) and
// props.pinCommand, which opens the same mod in a pane, and props.height.
// The popup tells the bar when it closes (shared "orbit.popup").
//
// System figures come from /proc every second and `df` every 30 s (system.js;
// Linux, elsewhere those widgets stay hidden).

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, theme, layout, spaces, machines, updates, shared, setShared, openOverlay, closeOverlay, window } from "herdr";
import { look, glass, spaceLook, spaceSymbol, accentBand, probeColor } from "./look.js";
import { backdrop, orbitPlace, orbitRadius, zoom, viewport } from "./glass.js";
import { System, bytes, pct, level } from "./system.js";
import { order, drop, landing } from "./taskbar.js";

const ICONS = "mods/orbit-status/icons";
const PINNED = "orbit.pinned";

// The popups the widgets open: orbit-dialogs' "stat", this size (its rows
// have fixed heights, stat.js).
const POPUPS = {
  cpu: { title: "cpu", width: 300, height: 260 },
  ram: { title: "memory", width: 300, height: 150 },
  disk: { title: "disk", width: 300, height: 180 },
};

// cpu's height for `n` cores, every row in full (stat.js: CORE_COLUMNS
// columns, CORE_ROW apart; the rest of the popup is 150).
const CORE_COLUMNS = 3, CORE_ROW = 22;
function cpuHeight(n) {
  return 150 + Math.ceil(Math.max(1, n) / CORE_COLUMNS) * CORE_ROW;
}

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

export default class OrbitStatus extends View {
  init(_props, cx) {
    this.sys = new System();
    this.sys.start(cx);
    this.popup = null; // { widget, id, mod }: the popup a widget opened
    this.drag = null; // { from, over }: a taskbar card being dragged
    this.acx = cx;
  }

  // Where a popup `w`×`h` (the mod's lengths, which herdr-app zooms) opens:
  // above `bounds` (an element's, window pixels), its left edge at the
  // element's, inside the window. herdr-app takes `at` in window pixels, not
  // zoomed; the height is cut to the room above. Returns { at, h }.
  above(bounds, w, h) {
    const z = zoom(), view = viewport();
    if (!bounds) return { at: "pointer", h };
    const room = (bounds.y - 6 - 8) / z;
    h = Math.max(40, Math.min(h, room));
    const x = Math.max(8, Math.min(bounds.x, view ? view.width - w * z - 8 : bounds.x));
    return { at: { x, y: Math.max(8, bounds.y - h * z - 6) }, h };
  }

  // Opens a popup for `widget` (orbit-dialogs, `props`), above `bounds`. The
  // popup says when it opens and closes (shared "orbit.popup", orbit-dialogs
  // main.js), so the bar knows without asking herdr-app.
  openPopup(widget, bounds, w, h, props, cx) {
    if (this.popup) closeOverlay(this.popup.id);
    const place = this.above(bounds, w, h);
    const id = openOverlay({ mod: "orbit-dialogs", kind: "popup", width: w, height: place.h, at: place.at,
      props: { ...props(place.h), bar: true } });
    this.popup = { widget, id, at: Date.now() };
    cx.notify();
  }

  // A widget's popup, or, when its popup was open at the press, closed. (A
  // press beside a popup can close it before the click arrives: what counts
  // is what was open when the button went down.)
  toggle(widget, press, spec, cx) {
    if (press?.wasOpen) {
      if (this.popup?.widget === widget) closeOverlay(this.popup.id);
      this.popup = null;
      cx.notify();
      return;
    }
    const inPane = { mod: "orbit-dialogs", title: spec.title, props: spec.props };
    this.openPopup(widget, press?.bounds ?? null, spec.width, spec.height, (h) => ({
      ...spec.props, height: h, pin: spec.title,
      pinCommand: `orbit.new-mod ${JSON.stringify({ side: "right", ...inPane })}`,
    }), cx);
  }

  // The popup closed (shared "orbit.popup" no longer names it); a moment's
  // grace while it opens.
  popupGone() {
    const p = this.popup;
    return p && Date.now() - p.at > 1500 && shared("orbit.popup") !== p.id;
  }

  // For tools/regress.py only: with shared "orbit.probe" on, where each
  // widget and card is (window pixels), as the pointer passes over it, in
  // shared "orbit.probe.status".
  probe(key, b) {
    if (!b || shared("orbit.probe") !== true) return;
    const all = shared("orbit.probe.status") ?? {};
    const was = all[key];
    if (was && was.x === b.x && was.y === b.y && was.width === b.width) return;
    setShared("orbit.probe.status", { ...all, [key]: { x: b.x, y: b.y, width: b.width, height: b.height } });
  }

  render() {
    if (this.popupGone()) this.popup = null;
    const t = theme();
    const sys = this.sys;
    const hover = t.foreground.slice(0, 7) + "24";
    const text = (s, color) => div().whitespace_nowrap().text_color(color ?? t.foreground).child(s);
    const icon = (name, color) => svg(`${ICONS}/${name}.svg`).w(name.startsWith("sidebar") ? 18 : 14).h(14).flex_none().text_color(color ?? t.ansi7);
    // A widget: hover highlight and a tooltip; while its popup is open it
    // keeps the highlight and shows no tooltip.
    const ghost = (id, children, action, tip) => {
      const open = this.popup?.widget === id;
      return h_flex().id(id).h(28).px(6).gap(6).items_center().rounded(4).flex_none()
        .hover((s) => s.bg(hover)).when(open, (el) => el.bg(hover))
        .on_mouse_down("left", (e, cx) => {
          cx.stop_propagation();
          this.pressed = { id, bounds: e?.bounds ?? null, wasOpen: this.popup?.widget === id };
        })
        .when(Boolean(action), (el) => el.on_click((_e, cx) => action(this.pressed?.id === id ? this.pressed : null, cx)))
        .when(Boolean(tip) && !open, (el) => el.tooltip(tip))
        .on_mouse_move((e) => this.probe(id, e?.bounds))
        .children(children);
    };
    // A use as a small bar: blue, yellow from 70%, red from 90%.
    const meter = (v) => div().w(34).h(6).flex_none().rounded(3).bg(t.muted.slice(0, 7) + "40")
      .child(div().h_full().rounded(3).w(Math.max(1, Math.round(v * 34))).bg(level(t, v)));
    const popupOf = (name) => (press, cx) => this.toggle(name, press, { ...POPUPS[name],
      ...(name === "cpu" ? { height: cpuHeight(sys.cores.length) } : {}), props: { dialog: "stat", stat: name } }, cx);
    const usage = (name, v, tip) => ghost(name, [icon(name), meter(v)], popupOf(name), tip);
    const L = layout();
    const sidebarOpen = find(L, "sidebar")?.hidden !== true;

    const left = [ghost("sidebar", [icon(sidebarOpen ? "sidebar-open" : "sidebar")], () => run("layout.toggle", { id: "sidebar" }), `sidebar  ${window()?.platform === "macos" ? "cmd+b" : "ctrl+shift+b"}`)];
    const after = [];
    if (machines().find((m) => m.name === null)?.layout === "unavailable") after.push(text("herdr offline", t.ansi1));
    const settled = spaces().reduce((n, s) => n + s.tabs.filter((tb) => tb.settled).length, 0);
    if (settled) after.push(text(`${settled} folded`, t.muted));
    const up = updates();
    if (up.app.ready) {
      after.push(h_flex().id("update").h(24).px(10).flex_none().items_center().rounded(12).bg(t.accent).text_color(t.accent_foreground)
        .on_click(() => run("app.update")).child(`update ready · restart`));
    }
    const right = [];
    if (sys.cpu !== null) {
      const tip = [`total ${pct(sys.cpu)}`];
      if (sys.load) tip.push(`load  ${sys.load.map((x) => x.toFixed(2)).join(" ")}`);
      right.push(usage("cpu", sys.cpu, tip.join("\n")));
    }
    if (sys.mem) {
      const m = sys.mem;
      right.push(usage("ram", m.used / m.total, `used ${bytes(m.used)} of ${bytes(m.total)} (${pct(m.used / m.total)})`));
    }
    if (sys.full() !== null) {
      const d = sys.disk;
      right.push(usage("disk", sys.full(), `${d.path}: ${bytes(d.free)} free (${pct(sys.full())} full)`));
    }
    const now = new Date();
    right.push(div().pl(6).child(text(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`)));

    const Lk = look();
    // The glass, with the blurred background under its fill (glass.js): the
    // bar's place in the window, then the box's in the bar.
    const sizes = (this.sizes ??= {});
    const sized = (key) => (size, cx) => {
      const was = sizes[key];
      if (size.width !== was?.width || size.height !== was?.height) { sizes[key] = size; cx.notify(); }
    };
    const bar = orbitPlace(Lk, "status", sizes.bar);
    const box = (el, key, dx) => el.id(`status-${key}`).relative().h_full().items_center()
      .on_size_change(sized(key))
      .child(backdrop({ x: bar && dx(sizes[key]) !== null ? bar.x + dx(sizes[key]) : undefined, y: bar?.y,
        w: sizes[key]?.width, h: sizes[key]?.height, radius: orbitRadius(Lk), corners: "tl tr bl br", fill: glass(t) }));
    const leftAt = () => 0;
    return h_flex().id("orbit-status").size_full().gap(Lk.gap || 6).text_size(13)
      .on_size_change(sized("bar"))
      .child(box(h_flex(), "left", leftAt).flex_1().min_w(0).px(14).gap(10)
        .child(h_flex().gap(4).flex_none().items_center().children(left))
        .child(div().w(1).h(18).flex_none().bg(t.border))
        .child(this.taskbar(t))
        .child(h_flex().gap(4).flex_none().items_center().children(after))
        .child(div().flex_1())
        .child(h_flex().gap(10).flex_none().items_center().children(right)));
  }

  // The taskbar (taskbar.js): one card per space, cut where it doesn't fit.
  taskbar(t) {
    const pinned = shared(PINNED) ?? [];
    const list = order(spaces(), pinned);
    const ids = list.map((s) => s.id);
    const g = this.drag;
    const mark = g && g.over !== g.from ? landing(ids, pinned, g.from, g.over) : null;
    const set = (v, cx) => { this.drag = v; cx.notify(); };
    const cards = list.map((s, i) => {
      // As the sidebar draws it (look.js spaceSymbol): filled while an agent
      // is blocked, working or done, else empty; the shown space's outline in
      // its own colour.
      const symbol = spaceSymbol(s, 14, s.active ? spaceLook(s).color : t.muted, "taskbar");
      const line = (side) => div().absolute().top(4).bottom(4).w(2).rounded(1).bg(t.accent)
        .when(side === "before", (m) => m.left(0)).when(side === "after", (m) => m.right(0));
      if (s.active) { probeColor("taskbar-band", accentBand(spaceLook(s).color)); probeColor("taskbar-text", t.foreground); }
      return h_flex().id(`task-${s.id}`).relative().h(26).px(8).gap(6).flex_none().items_center().rounded(5)
        .text_size(12.5).text_color(s.active ? t.foreground : t.ansi7)
        // The shown space's accent, as the sidebar's row: a band of its colour.
        .when(s.active, (el) => el.bg(accentBand(spaceLook(s).color)))
        .hover((st) => st.bg(t.foreground.slice(0, 7) + "24"))
        .when(!g && this.popup?.widget !== `task-${s.id}`, (el) => el.tooltip(`${s.name}${pinned.includes(s.id) ? " · pinned" : ""}\nright-click: ${pinned.includes(s.id) ? "unpin" : "pin"} · drag to move`))
        .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.drag = { from: i, over: i }; })
        .on_mouse_move((e, cx) => {
          this.probe(`task:${s.name}`, e?.bounds);
          const d = this.drag;
          if (d && d.over !== i) set({ ...d, over: i }, cx);
        })
        .on_mouse_up("left", (_e, cx) => {
          const d = this.drag;
          if (!d) return;
          set(null, cx);
          if (d.from !== i) setShared(PINNED, drop(ids, pinned, d.from, i));
        })
        .on_click(() => { if (!s.active) run("space.select", { id: s.id }); })
        .on_mouse_down("right", (e, cx) => {
          cx.stop_propagation();
          // Its menu is the card's popup: no tooltip over it while it's open.
          this.openPopup(`task-${s.id}`, e?.bounds ?? null, 160, 41,
            () => ({ dialog: "menu", tab: "taskbar", target: { id: s.id } }), cx);
        })
        .child(symbol)
        .child(div().max_w(150).truncate().child(s.name))
        // Pinned: a pin after the name, inside the card.
        .when(pinned.includes(s.id), (el) => el.child(div().id(`pin-${s.id}`).flex_none()
          .on_mouse_move((e) => this.probe(`pin:${s.name}`, e?.bounds))
          .child(svg(`${ICONS}/pin.svg`).size(11).text_color(t.muted))))
        .when(mark?.before === s.id, (el) => el.child(line("before")))
        .when(mark?.after === s.id, (el) => el.child(line("after")));
    });
    return h_flex().id("taskbar").flex_shrink_1().min_w(0).h_full().gap(4).items_center().overflow_hidden()
      .on_hover((h, cx) => { if (!h && this.drag) set(null, cx); })
      .on_mouse_up("left", (_e, cx) => { if (this.drag) set(null, cx); })
      .children(cards);
  }
}
