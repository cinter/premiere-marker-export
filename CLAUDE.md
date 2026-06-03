# Premiere Marker Export — guidance for Claude Code

This repo is an Adobe Premiere Pro **CEP panel** (`com.texs.markerexport/`) plus
installer scripts. People clone it and ask you to install it. Here's how.

## Installing the panel for a user

The panel is unsigned, so two things must happen: enable `PlayerDebugMode` (lets
Premiere load unsigned panels) and place the panel in the CEP extensions folder.
The cross-platform installers already do both — **prefer running them** over
doing the steps by hand:

- **macOS / Linux:** run `./install.sh`
- **Windows:** run `./install.ps1` in PowerShell

Detect the OS first and run the matching script. After it finishes, tell the
user to **fully quit and reopen Premiere Pro**, then open
**Window → Extensions → Marker Export**.

If a user is on macOS but the scripts are missing/edited, the manual equivalent
is: `defaults write com.adobe.CSXS.<v> PlayerDebugMode 1` for CEP versions 9–13,
then symlink/copy `com.texs.markerexport` into
`~/Library/Application Support/Adobe/CEP/extensions/`.

## Uninstalling

Delete `com.texs.markerexport` from the CEP extensions folder
(`~/Library/Application Support/Adobe/CEP/extensions/` on macOS,
`%APPDATA%\Adobe\CEP\extensions\` on Windows). Leaving `PlayerDebugMode` on is
harmless.

## Editing the panel

- UI: `com.texs.markerexport/index.html`, `js/client.js`
- Premiere logic (ExtendScript): `com.texs.markerexport/host/export-markers.jsx`
- `js/client.js` talks to the host via `evalScript`; host functions return
  tab-separated or `ERROR:`-prefixed strings that the client parses.
- After editing, the user just closes and reopens the panel (no reinstall needed
  if installed via symlink on macOS; Windows copies, so re-run `install.ps1`).
