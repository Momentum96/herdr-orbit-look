# Orbit layout for Herdr

A layout for the Herdr app (herdr-app): a space picture behind everything,
glass panels over it, and each space with a colour and a symbol of its own.

This is an unofficial layout. It is not affiliated with or endorsed by Herdr.
It uses only what herdr-app offers to everyone (a layout, mods and a theme)
and doesn't change the app. Made for herdr-app 0.1.11.

**This fork** adds macOS support, checked on herdr-app 0.1.15 (Apple Silicon):
the cpu, ram and disk widgets, the background file dialog, `install.sh` on
macOS's bash 3.2 and a Cmd keyset. See [macOS](#macos).

**Version 4**. See [Updating](#updating).

![Orbit: the sidebar, two panes with the picker open in the right one, the taskbar with a pinned space](preview.png)

## Add it

Copy the three folders into herdr-app's home (`~/.config/herdr-app`, or
`$HERDR_APP_HOME`):

```sh
cp -r layouts/. ~/.config/herdr-app/layouts/
cp -r mods/. ~/.config/herdr-app/mods/
cp -r themes/. ~/.config/herdr-app/themes/
```

Then merge `keys.json` into herdr-app's `keys.json`: add its `"layout:orbit"`
section (those keys apply only while the orbit layout shows; see Keys), and
pick the **orbit** layout in herdr-app's settings (or `ctrl-shift-l`).
`ctrl-shift-l` switches back to your own layout; deleting the files removes it.
Check a name isn't taken first: the layout is `orbit`, the mods are `orbit` and
`orbit-*`, the themes are named by their palettes: `tokyo-night`,
`catppuccin-mocha`, `everforest`, `gruvbox-dark`, `kanagawa`, `nord`,
`rose-pine`.
A theme of yours under one of those names is moved aside by `./install.sh`
(to its backup folder), never overwritten.

The picker's own list is `orbit-windows.json` in herdr-app's home (see the
picker below). Without the file the list is empty; to start one, copy
`defaults/orbit-windows.json` there.

`./install.sh` does the same copy and the keys merge, creates
`orbit-windows.json` from `defaults/` when it's missing (never overwriting
it), keeps a list of what it copied, moves aside anything of yours under the same name, and
`./install.sh --remove` takes it away again. It is a convenience: nothing
needs it.

### macOS

- `./install.sh` runs on the system bash (3.2) and merges `keys.macos.json`
  instead of `keys.json`: the same commands on Cmd keys (see Keys), so
  Ctrl-1..9 stay herdr's space keys. Merging by hand, use that file.
- The cpu, ram and disk widgets read the machine through `python3` (ctypes into
  libSystem; the Command Line Tools' or Homebrew's) once a second and BSD
  `df -P` every 30 s. Without a real `python3` (only the stub that asks to
  install the Command Line Tools) cpu and ram stay hidden; disk still shows.
  ram is counted as Activity Monitor does: app memory, wired and compressed.
- "background…" opens the macOS file dialog (`osascript`'s `choose file`).
- The layout switch is `cmd-shift-l`, the sidebar `cmd-b`.

## Updating

Installed copies don't update by themselves. To see which version you have:
`"orbit.version"` in `shared.json` in herdr-app's home (the `orbit` mod writes
it), or `VERSION` at the top of `mods/orbit/main.js`.

Herdr's add flow never overwrites: adding this repo again would make a second
copy (`orbit-2`, ...). To update, either:

- tell your agent: "replace my orbit layout, the orbit-* mods and the
  orbit look's themes with the latest from github.com/Calonca/herdr-orbit-look"
  (it removes `layouts/orbit.json`, `layouts/orbit.svg`, `mods/orbit`, every
  `mods/orbit-*`, the look's themes (`themes/orbit*.json` from before, and
  the files in the repo's `themes/`) first, then copies the new ones and
  replaces the `layout:orbit` section of `keys.json`; your other files and
  keys, `orbit-windows.json` and the pictures in `backgrounds/` stay as they
  are); or
