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

- **Uses deprecated `execCommand('insertText')` function to inject text.** This is by design. `execCommand` has been officially deprecated for some time but all major browsers still support it. If it succeeds, we get the browser's native caret-position insertion, number-input sanitation, and undo support for free. If not, we set the input's value directly, using its own insertion point calculation and number normalization that isn't guaranteed to match the browser's native behavior, and undo goes out the window.

- **Only operates when `paste` events are fired.** It's a good bet this covers all real-world cases, but a site that somehow blocked the `paste` event from ever firing (by disabling the relevant keyboard shortcuts and menu options, for example) would successfully evade the Ninja.

## License

MIT — see [LICENSE](LICENSE).
