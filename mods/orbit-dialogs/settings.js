// The orbit layout's own settings: the theme (Tokyo Night or one of the six
// others shipped in themes/, herdr-app's app.theme; any other is in herdr-app's settings, as
// the UI font: "herdr settings…" opens them), density, corners, gap, the tab
// rows on top or at the bottom, and the background picture. Each change is asked of the orbit mod (look.js ask),
// which saves it in shared "orbit.settings" and writes it into the layout at
// once. Opened in the right pane ("Orbit look settings", the orbit mod's
// openSettings), as other views are. Props: { dialog: "settings" }.
//
// "background…" opens a file dialog: macOS's own (osascript's choose file),
// KDE's kdialog, else GNOME's zenity (from
// a toolbox or a flatpak, the host's, through flatpak-spawn); with neither,
// herdr-app's own folder picker, and the pictures in the chosen folder show
// here to pick from. The picture is copied into herdr-app's home
// (backgrounds/), where a layout's picture has to be.

import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme, props, closeOverlay, exec, home, appHome, run, readTextFile, watchFolder, pickFolder } from "herdr";
import { look, ask } from "./look.js";

const PRESETS = ["compact", "default", "comfortable"];
// The themes shipped in themes/, known by their accent.
const THEMES = [["tokyo night", "#7aa2f7", "tokyo-night"], ["catppuccin mocha", "#89b4fa", "catppuccin-mocha"], ["everforest", "#a7c080", "everforest"],
  ["gruvbox dark", "#83a598", "gruvbox-dark"], ["kanagawa", "#7e9cd8", "kanagawa"], ["nord", "#88c0d0", "nord"],
  ["rosé pine", "#c4a7e7", "rose-pine"]];
const CORNERS = ["auto", 0, 4, 8, 12];
const GAPS = ["auto", "none", 4, 8, 12, 16];
const LABEL = 104;
const WAIT = 15 * 60 * 1000; // how long an open file dialog is waited for
const PICTURES = /\.(png|jpe?g|webp)$/i;

// The file dialog, run apart from herdr-app (its exec stops a command after
// 30 s). It writes the chosen path, or nothing when cancelled, to $1. Exit 3:
// no dialog program here.
const OPEN = `
out=$1 start=$2
run() { if command -v "$1" >/dev/null 2>&1; then "$@";
  elif command -v flatpak-spawn >/dev/null 2>&1 && flatpak-spawn --host sh -c "command -v $1" >/dev/null 2>&1; then flatpak-spawn --host "$@";
  else return 3; fi; }
has() { command -v "$1" >/dev/null 2>&1 || { command -v flatpak-spawn >/dev/null 2>&1 && flatpak-spawn --host sh -c "command -v $1" >/dev/null 2>&1; }; }
if [ "$(uname)" = Darwin ]; then set -- osascript -e activate -e "POSIX path of (choose file with prompt \\"background\\" of type {\\"public.png\\", \\"public.jpeg\\", \\"org.webmproject.webp\\"} default location (POSIX file \\"$start\\"))"
elif has kdialog; then set -- kdialog --title background --getopenfilename "$start" "Pictures (*.png *.jpg *.jpeg *.webp)"
elif has zenity; then set -- zenity --file-selection --title=background --filename="$start/" "--file-filter=Pictures | *.png *.jpg *.jpeg *.webp"
else exit 3; fi
rm -f "$out" "$out.part"
( run "$@" >"$out.part" 2>/dev/null; mv "$out.part" "$out" ) </dev/null >/dev/null 2>&1 &
`;

// Copies the chosen picture into herdr-app's backgrounds/ and prints its name
// there. A path of the host's is under /run/host from a toolbox. A KDE
// wallpaper package (Name/contents/images/WxH.png) is named after the package.
const COPY = `
p=$1 home=$2
[ -e "$p" ] || p=/run/host$p
[ -e "$p" ] || { echo "can't read $1" >&2; exit 1; }
case "$p" in
  */contents/images/*) name=$(basename "$(dirname "$(dirname "$(dirname "$p")")")") ;;
  *) name=$(basename "\${p%.*}") ;;
esac
ext=$(printf %s "\${p##*.}" | tr A-Z a-z)
file=$(printf %s "$name" | tr -c 'A-Za-z0-9._-' -).$ext
mkdir -p "$home/backgrounds" && cp -f "$p" "$home/backgrounds/$file" && printf %s "$file"
`;

export class Settings {
  init(_props, cx) {
    this.picking = false;
    this.error = null;
    this.found = null; // the pictures of a folder picked with herdr-app's picker
    this.handle = cx.focus_handle();
    cx.timer.after(100, () => this.handle.focus());
  }

  set(change) {
    ask("settings", change);
  }

  // Opened as an overlay (an older copy's), Esc closes it; in a pane it stays.
  close() {
    if (props()?.overlay) closeOverlay(props().overlay);
  }

  // Copies `path` into backgrounds/ and makes it the background.
  async use(path) {
    const c = await exec("sh", ["-c", COPY, "sh", path, appHome()]);
    if (c.code !== 0) throw new Error(c.stderr.trim() || "couldn't copy it");
    this.set({ background: `backgrounds/${c.stdout.trim()}` });
  }

