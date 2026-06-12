# PasteNinja

Browser extension that slips past paste blockers, defending your god-given right to copy-and-paste.

Some sites reject paste on sensitive inputs, apparently thinking it enhances security. Nonsense. No real-world attacker is thwarted by a clipboard blocker, and forcing users to type passwords only incentivizes them to make weaker ones. Account numbers and strong passwords are hard to transport mentally _by design_. Copy-pasting them is good practice—less laborious and less error-prone than entering them by hand.

Some sites reject paste on retype-your-email fields, forcing the user to type in an theater of preventing typos!

PasteNinja is here to help you fight the madness. Your clipboard belongs to you; don't let websites tell you when you can and can't use it.

## How it works

Unlike other tools that disable paste listeners preemptively, PasteNinja only strikes when a crime has been committed. It lets paste events propagate normally and quietly watches. If the value in the target field isn't changed by the paste, PastNinja injects the clipboard text by stealth. Acting only when paste is rejected avoids breaking sites that use their paste listeners for good, eg Google Sheets.

## Install

### From the Chrome Web Store

_Coming soon._

### From source

1. Clone or download this repo.
2. Open `brave://extensions/` (or `chrome://extensions/`).
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked** and pick this folder.
5. Done. The extension runs on all sites.

## Known issues

- **`<input type="number">` with invalid pasted content.** When PasteNinja injects text into a number field, the browser's char-by-char extraction filter decides what's accepted (e.g. `$1,300` → `1300`, `(212) 555-1212` → `2125551212` or `212555-1212` depending on the browser). Behavior is not guaranteed to match what the same paste would produce natively, and edge cases — particularly pasting more bad content into a field that's already in a bad-input state — may diverge from native in ways we can't observe or correct from JavaScript. The displayed text of an invalid-state number field is sealed inside the input's shadow DOM and unreadable by extensions.

- **Paste blockers at the keyboard or context-menu level.** If a site captures Cmd-V/Ctrl-V at the `keydown` event (or right-click at the `contextmenu` event) before the browser ever dispatches a `paste` event, PasteNinja never sees the attempt. Same limitation as every other paste-event-based unblocker.

- **`execCommand("insertText")` is deprecated.** PasteNinja uses it as the primary injection path because it integrates with the browser's undo stack, handles caret position natively, and routes through the same sanitization the browser uses for typed input. There's a fallback path using `HTMLInputElement.prototype.value` setter for browsers where `execCommand` returns false, but undo isn't preserved in that path. If browsers eventually drop `execCommand` entirely, PasteNinja will lose Cmd-Z support and need a rewrite.

## License

MIT — see [LICENSE](LICENSE).
