# PasteNinja research notes

Working reference assembled from issue-tracker spelunking and discussion analysis. Source of truth for the README's positioning claims.

## The architectural tradeoff (the headline finding)

**DFWP's mechanism**: preemptively neutralizes paste-event handlers — strips listeners or no-op's `preventDefault`. Cannot distinguish a blocker from a legitimate paste handler.

**Consequence**: DFWP must choose between (a) running default-on and breaking sites that use paste handlers virtuously, or (b) running default-off and requiring per-site manual whitelisting. It picked (b) starting in v2.

**PasteNinja's mechanism**: reactive — listens for `paste`, snapshots the field, waits 50ms, checks if the value updated. Only intervenes if the field genuinely failed to update. Legitimate handlers result in updates → PasteNinja stays out. Blockers result in no update → PasteNinja injects.

**Consequence**: PasteNinja can safely run default-on. The reactive design *is* the resolution to the tradeoff DFWP couldn't escape.

## DFWP maintainer's own acknowledgments

Jeff Swanner (DFWP author) has closed multiple issues with comments that explicitly name apps DFWP breaks. Quotes verbatim from the GitHub issues:

> *"I think the number of sites that people commonly use that are good with `paste` far outnumber the number of sites that are bad with `paste`."* — [#14](https://github.com/jswanner/DontF-WithPaste/issues/14)

> *"With the release of version 2, the extension is no longer active on any site by default, which should alleviate this problem."* — [#14](https://github.com/jswanner/DontF-WithPaste/issues/14)

> *"I do not recommend having the extension active on all sites. Having the extension active on sites that do helpful things with copy and paste events (like GitHub, Slack and many others) will lead to a degraded browsing experience."* — [#88](https://github.com/jswanner/DontF-WithPaste/issues/88)

> *"There's no reason to have the extension configured so that it's active while on GMail. The whole reason for the extension's configuration mechanism is so that you only activate the extension on sites that do bad things with `paste` events."* — [#97](https://github.com/jswanner/DontF-WithPaste/issues/97)

> *"GitHub & Google's applications are great examples"* [of sites where DFWP should not be active]. When a user asked for default-on-with-blocklist: *"that seems very backwards to me."* — [#114](https://github.com/jswanner/DontF-WithPaste/issues/114)

The v2 release switching DFWP from default-on to default-off was driven by these reports. This is documented architectural surrender.

## DFWP's official disclaimers (from its README)

1. *"This extension does not try to prevent a site from also interfering with keyboard shortcuts related to those browser actions (control-v, command-v, etc.)"*
2. *"...nor does this extension prevent sites from interfering with the 'contextmenu' event (right click menu)."*
3. *"Note: this will not prevent blocking of clipboard events in iframes."*

**PasteNinja shares #1 and #2** — sites that block at `keydown` or `contextmenu` level prevent the `paste` event from ever firing, so PasteNinja can't intervene either. **PasteNinja is genuinely better on #3** — `all_frames: true` in `manifest.json` covers iframes.

## StopTheMadness uses the same mechanism family

Jeff Johnson's StopTheMadness Pro ($16 on Mac App Store) is closed-source but description-wise and reviewer-wise uses the same preemptive listener-neutralization approach as DFWP. Same fundamental tradeoff. Same advice from author: per-site enable.

---

## Test target list

Two categories. All issue numbers reference [jswanner/DontF-WithPaste](https://github.com/jswanner/DontF-WithPaste).

### A. Sites where DFWP *fails to defeat* the paste blocker

PasteNinja should succeed where DFWP doesn't. Mostly modern apps with React/Vue controlled inputs or other input-event-level rejection. **These are the empirical wins to claim in the README.**

| Site | DFWP issue | Notes |
|---|---|---|
| Chase Connect token field | [#142](https://github.com/jswanner/DontF-WithPaste/issues/142) | Banking |
| ICICI Internet Banking | [#135](https://github.com/jswanner/DontF-WithPaste/issues/135) | Indian banking |
| State Bank of India (onlinesbi.com) | [#66](https://github.com/jswanner/DontF-WithPaste/issues/66) | Indian banking, possibly contextmenu blocker |
| Bank of India (starconnectcbs.bankofindia.com) | [#47](https://github.com/jswanner/DontF-WithPaste/issues/47) | Indian banking |
| Generic banking site | [#93](https://github.com/jswanner/DontF-WithPaste/issues/93) | Unspecified |
| Fidelity | [#121](https://github.com/jswanner/DontF-WithPaste/issues/121) | Financial |
| Office 365 login | [#127](https://github.com/jswanner/DontF-WithPaste/issues/127) | Microsoft |
| GoDaddy | [#120](https://github.com/jswanner/DontF-WithPaste/issues/120) | |
| TreasuryDirect.gov | [#125](https://github.com/jswanner/DontF-WithPaste/issues/125) | US government |
| dmv.ca.gov | [#102](https://github.com/jswanner/DontF-WithPaste/issues/102) | California DMV |
| egov.maryland.gov/SDAT | [#122](https://github.com/jswanner/DontF-WithPaste/issues/122) | Maryland gov |
| Reddit | [#119](https://github.com/jswanner/DontF-WithPaste/issues/119) | |
| Facebook reply fields | [#116](https://github.com/jswanner/DontF-WithPaste/issues/116) | |
| Tekstac | [#139](https://github.com/jswanner/DontF-WithPaste/issues/139), [#128](https://github.com/jswanner/DontF-WithPaste/issues/128) | Coding education platform |
| publishersclearinghouse.com | [#110](https://github.com/jswanner/DontF-WithPaste/issues/110) | |
| Airmiles | [#123](https://github.com/jswanner/DontF-WithPaste/issues/123) | |
| Amalgamated Dwellings payment | (project-origin) | The site that prompted PasteNinja's existence. Not in DFWP tracker. |

### B. Sites where DFWP *breaks legitimate paste functionality*

PasteNinja should leave these alone. **Confirmation that PasteNinja works on these is the "doesn't break what works" claim.**

| Site | What DFWP breaks | DFWP issue | Verified live? |
|---|---|---|---|
| Gmail | Image paste in compose | [#97](https://github.com/jswanner/DontF-WithPaste/issues/97) | **No — stale.** Tested 2026-06-10: DFWP no longer breaks Gmail image paste. |
| Google Sheets | Cell copy/paste broken | [#114](https://github.com/jswanner/DontF-WithPaste/issues/114) | **YES — verified 2026-06-10.** With DFWP enabled, copy/paste of cell ranges fails entirely. PasteNinja leaves Sheets alone. |
| Slack | Image paste, newline preservation | [#14](https://github.com/jswanner/DontF-WithPaste/issues/14), [#45](https://github.com/jswanner/DontF-WithPaste/issues/45), [#88](https://github.com/jswanner/DontF-WithPaste/issues/88) |
| WhatsApp Web | Image paste | [#88](https://github.com/jswanner/DontF-WithPaste/issues/88) |
| Twitter | Image paste | mentioned in [#14](https://github.com/jswanner/DontF-WithPaste/issues/14) comments |
| Trello | Image paste | mentioned in [#14](https://github.com/jswanner/DontF-WithPaste/issues/14) comments |
| Doorbell | Image paste | [#14](https://github.com/jswanner/DontF-WithPaste/issues/14) |
| Disqus | Image paste | DFWP Chrome Web Store reviews |
| GitHub | File paste → upload | named by maintainer in [#97](https://github.com/jswanner/DontF-WithPaste/issues/97), [#114](https://github.com/jswanner/DontF-WithPaste/issues/114) |

## Online sentiment baseline

Paste-blocking is widely hated. Reference points if you want to write about the problem:

- **NIST 800-63b** and **UK NCSC** both advise against blocking paste in password fields.
- [Nicholas Zakas — Disabling paste in textboxes is not a security feature](https://humanwhocodes.com/blog/2023/07/disabling-paste-textboxes-security/) — technical deep dive, names the two motivations (fear of attack vs fear of typos in confirm fields).
- [HN thread on DFWP](https://news.ycombinator.com/item?id=39636470) — overwhelmingly anti-blocking.
- [StationX — "I F*cking Hate This"](https://www.stationx.net/i-fcking-hate-this-blocking-password-pasting/) — rant.
- [LevelBlue — Password Paste Prevention: Security Friend or Foe?](https://levelblue.com/blogs/security-essentials/password-paste-prevention-security-friend-or-foe) — security-industry view.

## Dead links / stale references

- `paste-test.glitch.me` — returns HTTP 410 Gone. Cannot be used in the README's Verify section. Replace with `test.html` (local) or one of the Category A sites.
- DFWP issue tracker has high decay rate. Live-tested 2026-06-10 and found stale: GoDaddy login (#120), TreasuryDirect login (#125), Maryland SDAT (#122), Gmail image paste (#97), Slack image paste (#14/#88). All now work normally with DFWP enabled or without any extension. Issue list should be re-verified before being cited as proof of current breakage.

## Testing methodology notes

- **Extension state caching** — toggling extensions in `brave://extensions` does NOT reliably re-init their content scripts on already-open tabs. Stale state persists even after hard refresh. **Must quit and relaunch Brave** to be confident about which extensions are active for a test. Closing the tab also works but is less reliable than full restart.
- **Test order matters** — testing the "broken" state (extension on) before the baseline (everything off) gives cleaner signal because there's less previous state to unstick.

## Open questions

- Whether the Indian banking sites (ICICI, SBI, Bank of India) use contextmenu blocking specifically (which neither extension can defeat) or React-style controlled inputs (which PasteNinja can defeat but DFWP can't). Worth verifying before claiming as PasteNinja wins.
- Whether Reddit and Facebook reply field reports are still current — both are heavily updated apps; original issues may be stale.
- Whether PasteNinja's reactive detection survives sites that use *very fast* synchronous reverts (sub-50ms). No known real-world examples, but worth confirming on Chase / Fidelity.
