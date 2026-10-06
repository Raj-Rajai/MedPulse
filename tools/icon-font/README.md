# MedPulse icon font

The portals write icons as emoji in their labels (`💾 Save`, `📅 Next visit`, …). Instead of the
colourful system emoji, `apps/web/src/styles/controls.css` loads **MedPulse Icons**, a small font
whose glyphs sit on those same emoji code points and draw clean line icons from
[Lucide](https://lucide.dev) (ISC licence, free, no attribution needed). Every portal font stack
starts with it, so each emoji renders as a line icon in the surrounding text colour, in buttons,
badges, toasts and even dropdown options.

* To use an icon in new UI, type the emoji listed in `icons.json` (for example `🗑` for a trash can).
  Skip the U+FE0F variation selector: it asks the browser for colour emoji.
* To keep a real emoji somewhere (the sidebar user badge does this), add U+FE0F after it.
* To add or change icons, edit `icons.json` and run `build.py` (instructions at the top of it).
