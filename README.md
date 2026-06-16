# Cube Timer

A minimal Rubik's cube speedsolving timer, live at **[cube.felixguettner.com](https://cube.felixguettner.com/)**.

- **Space bar** starts and stops the timer (one press each).
- Add an optional **note** to each solve; every run is stamped with date and time.
- **History**, **analytics** (best / mean / Ao5 / Ao12, trend, times-over-time chart), and a **leaderboard**.
- All data is cached locally in your browser (`localStorage`) — nothing leaves your machine. Export / import as JSON for backup.

## Design

Typography and palette follow the design system of [felixguettner.com](https://felixguettner.com) — self-hosted **Sabon**, paper/ink monochrome, light + dark via `prefers-color-scheme`.

## Develop

Static site, no build step. Serve the folder and open it:

```bash
python3 -m http.server 4599
```

### Fonts

`fonts/*.woff2` are subsets of the full Sabon TTFs covering the glyphs the app uses. To regenerate after changing copy:

```bash
pip install fonttools brotli
for f in Sabon Sabon-Italic; do
  python3 -m fontTools.subset "fonts/$f.ttf" --output-file="fonts/$f.woff2" --flavor=woff2 \
    --layout-features='kern,liga,calt,onum,lnum,tnum,pnum,frac,sups,dnom,numr' \
    --unicodes='U+0020-007E,U+00A0-00FF,U+2010-2014,U+2018-201F,U+2026,U+2032-2033,U+2212,U+2605'
done
```

## Deploy

Hosted on **Vercel**, Git-connected to this repo — every push to `main` deploys automatically. No build step (static site); `vercel.json` only sets a long-lived cache header on `/fonts`. Custom domain `cube.felixguettner.com` is assigned in the Vercel project settings.
