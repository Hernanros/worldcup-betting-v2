// ISO 3166-1 alpha-2 codes for flagcdn.com
// Usage: `https://flagcdn.com/w40/${TEAM_ISO[name]}.png`
export const TEAM_ISO = {
  // Group A
  Mexico:          "mx",
  Jamaica:         "jm",
  Venezuela:       "ve",
  Ecuador:         "ec",
  // Group B
  USA:             "us",
  Panama:          "pa",
  Bolivia:         "bo",
  "New Zealand":   "nz",
  // Group C
  Canada:          "ca",
  Honduras:        "hn",
  Morocco:         "ma",
  Belgium:         "be",
  // Group D
  Brazil:          "br",
  Paraguay:        "py",
  Japan:           "jp",
  Croatia:         "hr",
  // Group E
  Argentina:       "ar",
  Chile:           "cl",
  Australia:       "au",
  Poland:          "pl",
  // Group F
  Spain:           "es",
  Portugal:        "pt",
  Senegal:         "sn",
  Cameroon:        "cm",
  // Group G
  France:          "fr",
  Uruguay:         "uy",
  "South Korea":   "kr",
  Serbia:          "rs",
  // Group H
  England:         "gb-eng",
  Netherlands:     "nl",
  Algeria:         "dz",
  Tunisia:         "tn",
  // Group I
  Germany:         "de",
  Colombia:        "co",
  "Saudi Arabia":  "sa",
  Slovenia:        "si",
  // Group J
  Italy:           "it",
  "Ivory Coast":   "ci",
  "DR Congo":      "cd",
  "South Africa":  "za",
  // Group K
  Turkey:          "tr",
  Czechia:         "cz",
  Iran:            "ir",
  Nigeria:         "ng",
  // Group L
  Switzerland:     "ch",
  Ghana:           "gh",
  Egypt:           "eg",
  "El Salvador":   "sv",
  // Extra teams (knockout placeholders + tournament bets)
  Denmark:         "dk",
  Norway:          "no",
  Sweden:          "se",
  Austria:         "at",
  Scotland:        "gb-sct",
  Ukraine:         "ua",
  Wales:           "gb-wls",
  "Costa Rica":    "cr",
  Peru:            "pe",
  Qatar:           "qa",
  Kenya:           "ke",
  Zambia:          "zm",
}

export function flagUrl(teamName, size = 40) {
  const iso = TEAM_ISO[teamName]
  if (!iso) return null
  const BUCKETS = [20, 40, 80, 160, 320, 640]
  const bucket = BUCKETS.find(b => b >= size) ?? 640
  return `https://flagcdn.com/w${bucket}/${iso}.png`
}

// Custom team logos — populate here to override flags with proper crests.
// Falls back to flagUrl when no custom logo is set.
// Example: TEAM_LOGOS["Argentina"] = "https://…/arg_crest.png"
export const TEAM_LOGOS = {}

export function teamLogoUrl(teamName, size = 40) {
  if (TEAM_LOGOS[teamName]) return TEAM_LOGOS[teamName]
  return flagUrl(teamName, size)
}

// Top-25 Golden Boot contenders for the dropdown
export const GOLDEN_BOOT_PLAYERS = [
  "Kylian Mbappé",
  "Vinicius Jr",
  "Harry Kane",
  "Lautaro Martínez",
  "Lionel Messi",
  "Antoine Griezmann",
  "Jude Bellingham",
  "Bukayo Saka",
  "Jamal Musiala",
  "Florian Wirtz",
  "Phil Foden",
  "Rodrygo",
  "Darwin Núñez",
  "Julián Álvarez",
  "Richarlison",
  "Ollie Watkins",
  "Cole Palmer",
  "Ferran Torres",
  "Álvaro Morata",
  "Federico Valverde",
  "Romelu Lukaku",
  "Marcus Rashford",
  "Leroy Sané",
  "Joshua Kimmich",
  "Pedri",
]

export const WC2026_GROUPS = {
  A: ["Mexico", "Jamaica", "Venezuela", "Ecuador"],
  B: ["USA", "Panama", "Costa Rica", "New Zealand"],
  C: ["Morocco", "Belgium", "Canada", "Honduras"],
  D: ["Brazil", "Croatia", "Japan", "Paraguay"],
  E: ["Argentina", "Chile", "Australia", "Poland"],
  F: ["Spain", "Portugal", "Egypt", "Algeria"],
  G: ["France", "Nigeria", "DR Congo", "Slovenia"],
  H: ["Germany", "Netherlands", "South Korea", "Iran"],
  I: ["England", "Senegal", "Tunisia", "South Africa"],
  J: ["Colombia", "Uruguay", "El Salvador", "Bolivia"],
  K: ["Turkey", "Ukraine", "Saudi Arabia", "Ghana"],
  L: ["Ivory Coast", "Norway", "Switzerland", "Czechia"],
}

export const TEAM_GROUP = Object.fromEntries(
  Object.entries(WC2026_GROUPS).flatMap(([g, teams]) => teams.map(t => [t, g]))
)
