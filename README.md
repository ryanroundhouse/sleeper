# Sleeper Fantasy Football League Viewer

A comprehensive tool to fetch, store, and display Sleeper fantasy football league data with a beautiful web interface.

## 🏈 Features

- **Complete League Data Fetching**: Rosters, users, matchups, draft information, and NFL player database
- **Interactive Web Interface**: Modern, responsive design with week-by-week player points analysis
- **Week Selection Dropdown**: Choose any week to view detailed player performance
- **Player Points Display**: See every player's points for the selected week with starter indicators
- **Dual Interface Navigation**: Switch between detailed player points and team roster views
- **Static HTML Files**: Pure static files that work with any web server
- **Simple Server Script**: Included shell script for easy local serving
- **Live Scores**: Pages read straight from the Sleeper API and keep polling during games
- **Snapshot Fallback**: The last committed snapshot is shown when Sleeper cannot be reached
- **Real Player Names**: Displays actual player names, positions, and teams
- **Multi-week Data**: Fetches all weeks from 1 through current week

## ⚡ Live View

The pages read live data straight from the Sleeper API when opened, using the
shared `sleeper-live.js` loader. Matchups, rosters, users and the NFL state are
fetched on load, and the page keeps polling: every minute while scores are
changing, every five minutes once two polls in a row see no change. Points For
is the sum of starter points across the season's matchups, so it is live during
games and never waits for Sleeper's Tuesday finalization.

The header shows where the numbers came from:

- 🟢 **Live · updated …** - straight from Sleeper
- ⚠️ **Live unavailable · showing snapshot from …** - Sleeper could not be reached, so the last committed snapshot is shown
- 📦 **Final snapshot from …** - an archived season, which never goes live

See `docs/adr/0001-live-view-from-sleeper-api.md` for why.

## 📋 What the Snapshot Contains

`sleeper_league_data.py` still writes a snapshot each time it runs. Live view
falls back to it, it carries the trimmed player-name subset the pages need, and
it is what gets frozen when a season is archived.

- **web_interface_data.json** - every scored week's matchups, team names, and a player subset (everyone rostered, in a matchup, or unrostered with stats)
- **league_XXXX_info / rosters / users .json** - league configuration and current rosters
- **league_XXXX_unrostered_season_stats.json** - season totals for unrostered players, used for the best unowned team
- **league_XXXX_draft_*.json, nfl_state.json** - draft results and current NFL week

The full NFL player database (19 MB) is fetched into memory each run but never
written to disk or committed. A page that meets a player id missing from the
subset fetches Sleeper's copy lazily and caches it in the browser for a day.

## 📦 Archived Seasons

Completed seasons live in a subdirectory named for the year (e.g. `2025/`) with their own
copies of the four HTML pages and final data files. The main pages link to them via the
"2025 Season" nav button; archived pages show a banner and a "Current Season" link back.

To archive a finished season (Sleeper gives each season a new league ID):

```bash
python sleeper_league_data.py <OLD_LEAGUE_ID> 2025   # final snapshot into 2025/
python make_archive_pages.py 2025                     # archive copies of the four pages
```

Then point `SLEEPER_LEAGUE_ID` in `.env`, `update_league_data.sh`, and `setup_cron.sh` at
the new season's league ID, and add a "2025 Season" nav button to the four root pages.
Archived pages load `../sleeper-live.js` with live view switched off.

## 🚀 Quick Start

### Prerequisites

- Python 3.7+
- Internet connection for initial data fetch

### Installation

1. **Clone or download the files:**
   ```bash
   git clone <repository> # or download the files
   cd sleeper
   ```

