# Sleeper Fantasy Football League Viewer

A comprehensive tool to fetch, store, and display Sleeper fantasy football league data with a beautiful web interface.

## 🏈 Features

- **Complete League Data Fetching**: Rosters, users, matchups, draft information, and NFL player database
- **Beautiful Web Interface**: Modern, responsive design showing team standings and detailed rosters
- **Offline Capability**: All data stored locally in JSON files
- **Real Player Names**: Displays actual player names, positions, and teams
- **Automatic Updates**: Fetches current week matchups and latest standings

## 📋 What Data Gets Updated

The script fetches and updates the following data each time it runs:

### **Always Updated (Changes Frequently)**
- **Team Standings** - Wins, losses, points for/against
- **Current Week Matchups** - Live scoring data for the current NFL week
- **Roster Changes** - Player adds/drops, waiver moves
- **NFL State** - Current week, season status

### **Occasionally Updated**
- **League Settings** - Scoring changes, roster positions
- **User Information** - Team names, display names
- **Player Database** - New players, team changes, injury status

### **Static After Draft**
- **Draft Information** - Pick order, draft results (only changes if redraft)
- **League Basic Info** - League name, total teams (rarely changes)

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

#### Option 1: Using Command Line (Quick Start)

1. **Fetch league data:**
   ```bash
   python sleeper_league_data.py YOUR_LEAGUE_ID
   ```
   
   Example:
   ```bash
   python sleeper_league_data.py 1264686617134628864
   ```

#### Option 2: Using .env File (Recommended for Automation)

1. **Create a .env file** in your sleeper directory:
   ```env
   # Copy this content to a file named ".env"
   SLEEPER_LEAGUE_ID=1264686617134628864
   WEB_SERVER_PORT=8000
   ```

2. **Fetch league data** (no arguments needed):
   ```bash
   python sleeper_league_data.py
   ```

#### Starting the Web Server

**Start the web server:**
```bash
python3 -m http.server 8000
```

**View your league:**
Open your browser to `http://localhost:8000`

## 🔄 Scheduling Automatic Updates

**Current Status**: The script does NOT automatically run on a schedule. You need to run it manually each time you want updated data.

### Option 1: Manual Updates
Run the script whenever you want fresh data:
```bash
# With command line argument
python sleeper_league_data.py YOUR_LEAGUE_ID

# Or with .env file (recommended)
python sleeper_league_data.py
```

### Option 2: Set Up Automated Scheduling

#### On macOS/Linux (using cron):

1. **Edit your crontab:**
   ```bash
   crontab -e
   ```

2. **Add a scheduled job** (example: update every hour during season):
   ```bash
   # Update league data every hour from September through January (using .env file)
   0 * * 9-12,1 * cd /path/to/sleeper && source venv/bin/activate && python sleeper_league_data.py
   
   # Or update every 30 minutes on game days (Sunday/Monday/Thursday)
   */30 * * * 0,1,4 cd /path/to/sleeper && source venv/bin/activate && python sleeper_league_data.py
   
   # Alternative: using command line argument (if no .env file)
   0 * * 9-12,1 * cd /path/to/sleeper && source venv/bin/activate && python sleeper_league_data.py YOUR_LEAGUE_ID
   ```

#### On Windows (using Task Scheduler):

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (e.g., daily at specific times)
4. Set action to run: `python sleeper_league_data.py` (if using .env file) or `python sleeper_league_data.py YOUR_LEAGUE_ID`
5. Set start directory to your sleeper folder

### Recommended Update Frequency

- **During Games**: Every 15-30 minutes (for live scoring)
- **Regular Season**: 2-3 times per day
- **Off-season**: Once per day or less
- **Draft Day**: Every few minutes during active drafting

## 📁 File Structure

After running the script, you'll have these files:

```
sleeper/
├── sleeper_league_data.py          # Main data fetching script
├── index.html                      # Web interface
├── README.md                       # This file
├── .env                           # Configuration file (create this)
├── venv/                          # Python virtual environment
├── league_XXXXXX_info.json        # League configuration
├── league_XXXXXX_rosters.json     # Team rosters and standings
├── league_XXXXXX_users.json       # League members
├── league_XXXXXX_matchups_week_X.json # Current week matchups
├── league_XXXXXX_draft_info.json  # Draft settings
├── league_XXXXXX_draft_picks.json # All draft picks
├── nfl_players.json               # Complete NFL player database (17MB)
└── nfl_state.json                 # Current NFL week/season info
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
echo "SLEEPER_LEAGUE_ID=1264686617134628864" > league1/.env
echo "SLEEPER_LEAGUE_ID=ANOTHER_LEAGUE_ID" > league2/.env
```

**Option 2: Command line arguments**
```bash
python sleeper_league_data.py 1264686617134628864
python sleeper_league_data.py ANOTHER_LEAGUE_ID
```

Each league will create its own set of JSON files.

### .env Configuration Options

The `.env` file supports the following configuration options:

```env
# Required: Your Sleeper League ID
SLEEPER_LEAGUE_ID=1264686617134628864

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

### Custom Web Server Port

If port 8000 is in use:

```bash
python3 -m http.server 8080  # or any available port
```

Then visit `http://localhost:8080`

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

The web interface (`index.html`) provides:

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Team Cards**: Each team displayed with standings and full roster
- **Player Information**: Real names, positions, and NFL teams
- **Visual Distinction**: Starters highlighted differently from bench players
- **Sortable**: Teams automatically sorted by wins, then points
- **Statistics**: Points for/against, waiver positions

## 🛠️ Troubleshooting

### Common Issues

**"Module not found: requests"**
```bash
pip install requests
```

**"Failed to load JSON files"**
- Make sure you've run the Python script first
- Check that all JSON files are in the same directory as index.html
- Verify the web server is running

**"League not found"**
- Double-check your league ID
- Ensure the league is public or you have access
- Try the league ID from your Sleeper app URL

**Web page shows "Loading..." forever**
- Check browser console for errors (F12)
- Verify all JSON files exist
- Make sure you're accessing via HTTP server, not file:// protocol

### Getting Your League ID

1. Open Sleeper app or website
2. Go to your league
3. Look at the URL: `https://sleeper.app/leagues/YOUR_LEAGUE_ID/...`
4. Copy the long number (e.g., `1264686617134628864`)

## 📊 API Rate Limits

The script respects Sleeper's API guidelines:
- Stays under 1000 calls per minute
- Includes small delays between requests
- Uses appropriate User-Agent header

## 🔒 Privacy & Security

- **Read-Only**: Script only reads data, cannot modify your league
- **No Authentication**: Uses public API endpoints only
- **Local Storage**: All data stored locally on your machine
- **No External Dependencies**: Web interface works offline after initial data fetch

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
