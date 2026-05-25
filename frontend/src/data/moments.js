// All image URLs are Wikimedia Commons (public domain / CC).
// URLs verified 2026-05-25 — use direct original-file links (not /thumb/) for reliability.
// To find alternatives: https://commons.wikimedia.org/w/index.php?search=<term>

export const MOMENTS = {
  messi_2022: {
    key: "messi_2022",
    title: "Argentina Win the World Cup",
    subtitle: "Argentina vs France · Lusail, Qatar",
    year: 2022,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2e/Argentina_3-3_Francia_-_Copa_Mundial_2022_-_Celebraci%C3%B3n_de_victoria.jpg",
  },
  maradona_1986: {
    key: "maradona_1986",
    title: "Goal of the Century",
    subtitle: "Argentina vs England · Azteca, México",
    year: 1986,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1d/Maradona_celebrating_after_goal_of_century.jpg",
  },
  // Available for direct use as momentKey="hand_of_god"; not auto-routed through PAIR_MAP.
  hand_of_god: {
    key: "hand_of_god",
    title: "The Hand of God",
    subtitle: "Argentina vs England · Azteca, México",
    year: 1986,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1d/Maradona_celebrating_after_goal_of_century.jpg",
  },
  germany_brazil_2014: {
    key: "germany_brazil_2014",
    title: "The Mineirazzo — 7–1",
    subtitle: "Germany vs Brazil · Estádio Mineirão",
    year: 2014,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/56/Brazil_vs_Germany%2C_in_Belo_Horizonte_12.jpg",
  },
  baggio_1994: {
    key: "baggio_1994",
    title: "Baggio's Miss",
    subtitle: "Italy vs Brazil · Rose Bowl, Los Angeles",
    year: 1994,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/72/Roberto_Baggio_cropped.jpg",
  },
  zidane_2006: {
    key: "zidane_2006",
    title: "Zidane's Headbutt",
    subtitle: "France vs Italy · Olympiastadion, Berlin",
    year: 2006,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/92/Zinedine_zidane_wcf_2006.jpg",
  },
  iniesta_2010: {
    key: "iniesta_2010",
    title: "Spain Win the 2010 World Cup",
    subtitle: "Spain vs Netherlands · Soccer City",
    year: 2010,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0f/Spain-Holland_-_World_Champion_the_fine_art_of_diagonal_kissing.jpg",
  },
  ronaldo_2002: {
    key: "ronaldo_2002",
    title: "Ronaldo at Brazil 2002",
    subtitle: "Brazil vs Germany · Yokohama",
    year: 2002,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d5/Ronaldo_2002_cropped.jpg",
  },
  klose_2014: {
    key: "klose_2014",
    title: "Götze Wins the World Cup",
    subtitle: "Germany vs Argentina · Final, Rio de Janeiro",
    year: 2014,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/56/Mario_G%C3%B6tze_GOL_-_The_2014_FIFA_World_Cup_Final_-_140713-9112-jikatu_%2814463413827%29.jpg",
  },
  thuram_1998: {
    key: "thuram_1998",
    title: "France Win the 1998 World Cup",
    subtitle: "France vs Brazil · Final, Saint-Denis",
    year: 1998,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8e/Tribune_pr%C3%A9sidentielle_finale_France_Br%C3%A9sil_football_12_juillet_1998.jpg",
  },
}

// Pair map — key is both team names sorted alphabetically and joined with "+"
const PAIR_MAP = {
  "Argentina+England": "maradona_1986",
  "Brazil+Germany": "germany_brazil_2014",
  "France+Italy": "zidane_2006",
  "Argentina+France": "messi_2022",
}

// Single-team fallback map
const TEAM_MAP = {
  Brazil: "ronaldo_2002",
  Germany: "klose_2014",
  France: "thuram_1998",
  Argentina: "maradona_1986",
  Italy: "baggio_1994",
  Spain: "iniesta_2010",
}

/**
 * Returns the best MOMENT entry for a given matchup.
 * Priority: exact pair → home team fallback → away team fallback → maradona (default)
 */
export function getMomentForMatch(homeTeam, awayTeam) {
  const pair = [homeTeam, awayTeam].sort().join("+")
  if (PAIR_MAP[pair]) return MOMENTS[PAIR_MAP[pair]]
  if (TEAM_MAP[homeTeam]) return MOMENTS[TEAM_MAP[homeTeam]]
  if (TEAM_MAP[awayTeam]) return MOMENTS[TEAM_MAP[awayTeam]]
  return MOMENTS.maradona_1986
}

// Ordered list of moment keys used for the rotating Sandbox hero (curated subset)
export const ALL_MOMENT_KEYS = [
  "messi_2022", "maradona_1986", "germany_brazil_2014",
  "baggio_1994", "zidane_2006", "iniesta_2010",
]
