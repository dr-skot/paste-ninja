# PasteNinja

Browser extension that slips past paste blockers, defending your god-given right to copy-and-paste.

Some sites reject paste on sensitive inputs, apparently thinking it enhances security. Nonsense. No real-world attacker is thwarted by a clipboard blocker, and forcing users to type passwords only incentivizes them to make weaker ones. Account numbers and strong passwords are hard to transport mentally _by design_. Copy-pasting them is just good practice, less laborious and less error prone than entering them by hand.

Some sites reject paste on retype-your-email fields, in an absurd attempt to reduce typos by forcing typing!

PasteNinja is here to help you fight back. Your clipboard belongs to you. Don't let websites tell you when you can and can't use it.

## How it works

Unlike other tools that disable all paste listeners preemptively, PasteNinja only strikes after the crime has been committed. It lets paste events propagate normally and quietly watches. If the value in the target field doesn't change, PastNinja injects the clipboard text by stealth. Acting only when paste is rejected outright avoids breaking sites that use their paste listeners for good, eg Google Sheets.

## Install (Brave / Chrome / Edge — side-load)

1. Open `brave://extensions/` (or `chrome://extensions/`).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Pick this folder (`~/projects/paste-ninja/`).
5. Done. The extension runs on all sites.

## Verify

After install:

- Visit a site that blocks paste (e.g. paste-test.glitch.me or any payment form known to block).
- Copy a string. Click into the paste-blocked field. Cmd-V (or right-click → Paste).
- The field should briefly outline green and contain the pasted text.
- DevTools Console: you'll see `[PasteNinja] paste blocked, injecting N chars into <input>` — only when injection was needed. Sites that work normally produce no log.

## Limitations

- **iframes** are supported — `all_frames: true` in manifest means the content script runs inside iframes too.
- **Some banking sites** intentionally prompt you to confirm large-number pastes. PasteNinja bypasses these. You take on full responsibility for paste correctness.
- **`<input type="number">` with formatted clipboard content**: PasteNinja strips non-numeric chars and injects the digits (e.g. `"$1,300"` → `"1300"`, `"3024 234 1213 3432"` → `"302423412133432"`). If nothing useful remains (`"supercalifragilistic..."`), it bails and leaves the field untouched. This approximates Chromium's native extraction without replicating its full state machine.

## Files

- `manifest.json` — MV3 extension manifest
- `content.js` — the actual logic (~50 lines)
- `icons/` — extension icons (16/48/128 px)

## Publishing (later)

To put on the Chrome Web Store:

1. Pay one-time $5 dev fee at the Chrome Developer Dashboard.
2. Zip the contents of this directory.
3. Upload, write a description, attach screenshots (1280x800), set a privacy policy URL.
4. Justify the `<all_urls>` permission in your listing.
5. Review takes 1–14 days.