2. **Set up Python environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install requests
   ```

### Basic Usage

#### Step 1: Fetch League Data

**Option 1: Using Command Line (Quick Start)**

1. **Run the script with your league ID:**
   ```bash
   python sleeper_league_data.py YOUR_LEAGUE_ID
   ```
   
   Example:
   ```bash
   python sleeper_league_data.py 1389378463139373056
   ```

**Option 2: Using .env File (Recommended for Automation)**

1. **Create a .env file** in your sleeper directory:
   ```env
   # Copy this content to a file named ".env"
   SLEEPER_LEAGUE_ID=1389378463139373056
   ```

2. **Run the script** (no arguments needed):
   ```bash
   python sleeper_league_data.py
   ```

**This will:**
- Fetch all league data from Sleeper API
- Save data to JSON files
- Create `web_interface_data.json` for the web interface
- Display league summary in the terminal

#### Step 2: View the Web Interface

After fetching the data, you can view it using the included web interface:

**Option 1: Using the Included Server Script (Recommended)**

```bash
./start_server.sh
```

Or with a custom port:
```bash
./start_server.sh 8080
```

**Option 2: Using Python's Built-in Server**

```bash
python3 -m http.server 8080
```

**Option 3: Using Any Web Server**

Since the files are now static HTML, you can serve them with any web server (Apache, Nginx, etc.) or even open them directly in a browser via file:// (though HTTP serving is recommended to avoid CORS issues).

#### Web Interface Features

The site has four pages, all live:

- **Season Results** (`index.html`): standings by Points For with full rosters and the best unowned team
- **Weekly Results** (`weekly.html`): each week's matchups with a week selector
- **Stats** (`stats.html`): team scoring charts over the season
- **Hall of Fame** (`hall-of-fame.html`): weekly podium finishes and the closet of shame

**Features:**
- **Navigation**: Switch between views using the navigation buttons
- **Week Selection Dropdown**: Choose any week to analyze player performance
- **Detailed Player Cards**: Points, positions, teams, and starter indicators
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Static Files**: No server-side processing required

## 🔄 Scheduling Snapshots

Live scores do not need the job at all. The snapshot only needs refreshing a
couple of times a week, and `setup_cron.sh` installs exactly that:

```
0 6 * * *   update_league_data.sh   # daily 6am
0 13 * * 2  update_league_data.sh   # Tuesday 1pm, after Sleeper finalizes the week
```

`update_league_data.sh` takes a snapshot, commits the changed files and pushes. Run `python sleeper_league_data.py` by hand any time you want a fresh
snapshot sooner.

## 📁 File Structure

After running the script, you'll have these files:

```
sleeper/
├── sleeper_league_data.py          # Writes the snapshot
├── make_archive_pages.py           # Builds an archived season's pages
├── sleeper-live.js                 # Shared loader: snapshot + live view + polling
├── index.html / weekly.html / stats.html / hall-of-fame.html
├── 2025/                           # Archived season: pages + final snapshot
├── tests/                          # python -m unittest; node --test tests/sleeper-live.test.js
├── docs/adr/                       # Architecture decision records
├── CONTEXT.md                      # Project vocabulary
├── README.md                       # This file
├── .env                            # Configuration file (create this)
├── venv/                           # Python virtual environment
├── web_interface_data.json         # Snapshot: weeks, teams, player subset
├── league_XXXXXX_info.json         # League configuration
├── league_XXXXXX_rosters.json      # Team rosters and standings
├── league_XXXXXX_users.json        # League members
├── league_XXXXXX_matchups_week_X.json # Current week's raw matchups
├── league_XXXXXX_unrostered_season_stats.json # Best unowned team source
├── league_XXXXXX_draft_info.json   # Draft settings
├── league_XXXXXX_draft_picks.json  # All draft picks
└── nfl_state.json                  # Current NFL week/season info
```

## 🔧 Advanced Usage

### Multiple Leagues

To track multiple leagues, you have several options:

**Option 1: Multiple .env files**
```bash
# Create separate directories for each league
mkdir league1 league2
cp sleeper_league_data.py index.html league1/
cp sleeper_league_data.py index.html league2/

# Create .env file in each directory with different SLEEPER_LEAGUE_ID
echo "SLEEPER_LEAGUE_ID=1389378463139373056" > league1/.env
echo "SLEEPER_LEAGUE_ID=ANOTHER_LEAGUE_ID" > league2/.env
```

**Option 2: Command line arguments**
```bash
python sleeper_league_data.py 1389378463139373056
python sleeper_league_data.py ANOTHER_LEAGUE_ID
```

Each league will create its own set of JSON files.

### .env Configuration Options

The `.env` file supports the following configuration options:

```env
# Required: Your Sleeper League ID
SLEEPER_LEAGUE_ID=1389378463139373056

