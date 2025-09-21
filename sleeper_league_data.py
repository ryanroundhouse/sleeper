#!/usr/bin/env python3
"""
Sleeper League Data Fetcher

This script fetches comprehensive league data from the Sleeper API including:
- League information
- Rosters
- Users
- Current week matchups
- Draft information (if available)

Usage: python sleeper_league_data.py <league_id>
"""

import requests
import json
import sys
import os
from typing import Dict, List, Optional
import time


class SleeperAPI:
    """Sleeper API client for fetching league data."""
    
    BASE_URL = "https://api.sleeper.app/v1"
    
    def __init__(self):
        self.session = requests.Session()
        # Add headers to be respectful to the API
        self.session.headers.update({
            'User-Agent': 'SleeperLeagueDataFetcher/1.0'
        })
    
    def _make_request(self, endpoint: str) -> Optional[Dict]:
        """Make a request to the Sleeper API with error handling."""
        url = f"{self.BASE_URL}/{endpoint}"
        try:
            print(f"Fetching: {url}")
            response = self.session.get(url)
            response.raise_for_status()
            
            # Be respectful to the API - small delay between requests
            time.sleep(0.1)
            
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching {url}: {e}")
            return None
    
    def get_league_info(self, league_id: str) -> Optional[Dict]:
        """Get basic league information."""
        return self._make_request(f"league/{league_id}")
    
    def get_league_rosters(self, league_id: str) -> Optional[List[Dict]]:
        """Get all rosters in the league."""
        return self._make_request(f"league/{league_id}/rosters")
    
    def get_league_users(self, league_id: str) -> Optional[List[Dict]]:
        """Get all users in the league."""
        return self._make_request(f"league/{league_id}/users")
    
    def get_league_matchups(self, league_id: str, week: int) -> Optional[List[Dict]]:
        """Get matchups for a specific week."""
        return self._make_request(f"league/{league_id}/matchups/{week}")
    
    def get_nfl_state(self) -> Optional[Dict]:
        """Get current NFL state (current week, season, etc.)."""
        return self._make_request("state/nfl")
    
    def get_draft_info(self, draft_id: str) -> Optional[Dict]:
        """Get draft information."""
        return self._make_request(f"draft/{draft_id}")
    
    def get_draft_picks(self, draft_id: str) -> Optional[List[Dict]]:
        """Get all picks from a draft."""
        return self._make_request(f"draft/{draft_id}/picks")
    
    def get_all_players(self) -> Optional[Dict]:
        """Get all NFL players data."""
        return self._make_request("players/nfl")


def format_league_summary(league_data: Dict, users_data: List[Dict], rosters_data: List[Dict]) -> str:
    """Format a summary of the league data."""
    summary = []
    summary.append("=" * 60)
    summary.append(f"LEAGUE: {league_data.get('name', 'Unknown')}")
    summary.append("=" * 60)
    summary.append(f"League ID: {league_data.get('league_id')}")
    summary.append(f"Season: {league_data.get('season')}")
    summary.append(f"Status: {league_data.get('status')}")
    summary.append(f"Total Rosters: {league_data.get('total_rosters')}")
    summary.append(f"Sport: {league_data.get('sport', 'nfl').upper()}")
    
    if league_data.get('draft_id'):
        summary.append(f"Draft ID: {league_data.get('draft_id')}")
    
    summary.append("\nROSTER STANDINGS:")
    summary.append("-" * 40)
    
    # Create a mapping of roster_id to user info
    roster_to_user = {}
    for user in users_data:
        # Find the roster for this user
        user_roster = next((r for r in rosters_data if r.get('owner_id') == user.get('user_id')), None)
        if user_roster:
            roster_to_user[user_roster['roster_id']] = user
    
    # Sort rosters by wins (if available)
    sorted_rosters = sorted(rosters_data, 
                          key=lambda x: x.get('settings', {}).get('wins', 0), 
                          reverse=True)
    
    for i, roster in enumerate(sorted_rosters, 1):
        user = roster_to_user.get(roster['roster_id'], {})
        team_name = user.get('metadata', {}).get('team_name', user.get('display_name', 'Unknown'))
        wins = roster.get('settings', {}).get('wins', 0)
        losses = roster.get('settings', {}).get('losses', 0)
        ties = roster.get('settings', {}).get('ties', 0)
        fpts = roster.get('settings', {}).get('fpts', 0)
        
        summary.append(f"{i:2d}. {team_name:<20} ({wins}-{losses}-{ties}) - {fpts} pts")
    
    return "\n".join(summary)


def load_env_file():
    """Load environment variables from .env file if it exists."""
    env_file = '.env'
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()


