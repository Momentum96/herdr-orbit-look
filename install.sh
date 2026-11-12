#!/usr/bin/env bash
# Copies the orbit layout, its mods and themes into herdr-app's home
# ($HERDR_APP_HOME, else ~/.config/herdr-app). Optional: copying the layouts/,
# mods/ and themes/ folders by hand does the same. Run it again after an
# update: only what differs is rewritten, and herdr-app reloads it live.
#
# What this script installed is listed in <home>/.herdr-orbit-manifest; a file
# or folder there under the same name that it didn't install is moved to
# <home>/backup-herdr-orbit-<time>/ first, never overwritten.
#
# keys.json's "layout:orbit" section (keys that apply only while the orbit
# layout shows) is merged into the home's keys.json; the rest of it stays as
# it is, and it's backed up before the first change. On macOS keys.macos.json
# is merged instead: the same commands on Cmd keys, so Ctrl-1..9 stay herdr's
# space keys.
#
#   ./install.sh            install or update
#   ./install.sh --remove   remove what this script installed (backups stay)
set -euo pipefail

repo=$(cd "$(dirname "$0")" && pwd)
home=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
manifest=$home/.herdr-orbit-manifest
backup=$home/backup-herdr-orbit-$(date +%Y%m%d-%H%M%S)
mkdir -p "$home"
touch "$manifest"