- run `./install.sh` from a fresh clone: it replaces what it installed before
  and moves anything else under the same names to a backup folder.

Your clicks (sizes, what's shown) stay in `layouts/.state/`, your settings
(`"orbit.settings"` in `shared.json`) stay, and your `orbit-windows.json` is
never replaced.

The themes were called `orbit` and `orbit-*` before; they're named by their
palettes now (`orbit` is `tokyo-night`). `./install.sh` picks your theme
again under its new name, so the colours stay; by hand, pick it again in the
look settings.

Version 4 adds the taskbar to the status bar (a card for each pinned, shown,
waiting or working space; right-click to pin, drag to move), cpu, ram and
disk as bars that open a popup, the look settings in the right pane (`ctrl-,`)
and a split for each space (the panes' sizes and the side panel's width). The
status bar's side panel button, `?` and agent counts are gone: the
`orbit.side-panel` command opens the side panel. The themes are renamed (see
above). A space's colour and symbol now come from its repository, so some
spaces change theirs once.

Version 3 adds the settings, the six themes and the `ctrl-,` key. Its
corners and gap start on "auto", the density's (16 and 14 at comfortable):
the panels stand apart with rounded corners. For the look of versions 1 and 2
(panels touching, corners of 4), pick corners 4 and gap "none". From
version 1, two mods go: `orbit-panel-tabs` and `orbit-nothing` (now part of
`orbit-tabs` and `orbit-edge`).

## What you see

- **Background**: a generated space picture (`mods/orbit/backgrounds/`), with
  the sidebar, the pane, its tab row and the status bar as glass over it: the
  theme's surface, a little see-through, over a blurred copy of the picture.
  A picture of your own can replace it (settings); the glass over it is the
  plain see-through surface, without the blur.
- **Space colours**: every space gets one of six colours and one of 8 symbols
  from a hash of its repository's name (its origin's, else its main
  checkout's folder), so the same repo on another machine and every worktree
  of it look the same; a space outside a repo goes by its own name. The pane's outline, its tab row and the space's row in
  the sidebar use that colour.
- **Sidebar** (`orbit-spaces`, a restyled clone of herdr-app's `spaces`, and
  `orbit-sidebar-footer`): a header per machine; each space with its symbol
  (filled by its agents' state), its name, and its branch and ahead/behind;
  worktrees hang from their repo with tree lines and a fold toggle. Click
  switches, right-click opens herdr's space menu, drag reorders. At the foot,
  "▸ agents" folds herdr's agents list in, and "open folder" makes a space.
- **Two panes** (`orbit-tabs`, `orbit-edge`): each framed by an outline, the
  one with the keys in the space's colour, and its tab row as the bottom of
  that outline, the shown tab a folder tab open into the content. Each tab has
  its program's icon and its agent's state (working yellow, blocked red, done
  green).
  - The left pane shows the space's own tabs (the space's symbol and name
    are in the status bar's taskbar). The right pane, beside it, holds terminals and views of its own,
    per space; the split toggle at the left row's right end shows it or puts
    it away (nothing closes).
  - Each space keeps its own split: drag the divider between the panes (or
    the side panel's edge) in one space, and the others keep theirs;
    switching back gives that space's again. A space never resized, and a
    new one, has the split the layout had before any space kept one.
  - Click shows a tab; double-click renames it; drag moves it; middle-click
    closes it (a terminal asks first: Enter or the same close again confirms);
    right-click opens its menu (Rename, then herdr's pane items: split, zoom,
    close the pane).
  - `+ >_` opens a new terminal in that pane; `+ ⠿` a "new window" tab with
    the picker (`orbit-add`): a shell, the coding agents installed here,
    herdr's files, changes and agents, your own list, herdr's settings, and
    "configure windows…". Type to filter, ↑/↓, Enter, Esc puts back what was
    shown.
  - Your own list is `orbit-windows.json` in herdr-app's home. Each entry is
    a `title`, an optional `about` and `icon` (an .svg under that folder),
    then either a `mod` (a folder in `mods/`) with optional `props`, opened in
    the pane, or a `command` (any herdr-app command) with optional `args`.
    `$folder` in props or args becomes the pane's folder:
    `{ "windows": [ { "title": "Notes", "mod": "my-notes", "props": { "folder": "$folder" } } ] }`.
    The picker reads the file each time it shows; a broken file shows its
    error there, and the rest of the picker still works.
  - "configure windows…" copies a prompt for your own agent to the clipboard
    (the file, the format, where installed mods and their props are) and
    shows a toast with the file's path.
- **Side panel** (its tab row is `orbit-tabs` too): herdr's files and changes to start
  with, framed as the panes are, with a tab each. `+ ⠿` picks another view
  for it; tabs rename, move and close like the panes' (right-click: Rename,
  Close, Hide the panel). The `orbit.side-panel` command opens and closes
  it; dragged narrower than half its smallest width, it closes. Clicking in
  the panel moves the coloured outline there.
- **Menus and dialogs** (`orbit-dialogs`): the sidebar's "menu" (search,
  settings, add machine, new space, the space's rename, worktrees and close,
  keybinds), a tab's menu, the close dialog, the switcher of recent spaces,
  the "make tab N" prompt, and the look settings.
- **Orbit look settings** (`ctrl-,`, or "Orbit look settings" in the
  picker), a view in the right pane like the picker's others (a second
  `ctrl-,` shows the one already open): the theme, density
  (compact, default, comfortable), corners, the gap between the panels, the
  tab rows at the bottom or on top, and the background picture. Corners and
  gap start on "auto", the density's own. They apply
  at once and are kept in `shared.json` (`"orbit.settings"`).
