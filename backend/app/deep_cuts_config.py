"""
Deep Cuts market configuration.
All 22 markets across 7 stages. Adding a new market = add one dict entry here.
"""
from datetime import datetime, timezone
from typing import Optional

# ── Stage → DB round value mapping ──────────────────────────────────────────
STAGE_ROUNDS = {
    "tournament":  None,        # all rounds (for Most Exhausted Player)
    "group_stage": "group",
    "r32":         "r32",
    "r16":         "r16",
    "qf":          "qf",
    "sf":          "sf",
    "final":       "final",
}

# ⚠️ Estimated group compositions — verify against official FIFA draw before Jun 11, 2026
# ── WC 2026 group compositions (A–L, 48 group stage teams) ─────────────────
WC2026_GROUPS = {
    "A": ["Mexico", "South Africa", "South Korea", "Czechia"],
    "B": ["Canada", "Switzerland", "Bosnia-Herzegovina", "Qatar"],
    "C": ["USA", "Turkey", "Paraguay", "Australia"],
    "D": ["Brazil", "Morocco", "Haiti", "Scotland"],
    "E": ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
    "F": ["Netherlands", "Japan", "Sweden", "Tunisia"],
    "G": ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
    "H": ["Belgium", "Egypt", "Iran", "New Zealand"],
    "I": ["France", "Senegal", "Iraq", "Norway"],
    "J": ["Argentina", "Algeria", "Austria", "Jordan"],
    "K": ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
    "L": ["England", "Croatia", "Ghana", "Panama"],
}

ALL_GROUP_TEAMS = [t for teams in WC2026_GROUPS.values() for t in teams]

