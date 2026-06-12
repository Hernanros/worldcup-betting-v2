// scripts/generate_icons.mjs
// Generates app icons via Pollinations.ai (free, no API key)
// Run: node scripts/generate_icons.mjs

import fs from "fs"
import path from "path"
import https from "https"
import http from "http"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, "../frontend/public/icons")

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

const BASE_STYLE = "minimal flat app icon, dark navy #0d0d1a background, clean design, no text, no letters, no words, centered subject, 512x512 pixel art icon"

const ICONS = [
  {
    name: "nav-home",
    prompt: `${BASE_STYLE}, world cup 2026 football stadium aerial view silhouette, soft purple violet glow, neon purple accent lines`,
  },
  {
    name: "nav-matches",
    prompt: `${BASE_STYLE}, classic black and white football soccer ball with motion blur, glowing cyan blue aura, modern sports icon`,
  },
  {
    name: "nav-predict",
    prompt: `${BASE_STYLE}, glowing crystal ball containing a miniature football pitch, mystical purple cyan gradient light beams, prediction oracle theme`,
  },
  {
    name: "nav-cuts",
    prompt: `${BASE_STYLE}, three playing cards fanned out showing spicy bet symbols, teal green glow, wild card gambling theme, bold contrast`,
  },
  {
    name: "nav-rank",
    prompt: `${BASE_STYLE}, gold trophy cup on a podium with 1st 2nd 3rd steps, golden amber glow, championship leaderboard theme`,
  },
  {
    name: "deepcuts-header",
    prompt: `${BASE_STYLE}, wide banner illustration, stadium crowd at night with dramatic green teal spotlight beams, betting odds floating text elements, electric atmosphere, 1024x256`,
  },
]

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const protocol = url.startsWith("https") ? https : http

    function attempt(url, redirects = 0) {
      if (redirects > 5) { reject(new Error("Too many redirects")); return }
      const proto = url.startsWith("https") ? https : http
      proto.get(url, res => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          attempt(res.headers.location, redirects + 1)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`))
          return
        }
        res.pipe(file)
        file.on("finish", () => { file.close(); resolve() })
        file.on("error", reject)
      }).on("error", reject)
    }

    attempt(url)
  })
}

async function generate(icon) {
  const encoded = encodeURIComponent(icon.prompt)
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&seed=42&nologo=true&enhance=true`
  const dest = path.join(OUT_DIR, `${icon.name}.png`)

  process.stdout.write(`Generating ${icon.name}… `)
  try {
    await download(url, dest)
    console.log(`✓ saved to public/icons/${icon.name}.png`)
  } catch (err) {
    console.log(`✗ failed: ${err.message}`)
  }
}

console.log(`Generating ${ICONS.length} icons via Pollinations.ai (free)…\n`)
for (const icon of ICONS) {
  await generate(icon)
  // Small delay between requests to be polite
  await new Promise(r => setTimeout(r, 1500))
}
console.log("\nDone! Icons saved to frontend/public/icons/")
