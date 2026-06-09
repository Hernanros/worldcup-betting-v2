# WC 2026 App — Logo Design Brief

Use these prompts in **Ideogram**, **Gemini Imagen**, or **Midjourney** to generate the two logo assets.

---

## Deliverable 1: Square Badge Icon (512×512)

For PWA home screen icon, TopBar favicon, app store listing.

### Prompt

> Minimal flat app icon, square with rounded corners (iOS-style corner radius). Near-black background (#0c0c14). A sleek FIFA World Cup trophy silhouette centered in the frame, rendered with a soft radial glow gradient fading from electric purple (#a855f7) at the base to electric blue (#3b82f6) toward the trophy rim. Single gold (#fbbf24) accent highlights on the trophy handles. Clean vector style, no gradients in the background — solid dark. No text, no badge numbers, no drop shadows. Suitable for a mobile app home screen icon. 512×512 pixels, PNG.

### Negative prompt (if supported)

> Cartoon, 3D render, photorealistic, text, watermark, gradient background, white background, extra shapes.

---

## Deliverable 2: Horizontal Lockup (1200×400)

For JoinPage header, splash screen, promotional use.

### Prompt

> Horizontal app branding lockup. Dark near-black background (#0c0c14). Left third: the same minimal World Cup trophy icon (purple-to-blue radial glow, gold handle highlights, no text). Right two-thirds: bold condensed geometric sans-serif wordmark "WC 2026" vertically centered, filled with a left-to-right gradient from purple (#a855f7) to blue (#3b82f6), letter-height spanning 65% of the canvas height. Immediately below the wordmark in small caps, muted grey (#6b7280), tracking-wide: "PREDICT · DARE · WIN". No border, no extra decoration, no glow on the text. Clean, premium dark sports branding. 1200×400 pixels, PNG.

### Negative prompt (if supported)

> Cartoon, clipart, 3D, photorealistic, white background, rainbow, decorative borders, extra icons.

---

## Implementation Notes (after assets are generated)

1. Place icon at `frontend/public/icon-512.png`
2. Resize to 192px → `frontend/public/icon-192.png`
3. Update `frontend/public/manifest.json` icons array to reference both
4. Replace text logo in `frontend/src/components/TopBar.jsx` with an `<img>` tag
5. Replace text header in `frontend/src/pages/JoinPage.jsx` with the lockup image