- **Status bar** (`orbit-status`): on the left the sidebar toggle, then
  after a thin line the taskbar, then "herdr offline" while the core can't be
  reached, folded tabs and an update pill; on the right cpu, ram and disk
  use as small bars (blue, yellow from 70%, red from
  90%) and the clock.
  - The taskbar: a card per space that is pinned (in pin order), shown, or
    has agents that finished or wait for you, then those at work (each group
    most recent first). A card is the space's symbol, drawn as the sidebar draws it (filled in
    its agents' state colour while one is blocked, working or done, else
    empty; outlined in the space's colour when shown), and its name.
    Click shows the space; right-click pins or unpins it; drag a card onto
    another to move it there (it's pinned then). A pinned card has a pin after
    its name. An unpinned space leaves once
    its agents are idle. Pins are kept in `shared.json` (`"orbit.pinned"`).
  - cpu, ram and disk open a popup with the details above them (each core,
    the load; used, available, swap; the filesystem); a second click closes
    it, and "open in pane ⇥" opens the same view in the right pane.
- **Themes**: Tokyo Night (`tokyo-night`, the layout's own), Catppuccin
  Mocha, Everforest, Gruvbox Dark, Kanagawa, Nord and Rosé Pine
  (`themes/*.json`, each palette as it is), each with its own six space
  colours. Pick one in
  the settings or in herdr-app's (any other theme works too: the space
  colours are then its ANSI colours). Terminals keep your own font (herdr-app's
  settings); this fork leaves the layout's JetBrains Mono out, so Hangul and
  other wide scripts aren't drawn from a fallback font with gaps.

## Keys

`keys.json`'s `"layout:orbit"` section, on the pane with the keys:

| Keys | What they do |
|---|---|
| `ctrl-1` … `ctrl-9` | its tab N (on the left with no tab N: a prompt to make it, a name and an optional command) |
| `ctrl-pagedown`, `alt-]` / `ctrl-pageup`, `alt-[`, `ctrl-shift-tab` | its next / previous tab |
| `ctrl-shift-t` | a new terminal in it |
| `ctrl-shift-o`, `ctrl-shift-e` | a "new window" tab in the right pane (opens it) |
| `ctrl-shift-w`, `ctrl-shift-x` | close its shown tab (a terminal asks; again confirms) |
| `alt-h`, `alt-left` / `alt-l`, `alt-right` | the keys to the left / right pane |
| `alt-shift-h`, `alt-shift-l` | move the shown terminal tab to the other pane |
| `ctrl-tab` | back to the space shown before this one |
| `ctrl-shift-space` | the recent spaces, most recent first (↑/↓ or Tab, 1-9 or Enter, Esc) |
| `ctrl-,` | Orbit look settings, in the right pane |

They are commands of the `orbit` mod (`orbit.<name>`); its header lists the
rest (`orbit.split`, `orbit.side-panel`, `orbit.add`, `orbit.window`).
herdr-app's own keys work as usual for everything else (`ctrl-shift-b` the
sidebar, `ctrl-shift-l` the layout).