# Optional: Web server port (default: 8000)
WEB_SERVER_PORT=8000

# Optional: Update frequency for future scheduling features
UPDATE_FREQUENCY_MINUTES=30
UPDATE_DURING_GAMES_ONLY=true

# Optional: Data retention settings
KEEP_HISTORICAL_MATCHUPS=true
MAX_WEEKS_TO_KEEP=17
```

**Note**: Currently only `SLEEPER_LEAGUE_ID` is used by the script. Other options are reserved for future features.

### Automatic Port Selection

The script automatically finds an available port starting from 8000:
- If 8000 is available: uses 8000
- If 8000 is in use: tries 8001, 8002, etc.
- The script will display the actual port being used in the terminal

**No manual port configuration needed!**

### Data Analysis

All data is stored in JSON format for easy analysis:

```python
import json

# Load roster data
with open('league_XXXXXX_rosters.json', 'r') as f:
    rosters = json.load(f)

# Analyze team performance
for roster in rosters:
    team_name = roster.get('settings', {}).get('team_name', 'Unknown')
    wins = roster.get('settings', {}).get('wins', 0)
    points = roster.get('settings', {}).get('fpts', 0)
    print(f"{team_name}: {wins} wins, {points} points")
```

## 🌐 Web Interface Features

- **Season Results** (`index.html`): team cards sorted by Points For, computed live from every scored week's starter points, with rosters split into starters, bench and scrubs, plus the best unowned team
- **Weekly Results** (`weekly.html`): week selector, per-team optimal lineups, and the best unowned lineup for that week
- **Stats** (`stats.html`): line, stacked bar and cumulative charts with per-team toggles
- **Hall of Fame** (`hall-of-fame.html`): medals for weekly top-three finishes and the closet of shame for bottom finishes
- **Archived seasons**: the same four pages frozen at a season's final snapshot, linked from the nav
- **Responsive**: all pages adapt to mobile

## 🛠️ Troubleshooting

### Common Issues

**"Module not found: requests"**
```bash
# Make sure you're in the virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install requests
```

**"Failed to load data" or an empty page**
- The pages must be served over HTTP, not opened as `file://` URLs: run `./start_server.sh`
- Run `python sleeper_league_data.py` at least once so the snapshot files exist

**Header says "Live unavailable"**
- The browser could not reach `api.sleeper.app`; the page is showing the last snapshot
- Check the browser console for the failing request (a corporate proxy or ad blocker is the usual cause)
- If you see this error, kill any existing Python processes: `pkill -f python`

**"JSON.parse: unexpected character" error**
- This means the API endpoint isn't working properly
- Make sure you're running the Python script, not just serving static files
- Check the browser console (F12) for the actual error details

**"League not found"**
- Double-check your league ID
- Ensure the league is public or you have access
- Try the league ID from your Sleeper app URL

**Web interface shows error messages**
- The interface now provides detailed error messages with solutions
- Follow the troubleshooting steps shown in the error message
- Most issues are resolved by running the Python script correctly

### Getting Your League ID

1. Open Sleeper app or website
2. Go to your league
3. Look at the URL: `https://sleeper.app/leagues/YOUR_LEAGUE_ID/...`
4. Copy the long number (e.g., `1389378463139373056`)

## 📊 API Rate Limits

The script respects Sleeper's API guidelines:
- Stays under 1000 calls per minute
- Includes small delays between requests
- Uses appropriate User-Agent header

## 🔒 Privacy & Security

- **Read-Only**: Script only reads data, cannot modify your league
- **No Authentication**: Uses public API endpoints only
- **Browser to Sleeper**: viewers' browsers call the public Sleeper API directly; no key or proxy is involved

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify your league ID is correct
3. Ensure you have internet connectivity
4. Check that Python and required packages are installed

## 📝 License

This project is for personal use with Sleeper fantasy football leagues. Respect Sleeper's Terms of Service and API usage guidelines.

---

**Happy Fantasy Football!** 🏆