def get_league_id():
    """Get league ID from command line argument or environment variable."""
    # First try command line argument
    if len(sys.argv) >= 2:
        return sys.argv[1]
    
    # Then try environment variable
    league_id = os.environ.get('SLEEPER_LEAGUE_ID')
    if league_id:
        return league_id
    
    # If neither found, show usage and exit
    print("Error: No league ID provided!")
    print()
    print("Usage options:")
    print("1. Command line: python sleeper_league_data.py <league_id>")
    print("   Example: python sleeper_league_data.py 1264686617134628864")
    print()
    print("2. Environment file: Create a .env file with:")
    print("   SLEEPER_LEAGUE_ID=your_league_id_here")
    print()
    print("3. Environment variable:")
    print("   export SLEEPER_LEAGUE_ID=your_league_id_here")
    print("   python sleeper_league_data.py")
    sys.exit(1)


def main():
    """Main function to fetch and display league data."""
    # Load .env file if it exists
    load_env_file()
    
    # Get league ID from various sources
    league_id = get_league_id()
    print(f"Fetching data for Sleeper League ID: {league_id}")
    print("=" * 60)
    
    # Initialize API client
    api = SleeperAPI()
    
    # Get NFL state to understand current week
    print("Getting NFL state...")
    nfl_state = api.get_nfl_state()
    current_week = nfl_state.get('week', 1) if nfl_state else 1
    
    # Get all players data
    print("Fetching all NFL players data...")
    players_data = api.get_all_players()
    
    # Fetch all league data
    print("Fetching league information...")
    league_info = api.get_league_info(league_id)
    
    if not league_info:
        print(f"Error: Could not fetch league information for ID {league_id}")
        print("Please check that the league ID is correct and the league exists.")
        sys.exit(1)
    
    print("Fetching rosters...")
    rosters = api.get_league_rosters(league_id)
    
    print("Fetching users...")
    users = api.get_league_users(league_id)
    
    print("Fetching current week matchups...")
    matchups = api.get_league_matchups(league_id, current_week)
    
    # Get draft info if available
    draft_info = None
    draft_picks = None
    if league_info.get('draft_id'):
        print("Fetching draft information...")
        draft_info = api.get_draft_info(league_info['draft_id'])
        draft_picks = api.get_draft_picks(league_info['draft_id'])
    
    print("\n" + "=" * 60)
    print("DATA FETCHING COMPLETE")
    print("=" * 60)
    
    # Display formatted summary
    if league_info and users and rosters:
        print(format_league_summary(league_info, users, rosters))
    
    # Save all data to JSON files for detailed analysis
    output_files = {}
    
    if league_info:
        filename = f"league_{league_id}_info.json"
        with open(filename, 'w') as f:
            json.dump(league_info, f, indent=2)
        output_files['League Info'] = filename
    
    if rosters:
        filename = f"league_{league_id}_rosters.json"
        with open(filename, 'w') as f:
            json.dump(rosters, f, indent=2)
        output_files['Rosters'] = filename
    
    if users:
        filename = f"league_{league_id}_users.json"
        with open(filename, 'w') as f:
            json.dump(users, f, indent=2)
        output_files['Users'] = filename
    
    if matchups:
        filename = f"league_{league_id}_matchups_week_{current_week}.json"
        with open(filename, 'w') as f:
            json.dump(matchups, f, indent=2)
        output_files[f'Week {current_week} Matchups'] = filename
    
    if draft_info:
        filename = f"league_{league_id}_draft_info.json"
        with open(filename, 'w') as f:
            json.dump(draft_info, f, indent=2)
        output_files['Draft Info'] = filename
    
    if draft_picks:
        filename = f"league_{league_id}_draft_picks.json"
        with open(filename, 'w') as f:
            json.dump(draft_picks, f, indent=2)
        output_files['Draft Picks'] = filename
    
    if nfl_state:
        filename = f"nfl_state.json"
        with open(filename, 'w') as f:
            json.dump(nfl_state, f, indent=2)
        output_files['NFL State'] = filename
    
    if players_data:
        filename = f"nfl_players.json"
        with open(filename, 'w') as f:
            json.dump(players_data, f, indent=2)
        output_files['NFL Players'] = filename
    
    # Display output files
    print("\n" + "=" * 60)
    print("OUTPUT FILES CREATED:")
    print("=" * 60)
    for description, filename in output_files.items():
        print(f"{description:<20}: {filename}")
    
    print(f"\nAll data has been saved to JSON files for detailed analysis.")
    print("You can open these files to explore the complete league data structure.")


if __name__ == "__main__":
    main()
