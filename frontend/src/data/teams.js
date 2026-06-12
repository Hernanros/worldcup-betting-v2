// ISO 3166-1 alpha-2 codes for flagcdn.com
// Usage: `https://flagcdn.com/w40/${TEAM_ISO[name]}.png`
export const TEAM_ISO = {
  // Group A
  Mexico:                "mx",
  "South Africa":        "za",
  "South Korea":         "kr",
  Czechia:               "cz",
  // Group B
  Canada:                "ca",
  Switzerland:           "ch",
  "Bosnia-Herzegovina":  "ba",
  Qatar:                 "qa",
  // Group C
  USA:                   "us",
  Turkey:                "tr",
  Paraguay:              "py",
  Australia:             "au",
  // Group D
  Brazil:                "br",
  Morocco:               "ma",
  Haiti:                 "ht",
  Scotland:              "gb-sct",
  // Group E
  Germany:               "de",
  "Curaçao":             "cw",
  "Ivory Coast":         "ci",
  Ecuador:               "ec",
  // Group F
  Netherlands:           "nl",
  Japan:                 "jp",
  Sweden:                "se",
  Tunisia:               "tn",
  // Group G
  Spain:                 "es",
  "Cape Verde":          "cv",
  "Saudi Arabia":        "sa",
  Uruguay:               "uy",
  // Group H
  Belgium:               "be",
  Egypt:                 "eg",
  Iran:                  "ir",
  "New Zealand":         "nz",
  // Group I
  France:                "fr",
  Senegal:               "sn",
  Iraq:                  "iq",
  Norway:                "no",
  // Group J
  Argentina:             "ar",
  Algeria:               "dz",
  Austria:               "at",
  Jordan:                "jo",
  // Group K
  Portugal:              "pt",
  "DR Congo":            "cd",
  Uzbekistan:            "uz",
  Colombia:              "co",
  // Group L
  England:               "gb-eng",
  Croatia:               "hr",
  Ghana:                 "gh",
  Panama:                "pa",
  // Extra / knockout placeholders
  Denmark:               "dk",
  Serbia:                "rs",
  Poland:                "pl",
  Nigeria:               "ng",
  "El Salvador":         "sv",
  Slovenia:              "si",
  Ukraine:               "ua",
  Wales:                 "gb-wls",
  Italy:                 "it",
  Chile:                 "cl",
  Venezuela:             "ve",
  Jamaica:               "jm",
  Honduras:              "hn",
  Bolivia:               "bo",
  Cameroon:              "cm",
  Peru:                  "pe",
  Kenya:                 "ke",
  Zambia:                "zm",
  "Costa Rica":          "cr",
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
  A: ["Mexico", "South Africa", "South Korea", "Czechia"],
  B: ["Canada", "Switzerland", "Bosnia-Herzegovina", "Qatar"],
  C: ["USA", "Turkey", "Paraguay", "Australia"],
  D: ["Brazil", "Morocco", "Haiti", "Scotland"],
  E: ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  H: ["Belgium", "Egypt", "Iran", "New Zealand"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
}

export const TEAM_GROUP = Object.fromEntries(
  Object.entries(WC2026_GROUPS).flatMap(([g, teams]) => teams.map(t => [t, g]))
)
