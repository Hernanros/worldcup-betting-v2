// Image sources: Wikimedia Commons (CC/public domain) + Flickr CC where noted.
// Flickr images: CC BY-NC-SA 2.0 unless marked otherwise. Non-commercial use only.
// To find alternatives: https://commons.wikimedia.org/w/index.php?search=<term>

export const MOMENTS = {
  messi_2022: {
    key: "messi_2022",
    title: "Argentina Win the World Cup",
    subtitle: "Argentina vs France · Lusail, Qatar",
    year: 2022,
    // Messi kissing the World Cup trophy + Golden Ball at the ceremony. Public Domain. (Flickr)
    imageUrl: "https://live.staticflickr.com/65535/52572817590_2f1f06539b.jpg",
    position: "center 35%",
  },
  maradona_1986: {
    key: "maradona_1986",
    title: "Goal of the Century",
    subtitle: "Argentina vs England · Azteca, México",
    year: 1986,
    // Maradona evading Peter Shilton — the dribble that became the Goal of the Century. (Wikimedia)
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/54/Maradona_eludiendo_shilton.jpg",
    position: "center 40%",
  },
  // Available for direct use as momentKey="hand_of_god"; not auto-routed through PAIR_MAP.
  hand_of_god: {
    key: "hand_of_god",
    title: "The Hand of God",
    subtitle: "Argentina vs England · Azteca, México",
    year: 1986,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/54/Maradona_eludiendo_shilton.jpg",
    position: "center 40%",
  },
  germany_brazil_2014: {
    key: "germany_brazil_2014",
    title: "The Mineirazzo — 7–1",
    subtitle: "Germany vs Brazil · Estádio Mineirão",
    year: 2014,
    // Match action from the 7-1 semifinal. CC BY 3.0 Brazil. (Agência Brasil / Wikimedia)
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/77/Brazil_vs_Germany%2C_in_Belo_Horizonte_03.jpg",
    position: "center 30%",
  },
  baggio_1994: {
    key: "baggio_1994",
    title: "Baggio's Miss",
    subtitle: "Italy vs Brazil · Rose Bowl, Los Angeles",
    year: 1994,
    // "IL DIVIN CODINO" — digital artwork: Baggio head bowed after the miss, Italy #10. CC BY-NC-SA 2.0. (Flickr / teokon)
    imageUrl: "https://live.staticflickr.com/686/22872324066_cfbf02d1ac.jpg",
    position: "center 40%",
  },
  zidane_2006: {
    key: "zidane_2006",
    title: "Zidane's Headbutt",
    subtitle: "France vs Italy · Olympiastadion, Berlin",
    year: 2006,
    // The actual headbutt — photographed from a TV screen within 15 min of the incident. CC BY-NC-SA 2.0. (Flickr / kaptainkobold)
    imageUrl: "https://live.staticflickr.com/71/185784735_78851a3d7b.jpg",
    position: "center 40%",
  },
  iniesta_2010: {
    key: "iniesta_2010",
    title: "Spain Win the 2010 World Cup",
    subtitle: "Spain vs Netherlands · Soccer City",
    year: 2010,
    // Spain celebrating with the trophy at Soccer City, Johannesburg. CC BY-SA 3.0. (Wikimedia)
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/06/FIFA_World_Cup_2010_Spain_with_cup.jpg",
    position: "center 35%",
  },
  ronaldo_2002: {
    key: "ronaldo_2002",
    title: "Ronaldo at Brazil 2002",
    subtitle: "Brazil vs Germany · Yokohama",
    year: 2002,
    // Portrait taken the day before the 2002 WC Final — best freely available WC-context image. (Wikimedia)
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d5/Ronaldo_2002_cropped.jpg",
    position: "center top",
  },
  klose_2014: {
    key: "klose_2014",
    title: "Klose & Germany Destroy Brazil",
    subtitle: "Germany vs Brazil · Estádio Mineirão",
    year: 2014,
    // Klose + Khedira in action during the 7-1. CC BY 3.0 Brazil. (Agência Brasil / Wikimedia)
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Brazil_vs_Germany%2C_in_Belo_Horizonte_06.jpg",
    position: "center 25%",
  },
  thuram_1998: {
    key: "thuram_1998",
    title: "France Win the 1998 World Cup",
    subtitle: "France vs Brazil · Final, Saint-Denis",
    year: 1998,
    // Presidential tribune at the 1998 final — best freely available image for this moment. (Archives nationales / Wikimedia)
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8e/Tribune_pr%C3%A9sidentielle_finale_France_Br%C3%A9sil_football_12_juillet_1998.jpg",
    position: "center center",
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