# ── Known players for Most Exhausted Player market ───────────────────────────
# Wide list covering all positions (GKs, defenders, midfielders, forwards)
# across all 48 WC 2026 nations — because minutes are won by workhorses,
# not just strikers. Unknown names typed manually still accepted at server.
EXHAUSTED_PLAYER_LIST = sorted([
    # ── ARGENTINA ────────────────────────────────────────────────────────────
    "Lionel Messi", "Julián Álvarez", "Lautaro Martínez", "Ángel Di María",
    "Rodrigo De Paul", "Enzo Fernández", "Mac Allister", "Cristian Romero",
    "Lisandro Martínez", "Nahuel Molina", "Nicolás Tagliafico", "Emiliano Martínez",

    # ── BRAZIL ───────────────────────────────────────────────────────────────
    "Vinicius Jr", "Neymar Jr", "Richarlison", "Rodrygo", "Endrick",
    "Casemiro", "Bruno Guimarães", "Lucas Paquetá", "Gerson",
    "Marquinhos", "Éder Militão", "Alisson", "Ederson",

    # ── FRANCE ───────────────────────────────────────────────────────────────
    "Kylian Mbappé", "Antoine Griezmann", "Oliver Giroud", "Marcus Thuram",
    "Ousmane Dembélé", "Kingsley Coman", "Christopher Nkunku",
    "Aurélien Tchouaméni", "Eduardo Camavinga", "Adrien Rabiot",
    "William Saliba", "Dayot Upamecano", "Théo Hernández", "Benjamin Pavard",
    "Mike Maignan",

    # ── SPAIN ────────────────────────────────────────────────────────────────
    "Pedri", "Gavi", "Rodri", "Dani Olmo", "Lamine Yamal",
    "Álvaro Morata", "Ferran Torres", "Nico Williams",
    "Dani Carvajal", "Aymeric Laporte", "Robin Le Normand", "Alejandro Balde",
    "Unai Simón",

    # ── PORTUGAL ─────────────────────────────────────────────────────────────
    "Cristiano Ronaldo", "Bruno Fernandes", "Bernardo Silva",
    "Rafael Leão", "João Félix", "Diogo Jota", "Gonçalo Ramos",
    "Rúben Dias", "João Cancelo", "Nuno Mendes", "Vitinha",
    "Diogo Costa", "Rui Patrício",

    # ── ENGLAND ──────────────────────────────────────────────────────────────
    "Harry Kane", "Bukayo Saka", "Jude Bellingham", "Phil Foden",
    "Marcus Rashford", "Raheem Sterling", "Jack Grealish",
    "Declan Rice", "Trent Alexander-Arnold", "Kyle Walker",
    "John Stones", "Harry Maguire", "Jordan Pickford",

    # ── GERMANY ──────────────────────────────────────────────────────────────
    "Karim Adeyemi", "Leroy Sané", "Serge Gnabry",
    "Florian Wirtz", "Kai Havertz", "Thomas Müller",
    "Joshua Kimmich", "Leon Goretzka", "Ilkay Gündoğan",
    "Antonio Rüdiger", "Nico Schlotterbeck", "Marc-André ter Stegen",

    # ── NETHERLANDS ──────────────────────────────────────────────────────────
    "Cody Gakpo", "Memphis Depay", "Wout Weghorst",
    "Frenkie de Jong", "Teun Koopmeiners", "Tijjani Reijnders",
    "Virgil van Dijk", "Nathan Aké", "Denzel Dumfries", "Daley Blind",

    # ── CROATIA ──────────────────────────────────────────────────────────────
    "Luka Modrić", "Mateo Kovačić", "Marcelo Brozović",
    "Ivan Perišić", "Andrej Kramarić", "Bruno Petković",
    "Joško Gvardiol", "Dejan Lovren", "Dominik Livaković",

    # ── BELGIUM ──────────────────────────────────────────────────────────────
    "Kevin De Bruyne", "Romelu Lukaku", "Dries Mertens",
    "Yannick Carrasco", "Youri Tielemans", "Axel Witsel",
    "Toby Alderweireld", "Jan Vertonghen", "Thibaut Courtois",

    # ── NORWAY ───────────────────────────────────────────────────────────────
    "Erling Haaland", "Martin Ødegaard", "Alexander Sørloth",
    "Josh King", "Sander Berge",

    # ── MOROCCO ──────────────────────────────────────────────────────────────
    "Achraf Hakimi", "Hakim Ziyech", "Youssef En-Nesyri",
    "Noussair Mazraoui", "Sofyan Amrabat", "Romain Saïss", "Nayef Aguerd",

    # ── SENEGAL ──────────────────────────────────────────────────────────────
    "Sadio Mané", "Idrissa Gueye", "Cheikhou Kouyaté",
    "Ismaïla Sarr", "Formose Mendy", "Edouard Mendy",

    # ── EGYPT ────────────────────────────────────────────────────────────────
    "Mohamed Salah", "Mohamed Elneny", "Mostafa Mohamed", "Trezeguet",

    # ── ALGERIA ──────────────────────────────────────────────────────────────
    "Riyad Mahrez", "Ismaël Bennacer", "Yacine Brahimi", "Islam Slimani",
    "Andy Delort", "Houssem Aouar",

    # ── IVORY COAST ──────────────────────────────────────────────────────────
    "Sébastien Haller", "Franck Kessié", "Nicolas Pépé",
    "Jean-Philippe Gbamin", "Serge Aurier", "Wilfried Zaha",

    # ── GHANA ────────────────────────────────────────────────────────────────
    "Thomas Partey", "Mohammed Kudus", "André Ayew", "Jordan Ayew",
    "Antoine Semenyo",

    # ── TURKEY ───────────────────────────────────────────────────────────────
    "Hakan Çalhanoğlu", "Arda Güler", "Kerem Aktürkoğlu",
    "Kenan Yıldız", "Baris Alper Yilmaz", "Zeki Çelik",

    # ── SOUTH KOREA ──────────────────────────────────────────────────────────
    "Son Heung-min", "Lee Kang-in", "Hwang Hee-chan",
    "Hwang In-beom", "Kim Min-jae", "Cho Gue-sung",

    # ── JAPAN ────────────────────────────────────────────────────────────────
    "Takumi Minamino", "Daichi Kamada", "Ritsu Doan", "Kaoru Mitoma",
    "Wataru Endo", "Hidemasa Morita", "Maya Yoshida",

    # ── USA ──────────────────────────────────────────────────────────────────
    "Christian Pulisic", "Weston McKennie", "Tyler Adams",
    "Giovanni Reyna", "Yunus Musah", "Folarin Balogun", "Timothy Weah",
    "Sergiño Dest", "Miles Robinson",

    # ── MEXICO ───────────────────────────────────────────────────────────────
    "Raúl Jiménez", "Hirving Lozano", "Alexis Vega",
    "Edson Álvarez", "Carlos Rodríguez", "Héctor Moreno",

    # ── COLOMBIA ─────────────────────────────────────────────────────────────
    "James Rodríguez", "Luis Díaz", "Rafael Santos Borré",
    "Juan Cuadrado", "Wilmar Barrios", "Davinson Sánchez",

    # ── URUGUAY ──────────────────────────────────────────────────────────────
    "Darwin Núñez", "Federico Valverde", "Rodrigo Bentancur",
    "Luis Suárez", "Edinson Cavani", "Giorgian De Arrascaeta",

    # ── ECUADOR ──────────────────────────────────────────────────────────────
    "Moisés Caicedo", "Enner Valencia", "Jeremy Sarmiento",
    "Ángel Mena", "Piero Hincapié",

    # ── SWITZERLAND ──────────────────────────────────────────────────────────
    "Granit Xhaka", "Xherdan Shaqiri", "Breel Embolo",
    "Remo Freuler", "Yann Sommer", "Manuel Akanji",

    # ── AUSTRALIA ────────────────────────────────────────────────────────────
    "Mathew Leckie", "Ajdin Hrustic", "Aaron Mooy",
    "Mitchell Duke", "Aziz Behich", "Mat Ryan",

    # ── PARAGUAY ─────────────────────────────────────────────────────────────
    "Miguel Almirón", "Antonio Sanabria", "Ángel Romero",
    "Gustavo Gómez",

    # ── SAUDI ARABIA ─────────────────────────────────────────────────────────
    "Salem Al-Dawsari", "Mohammed Kanno", "Firas Al-Buraikan",
    "Yasser Al-Shahrani",

    # ── IRAN ─────────────────────────────────────────────────────────────────
    "Sardar Azmoun", "Mehdi Taremi", "Ali Gholizadeh",
    "Alireza Jahanbakhsh",

    # ── SERBIA (not in WC but commonly picked) — skip ────────────────────────
    # ── CANADA ───────────────────────────────────────────────────────────────
    "Alphonso Davies", "Jonathan David", "Tajon Buchanan",
    "Cyle Larin", "Junior Hoilett", "Atiba Hutchinson",

    "Serhou Guirassy",

    # ── SOUTH AFRICA ─────────────────────────────────────────────────────────
    "Percy Tau", "Bongani Zungu", "Themba Zwane", "Lebo Mothiba",
    "Ronwen Williams", "Siyanda Xulu", "Innocent Maela",

    # ── CZECHIA ──────────────────────────────────────────────────────────────
    "Patrik Schick", "Vladimír Coufal", "Tomáš Souček",
    "Jakub Jankto", "Antonín Barák", "Jiří Pavlenka",

    # ── BOSNIA-HERZEGOVINA ───────────────────────────────────────────────────
    "Edin Džeko", "Sead Kolašinac", "Miralem Pjanić",
    "Ermedin Demirović", "Rade Krunić",

    # ── QATAR ────────────────────────────────────────────────────────────────
    "Almoez Ali", "Akram Afif", "Hassan Al-Haydos",
    "Salmin Al-Enezi", "Meshaal Barsham",

    # ── HAITI ────────────────────────────────────────────────────────────────
    "Duckens Nazon", "Frantzdy Pierrot", "Orlens Dalcé",
    "Steeven Saba", "Jonathan Pétion",

    # ── SCOTLAND ─────────────────────────────────────────────────────────────
    "John McGinn", "Scott McTominay", "Che Adams",
    "Kieran Tierney", "Andrew Robertson", "Craig Gordon",

    # ── CURAÇAO ──────────────────────────────────────────────────────────────
    "Cuco Martina", "Leandro Bacuna", "Juriën Timber",
    "Queensy Menig",

    # ── SWEDEN ───────────────────────────────────────────────────────────────
    "Alexander Isak", "Emil Forsberg", "Dejan Kulusevski",
    "Zlatan Ibrahimović", "Victor Lindelöf", "Robin Olsen",

    # ── TUNISIA ──────────────────────────────────────────────────────────────
    "Youssef Msakni", "Wahbi Khazri", "Naim Sliti",
    "Ellyes Skhiri", "Dylan Bronn",

    # ── CAPE VERDE ───────────────────────────────────────────────────────────
    "Garry Rodrigues", "Ryan Mendes", "Nuno Tavares",
    "Steven Fortes",

    # ── NEW ZEALAND ──────────────────────────────────────────────────────────
    "Chris Wood", "Liberato Cacace", "Clayton Lewis",
    "Tommy Smith",

    # ── IRAQ ─────────────────────────────────────────────────────────────────
    "Mohanad Ali", "Ali Adnan", "Amjed Attwan",
    "Bashar Resan",

    # ── AUSTRIA ──────────────────────────────────────────────────────────────
    "David Alaba", "Marcel Sabitzer", "Marko Arnautovic",
    "Konrad Laimer", "Michael Gregoritsch", "Patrick Pentz",

    # ── JORDAN ───────────────────────────────────────────────────────────────
    "Baha'a Faisal", "Musa Al-Taamari", "Yazan Al-Naimat",
    "Ahmad Harman",

    # ── DR CONGO ─────────────────────────────────────────────────────────────
    "Cédric Bakambu", "Chancel Mbemba", "Yannick Bolasie",
    "Théo Bongonda", "Joris Kayembe",

    # ── UZBEKISTAN ───────────────────────────────────────────────────────────
    "Eldor Shomurodov", "Jaloliddin Masharipov", "Abbosbek Fayzullayev",
    "Jamshid Iskanderov", "Dostonbek Tursunov",

    # ── PANAMA ───────────────────────────────────────────────────────────────
    "Rolando Blackburn", "José Fajardo", "Adalberto Carrasquilla",
    "Cecilio Waterman", "Roderick Miller",

])


