// All image URLs are Wikimedia Commons (public domain / CC).
// Before deploying: open each imageUrl in a browser tab to verify it loads.
// To find an alternative: https://commons.wikimedia.org/w/index.php?search=<term>

export const MOMENTS = {
  messi_2022: {
    key: "messi_2022",
    title: "Messi Lifts the Trophy",
    subtitle: "Argentina vs France · Lusail, Qatar",
    year: 2022,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/2022_FIFA_World_Cup_Final_-_trophy_ceremony_%28cropped%29.jpg/1280px-2022_FIFA_World_Cup_Final_-_trophy_ceremony_%28cropped%29.jpg",
  },
  maradona_1986: {
    key: "maradona_1986",
    title: "Goal of the Century",
    subtitle: "Argentina vs England · Azteca, México",
    year: 1986,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Maradona_Diego_gol_inglese_1986.jpg/1280px-Maradona_Diego_gol_inglese_1986.jpg",
  },
  hand_of_god: {
    key: "hand_of_god",
    title: "The Hand of God",
    subtitle: "Argentina vs England · Azteca, México",
    year: 1986,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Maradona_Diego_gol_inglese_1986.jpg/1280px-Maradona_Diego_gol_inglese_1986.jpg",
  },
  germany_brazil_2014: {
    key: "germany_brazil_2014",
    title: "The Mineirazzo — 7–1",
    subtitle: "Germany vs Brazil · Estádio Mineirão",
    year: 2014,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/FIFA_World_Cup_2014_-_Germany_vs_Brazil_08.jpg/1280px-FIFA_World_Cup_2014_-_Germany_vs_Brazil_08.jpg",
  },
  baggio_1994: {
    key: "baggio_1994",
    title: "Baggio's Miss",
    subtitle: "Italy vs Brazil · Rose Bowl, Los Angeles",
    year: 1994,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Roberto_Baggio_1994_FIFA_World_Cup_Final.jpg/1280px-Roberto_Baggio_1994_FIFA_World_Cup_Final.jpg",
  },
  zidane_2006: {
    key: "zidane_2006",
    title: "Zidane's Headbutt",
    subtitle: "France vs Italy · Olympiastadion, Berlin",
    year: 2006,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Zinedine_Zidane_head_butt.jpg/1280px-Zinedine_Zidane_head_butt.jpg",
  },
  iniesta_2010: {
    key: "iniesta_2010",
    title: "Iniesta's Extra-Time Winner",
    subtitle: "Spain vs Netherlands · Soccer City",
    year: 2010,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Andres_Iniesta_goal_2010_FIFA_World_Cup_Final.jpg/1280px-Andres_Iniesta_goal_2010_FIFA_World_Cup_Final.jpg",
  },
  ronaldo_2002: {
    key: "ronaldo_2002",
    title: "Ronaldo Lifts the Cup",
    subtitle: "Brazil vs Germany · Yokohama",
    year: 2002,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/2002_FIFA_World_Cup_Final.jpg/1280px-2002_FIFA_World_Cup_Final.jpg",
  },
  klose_2014: {
    key: "klose_2014",
    title: "Klose Breaks the Record",
    subtitle: "Germany's all-time top scorer · Brazil 2014",
    year: 2014,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/FIFA_World_Cup_2014_-_Germany_vs_Brazil_08.jpg/1280px-FIFA_World_Cup_2014_-_Germany_vs_Brazil_08.jpg",
  },
  thuram_1998: {
    key: "thuram_1998",
    title: "Thuram's Brace",
    subtitle: "France vs Croatia · Semi-Final, Saint-Denis",
    year: 1998,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/1998_FIFA_World_Cup_Final.jpg/1280px-1998_FIFA_World_Cup_Final.jpg",
  },
}

// Pair map — key is both team names sorted alphabetically and joined with "+"
const PAIR_MAP = {
  "Argentina+England": "maradona_1986",
  "Brazil+Germany": "germany_brazil_2014",
  "France+Italy": "zidane_2006",
  "Argentina+France": "messi_2022",
  "Germany+Brazil": "germany_brazil_2014",
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

// Ordered list of moment keys used for the rotating Sandbox hero
export const ALL_MOMENT_KEYS = [
  "messi_2022", "maradona_1986", "germany_brazil_2014",
  "baggio_1994", "zidane_2006", "iniesta_2010",
]