On macOS, `keys.macos.json` (what `./install.sh` merges there):

| Keys | What they do |
|---|---|
| `cmd-1` … `cmd-9` | its tab N |
| `cmd-shift-]` / `cmd-shift-[`, `ctrl-shift-tab` | its next / previous tab |
| `cmd-t` | a new terminal in it |
| `cmd-shift-o` | a "new window" tab in the right pane |
| `cmd-w` | close its shown tab (a terminal asks; again confirms) |
| `cmd-alt-left` / `cmd-alt-right` | the keys to the left / right pane |
| `cmd-alt-shift-left`, `cmd-alt-shift-right` | move the shown terminal tab to the other pane |
| `ctrl-tab` | back to the space shown before this one |
| `ctrl-shift-space` | the recent spaces |
| `cmd-shift-,` | Orbit look settings, in the right pane |

Option-letter and Option-bracket keys are left to typing (they make characters
on Mac keyboards), and `cmd-,` stays herdr-app's settings.

## What the mods run and read

- `orbit-spaces` runs `git status` and `git rev-parse` in each space's folder
  (on that space's machine), runs `hc machine ls`, and watches local repos'
  git folders for changes.
- `orbit` runs `git rev-parse` in each space's folder, so a worktree gets its
  repo's colour; `orbit-sidebar-footer` and `orbit-dialogs` (the menu) run it
  to offer the worktree items.
- `orbit-dialogs` (the settings), only when you click "background…": runs
  `osascript` on macOS, else KDE's `kdialog` or, without it, GNOME's `zenity` to open a file dialog
  (from a toolbox or a flatpak, the host's, through `flatpak-spawn --host`);
  with neither, it opens herdr-app's folder picker and lists the pictures in
  the folder you pick (`ls`). The picture you choose is copied (`cp`) into
  `backgrounds/` in herdr-app's home, and the dialog's answer goes through
  `data/orbit-settings/` there. Theme buttons run herdr-app's `app.theme`.
- `orbit-add` asks herdr-app which coding agents are installed
  (`knownAgents`), and reads `orbit-windows.json` from herdr-app's home each
  time it shows: what that file lists opens or runs when you pick it (a mod,
  or a herdr-app command with its args). "configure windows…" writes a prompt
  to the clipboard.
- `orbit-status` reads `/proc/stat`, `/proc/loadavg` and `/proc/meminfo`, and
  runs `df` on your home folder every 30 s. On macOS it runs `python3` once a
  second instead of reading /proc (and `xcode-select -p` once, to tell a real
  python3 from the stub), and `df -P`.
- `orbit` reads and writes `layouts/orbit.json` in herdr-app's home: it puts
  the settings, the shown theme's glass colours, the space's outline colour,
  the right pane's terminals and views and the side panel's views there.
- None of them uses the network.

## Files

- `layouts/orbit.json`, `layouts/orbit.svg` (its preview in settings)
- `mods/orbit/`: the layout's own block, with the background pictures. It
  is the only one that changes the layout file and the panes' state: it keeps
  them in step, takes the keys' commands, and makes the changes the other
  mods ask for (a tab shown, closed, renamed, moved, a new one).
- `mods/orbit-*/`: what you see: the sidebar (`orbit-spaces`,
  `orbit-sidebar-footer`), the status bar (`orbit-status`), the tab rows
  (`orbit-tabs`), the pane outline (`orbit-edge`), the picker (`orbit-add`),
  the menus and dialogs (`orbit-dialogs`).
- A mod can only import files from its own folder, so a few small shared
  files (`look.js`, `glass.js`, ...) are copied into the mods that use them:
  the copies are the same file. What every mod would otherwise work out
  again (each space's colour and symbol, the look, where the tab rows sit)
  the `orbit` mod works out once and shares.
- `themes/`: Tokyo Night and the six others
- `keys.json`: the keys, to merge into herdr-app's
- `defaults/orbit-windows.json`: an empty list for the picker, to copy into
  herdr-app's home when you have none
- `scripts/space.py` and `scripts/blur.py` make the background and its blurred
  copy; `scripts/glyphs.py` the symbols. Only needed to change them.
- `scripts/sandbox`: a throwaway herdr-app on its own core, home and display
  (headless, or a private Xvfb with `SANDBOX_X11=1`), to try changes in.
  `tools/regress.py` clicks through the status bar there (its popups and
  menus where they open, the taskbar's order, pins and drag, the look
  settings), by default on a HiDPI screen (scale 2) at zoom 1.2; `node tools/taskbar-test.mjs` and
  `node tools/identity-test.mjs` check the taskbar's order and what a space's
  colour is keyed on, without a window.

## Credits

- The `tokyo-night` theme's colours are the Tokyo Night palette by Enkia
  ([tokyo-night-vscode-theme](https://github.com/tokyo-night/tokyo-night-vscode-theme),
  MIT).
- The six others' colours are each palette's own:
  - Catppuccin Mocha by Catppuccin, [catppuccin/catppuccin](https://github.com/catppuccin/catppuccin)
    ([MIT](https://github.com/catppuccin/catppuccin/blob/main/LICENSE));
  - Everforest by sainnhe, [sainnhe/everforest](https://github.com/sainnhe/everforest)
    ([MIT](https://github.com/sainnhe/everforest/blob/master/LICENSE));
  - Gruvbox Dark by morhetz, [morhetz/gruvbox](https://github.com/morhetz/gruvbox)
    (MIT/X11, as its README states; the repo has no license file);
  - Kanagawa by Tommaso Laurenzi, [rebelot/kanagawa.nvim](https://github.com/rebelot/kanagawa.nvim)
    ([MIT](https://github.com/rebelot/kanagawa.nvim/blob/master/LICENSE));
  - Nord by Sven Greb, [nordtheme/nord](https://github.com/nordtheme/nord)
    ([MIT](https://github.com/nordtheme/nord/blob/develop/license));
  - Rosé Pine by mvllow, [rose-pine/rose-pine-palette](https://github.com/rose-pine/rose-pine-palette)
    ([MIT](https://github.com/rose-pine/rose-pine-palette/blob/main/LICENSE)).
- The space background is generated by `scripts/space.py` (procedural:
  gradients, seeded stars, a planet), not a photo or a third-party image;
  `scripts/blur.py` makes its blurred copy. Both scripts reproduce the files
  in `mods/orbit/backgrounds/` exactly.

## License

Apache-2.0 (see `LICENSE`), the same as Herdr.

Parts derived from herdr-app's own files (Apache-2.0) and changed:

- `mods/orbit-spaces/` from herdr-app's `spaces` mod: restyled rows, identity
  symbols and colours, worktrees under their repo, the glass background (its
  `main.js` says so too, and its `mod.json` records `cloned_from`);
- `layouts/orbit.json` from herdr-app's `main` layout: rebuilt into the
  sidebar, two framed panes with their tab rows, the side panel and the
  status bar, with its own theme, fonts and background;
- `mods/orbit-dialogs/menu.js` from herdr-app's `menu` mod, and the pane
  items in each `tabmenu.js` from that menu's pane items: other items, Rename
  opening a tab's name field (the file says so too). Its icons are herdr-app's
  own, from its shipped `workspace-chrome` mod.