def get_stage_lock_time(stage: str, db) -> Optional[datetime]:
    """
    Returns the lock time for a stage.
    Group stage: hardcoded to first WC kickoff.
    All other stages: MIN(kickoff_time) for matches in that round.
    db may be None for group_stage (hardcoded).
    """
    if stage == "group_stage":
        return datetime(2026, 6, 15, 23, 59, 0, tzinfo=timezone.utc)
    # For all other stages, caller must provide db and query MIN kickoff.
    # See deep_cuts_settlement.get_stage_lock_time_from_db()
    return None

# ── Market definitions ───────────────────────────────────────────────────────
# Fields:
#   stage:   which stage this market belongs to (key in STAGE_ROUNDS)
#   label:   display label (emoji + name)
#   type:    "team_pick" | "over_under" | "exact_count" | "yes_no" |
#            "group_advance" | "text_pick"
#   settle:  settlement strategy key (used by deep_cuts_settlement.py)
#   pool:    (team_pick only) "all_group_teams" | "r32_teams" | "r16_teams" | "qf_teams" | "sf_teams"
#   lines:   (over_under only) list of {name, odds}
#   options: (exact_count only) list of int
#   default_odds: (team_pick / text_pick) fallback odds
#   field:   (sum_field settle) e.g. "home_corners+away_corners"
#   group:   (group_advance only) group letter A–L