  // background…: a file dialog; the picture chosen becomes the background.
  pick(cx) {
    if (this.picking) return;
    this.picking = true;
    this.error = null;
    this.found = null;
    cx.notify();
    cx.spawn(async (cx) => {
      const dir = `${appHome()}/data/orbit-settings`;
      const out = `${dir}/picked`;
      try {
        await exec("mkdir", ["-p", dir]);
        const r = await exec("sh", ["-c", OPEN, "sh", out, `${home()}/Pictures`]);
        if (r.code === 3) {
          // No file dialog here: herdr-app's folder picker, then its pictures.
          const folder = await pickFolder({ prompt: "Use this folder" });
          if (folder) {
            const ls = await exec("ls", ["-1", folder]);
            this.found = { folder, files: ls.stdout.split("\n").filter((f) => PICTURES.test(f)).slice(0, 24) };
            if (!this.found.files.length) this.error = `background: no pictures in ${folder}`;
          }
        } else {
          if (r.code !== 0) throw new Error(r.stderr.trim() || "couldn't open the file dialog");
          const until = Date.now() + WAIT;
          let chosen = null;
          while (Date.now() < until) {
            chosen = await readTextFile(out);
            if (chosen !== null) break;
            await watchFolder(dir);
          }
          const path = (chosen ?? "").trim();
          if (path) await this.use(path);
        }
      } catch (e) {
        this.error = `background: ${e.message ?? e}`;
      }
      this.picking = false;
      cx.notify();
    });
  }

  render() {
    const t = theme();
    const L = look();
    const r = L.small;
    const fg = (a) => t.foreground.slice(0, 7) + a;

    const label = (text) => div().w(LABEL).flex_none().pt(6).text_size(14).text_color(t.muted).child(text);
    const toggle = (id, text, on, action) => div().id(id).h(32).px(10).flex().items_center().flex_none().rounded(r)
      .border(1).text_size(14)
      .when(on, (el) => el.border_color(t.accent).bg(t.accent).text_color(t.accent_foreground))
      .when(!on, (el) => el.border_color(t.border).text_color(t.foreground).hover((s) => s.bg(fg("1a"))))
      .when(Boolean(action), (el) => el.on_click((_e, cx) => action(cx)))
      .child(text);
    const line = (name, children) => h_flex().gap(6).items_start().child(label(name))
      .child(h_flex().flex_1().min_w(0).flex_wrap().gap(6).children(children));
    const choices = (key, values, current) => values.map((v) => {
      const value = v === "auto" ? null : v === "none" ? 0 : v;
      return toggle(`${key}-${v}`, String(v), value === current, () => this.set({ [key]: value }));
    });

    const background = [
      ...(L.picked ? [div().pt(6).text_size(14).text_color(t.foreground).child(L.picked.split("/").pop())] : []),
      toggle("background-pick", this.picking ? "choosing…" : "background…", this.picking, (cx) => this.pick(cx)),
      toggle("background-generated", "generated", !L.picked, () => this.set({ background: null })),
    ];
    const found = (this.found?.files ?? []).map((f, i) => toggle(`picture-${i}`, f, false, (cx) => {
      const path = `${this.found.folder}/${f}`;
      this.found = null;
      cx.spawn(async (cx) => { try { await this.use(path); } catch (e) { this.error = `background: ${e.message ?? e}`; } cx.notify(); });
    }));
    const hint = (key, what) => h_flex().gap(5).child(div().text_color(t.accent).child(key)).child(div().child(what));

    const popup = Boolean(props()?.overlay);
    return v_flex().id("orbit-settings").track_focus(this.handle).size_full().min_h(0).text_color(t.foreground).overflow_hidden()
      .when(popup, (el) => el.bg(t.surface.slice(0, 7) + "f2").border(2).border_color(t.border).rounded(L.radius))
      .on_key_down((e) => { if (e.key === "escape") this.close(); })
      .child(v_flex().id("settings-body").flex_1().min_h(0).px(24).pt(22).pb(10).gap(10).overflow_y_scrollbar()
        .child(line("theme", THEMES.map(([name, accent, file]) => toggle(`theme-${accent}`, name, t.accent.slice(0, 7).toLowerCase() === accent,
          (cx) => {
            run("app.theme", { name: file ?? name });
            // A new theme takes the keys from the dialog: Esc closes it again.
            cx.timer.after(300, () => this.handle.focus());
          }))))
        .child(line("font, others", [toggle("theme", "herdr settings…", false, () => { this.close(); run("app.settings", { section: "look" }); })]))
        .child(line("density", choices("density", PRESETS, L.density)))
        .child(line("corners", choices("rounding", CORNERS, L.rounding ?? null)))
        .child(line("gap", choices("gap", GAPS, L.gapSet ?? null)))
        .child(line("tab rows", ["bottom", "top"].map((v) => toggle(`tabs-${v}`, v, (L.tabs ?? "bottom") === v, () => this.set({ tabs: v })))))
        .child(line("background", background))
        .when(found.length > 0, (el) => el.child(line("", found)))
        .when(Boolean(this.error), (el) => el.child(div().ml(LABEL + 6).text_size(13).text_color(t.ansi1).child(this.error ?? ""))))
      .child(h_flex().px(24).py(10).gap(22).flex_none().text_size(13).text_color(t.muted)
        .child(div().flex_1().text_size(16).font_bold().text_color(t.foreground).child("Orbit look settings"))
        .when(popup, (el) => el.child(hint("esc", "close"))));
  }
}