items() {
  local f
  # Themes first: a mod or layout that names one finds it there.
  for f in "$repo"/themes/*.json "$repo"/mods/*/ "$repo"/layouts/*.json "$repo"/layouts/*.svg; do
    if [[ -e $f ]]; then f=${f%/}; printf '%s\n' "${f#"$repo"/}"; fi
  done
}

ours() { grep -qxF "$1" "$manifest"; }

# Merges keys.json's sections into the home's keys.json (or, with --remove,
# takes them out).
keys() {
  [[ -f $home/keys.json ]] || { echo "no $home/keys.json yet: start herdr-app once, then run this again for the keys"; return 0; }
  local src=$repo/keys.json
  [[ $(uname) == Darwin ]] && src=$repo/keys.macos.json
  python3 - "$home/keys.json" "$src" "$backup" "${1:-}" <<'EOF'
import json, os, shutil, sys
path, src, backup, mode = sys.argv[1:5]
old = open(path).read()
keys = json.loads(old)
for section, binds in json.load(open(src)).items():
    if mode == "--remove":
        keys.pop(section, None)
    else:
        keys[section] = binds
new = json.dumps(keys, indent=2, ensure_ascii=False) + "\n"
if json.loads(new) != json.loads(old):
    os.makedirs(backup, exist_ok=True)
    shutil.copy2(path, os.path.join(backup, "keys.json"))
    open(path + ".herdr-orbit-tmp", "w").write(new)
    os.replace(path + ".herdr-orbit-tmp", path)
    print(f"updated {path} (the old one is in {backup})")
EOF
}

if [[ ${1:-} == --remove ]]; then
  while read -r rel; do
    if [[ -n $rel ]] && [[ -e $home/$rel ]]; then
      rm -rf "${home:?}/$rel"
      echo "removed $home/$rel"
    fi
  done <"$manifest"
  rm -f "$manifest"
  keys --remove
  exit 0
fi

# The themes were renamed (orbit -> tokyo-night, orbit-nord -> nord, ...).
# herdr-app drops a layout's saved clicks when the layout's own theme changes
# under them, and its theme pick in any case, so first each layout's saved
# clicks get the new names (layouts/.state), and after the copy the window,
# when it's open, is given the pick again (app.theme), so the colours stay.
repick=$(python3 - "$home" <<'PY'
import glob, json, os, sys
home = sys.argv[1]
OLD = {"orbit": "tokyo-night", **{f"orbit-{t}": t for t in
       ["catppuccin-mocha", "everforest", "gruvbox-dark", "kanagawa", "nord", "rose-pine"]}}
for path in glob.glob(f"{home}/layouts/.state/*.json"):
    try:
        state = json.load(open(path))
    except Exception:
        continue
    picks = state.get("theme") if isinstance(state.get("theme"), dict) else {}
    saved = state.get("file") if isinstance(state.get("file"), dict) else {}
    if not any(v in OLD for v in picks.values()) and saved.get("theme") not in OLD:
        continue
    if picks:
        state["theme"] = {k: OLD.get(v, v) for k, v in picks.items()}
    if saved.get("theme") in OLD:
        saved["theme"] = OLD[saved["theme"]]
    open(path + ".herdr-orbit-tmp", "w").write(json.dumps(state, indent=2) + "\n")
    os.replace(path + ".herdr-orbit-tmp", path)
    name = os.path.basename(path)[:-5]
    print(f"theme names in {path}: {picks} -> {state.get('theme')}", file=sys.stderr)
    # The light pick first, the dark one last (app.theme sets the slot of the
    # theme's own kind; the dark one is what a dark desktop shows).
    for kind in ["light", "dark"]:
        if state.get("theme", {}).get(kind):
            print(f"{name}\t{state['theme'][kind]}")
PY
)

items | while read -r rel; do
  src=$repo/$rel dst=$home/$rel
  mkdir -p "$(dirname "$dst")"
  if [[ -e $dst ]] && ! ours "$rel"; then
    mkdir -p "$backup/$(dirname "$rel")"
    mv "$dst" "$backup/$rel"
    echo "backed up $dst to $backup/$rel"
  fi
  ours "$rel" || echo "$rel" >>"$manifest"
  if [[ -e $dst ]] && diff -rq -x jsconfig.json -x "*.d.ts" "$src" "$dst" >/dev/null 2>&1; then continue; fi
  if [[ -d $src ]]; then
    # Folders are replaced whole, so a file deleted here goes there too.
    tmp=$(mktemp -d "$home/.herdr-orbit-tmp.XXXXXX")
    cp -r "$src" "$tmp/new"
    rm -rf "$dst"
    mv "$tmp/new" "$dst"
    rmdir "$tmp"
  else
    cp "$src" "$dst.herdr-orbit-tmp"
    mv "$dst.herdr-orbit-tmp" "$dst"
  fi
  echo "installed $dst"
done

# The theme picks again, in the open window (see above), for the layout it shows.
if [[ -n $repick ]] && shown=$(HERDR_APP_HOME=$home DO_NOT_TRACK=1 HERDR_TELEMETRY=0 herdr-app status 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("layout") or "")'); then
  sleep 2 # the window takes up the new theme and layout files first
  while IFS=$'\t' read -r name pick; do
    if [[ $name == "$shown" ]]; then
      HERDR_APP_HOME=$home DO_NOT_TRACK=1 HERDR_TELEMETRY=0 herdr-app do app.theme "{\"name\":\"$pick\"}" >/dev/null
      echo "theme $pick picked again for the $name layout"
    fi
  done <<<"$repick"
fi

# What this script installed and the repo no longer has goes from the home
# too. Only manifest entries: the person's own files are never touched.
gone=()
while read -r rel; do
  [[ -n $rel && ! -e $repo/$rel ]] && gone+=("$rel")
done <"$manifest"
# (${gone[@]+...}: macOS's bash 3.2 calls an empty array unbound under set -u.)
for rel in ${gone[@]+"${gone[@]}"}; do
  rm -rf "${home:?}/$rel"
  grep -vxF "$rel" "$manifest" >"$manifest.tmp" || true
  mv "$manifest.tmp" "$manifest"
  echo "removed $home/$rel (no longer in the repo)"
done

keys

# orbit-windows.json: what the "new window" picker lists besides a terminal,
# the agents and herdr's own views (mods/orbit-add/windows.js). It's the
# person's file: made from defaults/ only when missing, never overwritten, and
# not in the manifest, so --remove leaves it.
if [[ ! -e $home/orbit-windows.json ]]; then
  cp "$repo/defaults/orbit-windows.json" "$home/orbit-windows.json"
  echo "created $home/orbit-windows.json (the picker's list: edit it, or use its \"configure windows…\" row)"
fi
switch=ctrl-shift-l
[[ $(uname) == Darwin ]] && switch=cmd-shift-l
echo "done: switch to the orbit layout in herdr-app's settings (or $switch)"