DEEP_CUTS_MARKETS: dict[str, dict] = {

    # ── TOURNAMENT (lock Jun 11, settle after Final) ─────────────────────────
    "most_exhausted": {
        "stage":        "tournament",
        "label":        "😴 Most Exhausted Player",
        "description":  "Player with the most total minutes played across the entire tournament.",
        "type":         "text_pick",
        "settle":       "most_exhausted",
        "default_odds": 50.0,
        "players":      EXHAUSTED_PLAYER_LIST,
    },

    # ── GROUP STAGE ──────────────────────────────────────────────────────────
    **{
        f"group_advance_{g}": {
            "stage":       "group_stage",
            "label":       f"📋 Group {g} Advancement",
            "description": f"Pick 2 teams from Group {g} that advance to the Round of 32.",
            "type":        "group_advance",
            "settle":      "group_advance",
            "group":       g,
            "teams":       WC2026_GROUPS[g],
            "default_odds": 4.0,
        }
        for g in "ABCDEFGHIJKL"
    },
    "best_group_team": {
        "stage":        "group_stage",
        "label":        "🏅 Best Group Stage Team",
        "description":  "Pick the team with the best group stage record (points → GD → GS → −RC → −YC).",
        "type":         "team_pick",
        "settle":       "best_group_team",
        "pool":         "all_group_teams",
        "default_odds": 48.0,
    },
    "total_corners": {
        "stage":       "group_stage",
        "label":       "🔺 Total Corners (Group Stage)",
        "description": "Total corner kicks across all 48 group stage matches.",
        "type":        "over_under",
        "settle":      "sum_field",
        "field":       "home_corners+away_corners",
        "lines": [
            {"name": "Over 474.5",  "odds": 1.90},
            {"name": "Under 474.5", "odds": 1.90},
        ],
    },
    "total_offsides": {
        "stage":       "group_stage",
        "label":       "🎯 Total Offsides (Group Stage)",
        "description": "Total offside calls across all 48 group stage matches.",
        "type":        "over_under",
        "settle":      "sum_field",
        "field":       "home_offsides+away_offsides",
        "lines": [
            {"name": "Over 139.5",  "odds": 1.90},
            {"name": "Under 139.5", "odds": 1.90},
        ],
    },
    "own_goals": {
        "stage":       "group_stage",
        "label":       "🤦 Own Goals (Group Stage)",
        "description": "Total own goals across all 48 group stage matches.",
        "type":        "over_under",
        "settle":      "sum_field",
        "field":       "home_own_goals+away_own_goals",
        "lines": [
            {"name": "Over 2.5",  "odds": 1.85},
            {"name": "Under 2.5", "odds": 1.95},
        ],
    },

    # ── ROUND OF 32 ──────────────────────────────────────────────────────────
    "r32_top_scorer": {
        "stage":        "r32",
        "label":        "⚽ Top Scorer Team (R32)",
        "description":  "Pick the team that scores the most goals across all Round of 32 matches.",
        "type":         "team_pick",
        "settle":       "top_goals_team",
        "pool":         "r32_teams",
        "default_odds": 32.0,
    },
    "r32_most_violent": {
        "stage":        "r32",
        "label":        "🟥 Most Violent Team (R32)",
        "description":  "Pick the team with the most red cards in the Round of 32.",
        "type":         "team_pick",
        "settle":       "top_red_cards_team",
        "pool":         "r32_teams",
        "default_odds": 32.0,
    },
    "r32_extra_time": {
        "stage":   "r32",
        "label":   "⏱️ Extra Time Matches (R32)",
        "description": "How many Round of 32 matches go to extra time?",
        "type":    "exact_count",
        "settle":  "count_went_to_et",
        "options": [0, 1, 2, 3, 4, 5],
        # Calibrated to ~108% overround (Binomial n=16, p=0.25 ET rate).
        # Old odds [8,3.5,2.5,3,5,10] had 144% overround — corrected.
        "odds":    [75.0, 15.0, 5.5, 3.5, 3.3, 4.3],
    },
    "r32_yellow_cards": {
        "stage":       "r32",
        "label":       "🟡 Yellow Card Fest (R32)",
        "description": "Total yellow cards across all 16 Round of 32 matches.",
        "type":        "over_under",
        "settle":      "sum_field",
        "field":       "home_yellow_cards+away_yellow_cards",
        "lines": [
            {"name": "Over 49.5",  "odds": 1.90},
            {"name": "Under 49.5", "odds": 1.90},
        ],
    },
    "r32_clean_sheet": {
        "stage":        "r32",
        "label":        "💀 Clean Sheet Race (R32)",
        "description":  "Pick the team that concedes the fewest goals in the Round of 32 (min 1 match played).",
        "type":         "team_pick",
        "settle":       "min_conceded_team",
        "pool":         "r32_teams",
        "default_odds": 32.0,
    },

    # ── ROUND OF 16 ──────────────────────────────────────────────────────────
    "r16_pen_shootouts": {
        "stage":       "r16",
        "label":       "🥅 Penalty Shootouts (R16)",
        "description": "How many Round of 16 matches are decided by a penalty shootout?",
        "type":        "exact_count",
        "settle":      "count_went_to_pens",
        "options":     [0, 1, 2, 3, 4],
        # Calibrated to ~107% overround (Binomial n=8, p=0.25 pen rate).
        # Old odds [3,2.5,3,5,10] had 137% overround — corrected.
        "odds":        [9.0, 3.4, 2.9, 4.4, 10.5],
    },
    "r16_total_goals": {
        "stage":       "r16",
        "label":       "🌙 Total R16 Goals",
        "description": "Total goals scored across all 8 Round of 16 matches.",
        "type":        "over_under",
        "settle":      "sum_field",
        "field":       "home_score+away_score",
        "lines": [
            {"name": "Over 19.5",  "odds": 1.90},
            {"name": "Under 19.5", "odds": 1.90},
        ],
    },
    "r16_most_leaky": {
        "stage":        "r16",
        "label":        "🛡️ Most Leaky Defense (R16)",
        "description":  "Pick the team that concedes the most goals in the Round of 16.",
        "type":         "team_pick",
        "settle":       "max_conceded_team",
        "pool":         "r16_teams",
        "default_odds": 16.0,
    },
    "r16_corner_machine": {
        "stage":        "r16",
        "label":        "🔺 Corner Machine (R16)",
        "description":  "Pick the team that wins the most corner kicks across their R16 match(es).",
        "type":         "team_pick",
        "settle":       "top_corners_team",
        "pool":         "r16_teams",
        "default_odds": 16.0,
    },
    "r16_high_scoring": {
        "stage":       "r16",
        "label":       "💥 High-Scoring Games (R16)",
        "description": "How many Round of 16 matches have 3 or more total goals?",
        "type":        "over_under",
        "settle":      "count_high_scoring",
        "threshold":   3,
        "lines": [
            {"name": "Over 2.5",  "odds": 1.90},
            {"name": "Under 2.5", "odds": 1.90},
        ],
    },

    # ── QUARTER-FINALS ───────────────────────────────────────────────────────
    "qf_pen_shootouts": {
        "stage":       "qf",
        "label":       "🥅 QF Penalty Shootouts",
        "description": "How many Quarter-Final matches are decided by a penalty shootout?",
        "type":        "exact_count",
        "settle":      "count_went_to_pens",
        "options":     [0, 1, 2],
        "odds":        [2.5, 2.5, 4.0],
    },
    "qf_sub_goals": {
        "stage":       "qf",
        "label":       "🎭 Goals by Substitutes (QF)",
        "description": "Total goals scored by substitute players across all 4 Quarter-Final matches.",
        "type":        "over_under",
        "settle":      "sum_field",
        "field":       "sub_goals",
        "lines": [
            {"name": "Over 2.5",  "odds": 1.90},
            {"name": "Under 2.5", "odds": 1.90},
        ],
    },
    "qf_total_goals": {
        "stage":       "qf",
        "label":       "🌟 Total QF Goals",
        "description": "Total goals scored across all 4 Quarter-Final matches.",
        "type":        "over_under",
        "settle":      "sum_field",
        "field":       "home_score+away_score",
        "lines": [
            {"name": "Over 8.5",  "odds": 1.90},
            {"name": "Under 8.5", "odds": 1.90},
        ],
    },

    # ── SEMI-FINALS ──────────────────────────────────────────────────────────
    "sf_any_et": {
        "stage":       "sf",
        "label":       "⏱️ Any SF to Extra Time",
        "description": "Will either Semi-Final go to extra time?",
        "type":        "yes_no",
        "settle":      "any_went_to_et",
        "odds":        {"yes": 2.20, "no": 1.65},
    },
    "sf_red_card_drama": {
        "stage":       "sf",
        "label":       "🟥 SF Red Card Drama",
        "description": "Total red cards across both Semi-Final matches.",
        "type":        "exact_count",
        "settle":      "count_field",
        "field":       "home_red_cards+away_red_cards",
        "options":     [0, 1, 2],
        "odds":        [2.0, 2.5, 5.0],
    },

    # ── FINAL ────────────────────────────────────────────────────────────────
    "final_to_pens": {
        "stage":  "final",
        "label":  "🥅 Final Goes to Penalties",
        "description": "Will the Final be decided by a penalty shootout?",
        "type":   "yes_no",
        "settle": "any_went_to_pens",
        "odds":   {"yes": 3.50, "no": 1.30},
    },
    "final_total_goals": {
        "stage":       "final",
        "label":       "🔥 Total Final Goals",
        "description": "Total goals scored in the Final (90 min + ET, not counting penalty shootout).",
        "type":        "over_under",
        "settle":      "sum_field",
        "field":       "home_score+away_score",
        "lines": [
            {"name": "Over 1.5",  "odds": 1.65},
            {"name": "Under 1.5", "odds": 2.20},
        ],
    },
}

# ── Convenience: markets grouped by stage ───────────────────────────────────
def markets_for_stage(stage: str) -> dict[str, dict]:
    return {k: v for k, v in DEEP_CUTS_MARKETS.items() if v["stage"] == stage}
