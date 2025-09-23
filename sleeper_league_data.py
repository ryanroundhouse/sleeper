#!/usr/bin/env python3
"""
Sleeper League Data Fetcher

This script fetches comprehensive league data from the Sleeper API including:
- League information
- Rosters
- Users
- Current week matchups
- Draft information (if available)

The script saves all data to JSON files for use by static HTML interfaces.

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
    
    def get_weekly_stats(self, sport: str = "nfl", season_type: str = "regular", season: str = "2025", week: int = 3) -> Optional[Dict]:
        """Get weekly stats for all NFL players."""
        return self._make_request(f"stats/{sport}/{season_type}/{season}/{week}")
    
    def get_multiple_weeks_stats(self, weeks: List[int], sport: str = "nfl", season_type: str = "regular", season: str = "2025") -> Dict[int, Optional[Dict]]:
        """Get stats for multiple weeks."""
        stats_by_week = {}
        for week in weeks:
            print(f"Fetching stats for week {week}...")
            stats_by_week[week] = self.get_weekly_stats(sport, season_type, season, week)
        return stats_by_week
    
    def get_multiple_weeks_matchups(self, league_id: str, weeks: List[int]) -> Dict[int, Optional[List[Dict]]]:
        """Get matchups for multiple weeks."""
        matchups_by_week = {}
        for week in weeks:
            print(f"Fetching matchups for week {week}...")
            matchups_by_week[week] = self.get_league_matchups(league_id, week)
        return matchups_by_week


def get_rostered_players(rosters_data: List[Dict]) -> set:
    """Get all player IDs that are currently rostered in the league."""
    rostered_players = set()
    for roster in rosters_data:
        players = roster.get('players', [])
        if players:
            rostered_players.update(players)
    return rostered_players


def get_unrostered_players_with_season_stats(players_data: Dict, rostered_players: set, stats_by_week: Dict[int, Dict]) -> Dict:
    """Get unrostered players with their season totals."""
    unrostered_with_stats = {}
    
    for player_id, player_info in players_data.items():
        # Skip if player is rostered
        if player_id in rostered_players:
            continue
            
        # Skip if player is not active
        if not player_info.get('active', False):
            continue
        
        # Calculate season totals for this player
        season_totals = {}
        weekly_stats = {}
        total_fantasy_points = 0
        weeks_played = 0
        
        for week, week_stats in stats_by_week.items():
            if not week_stats or player_id not in week_stats:
                continue
                
            player_week_stats = week_stats[player_id]
            weekly_stats[f'week_{week}'] = player_week_stats
            
            # Add to season totals
            for stat, value in player_week_stats.items():
                if isinstance(value, (int, float)) and stat != 'gms_active':
                    if stat not in season_totals:
                        season_totals[stat] = 0
                    season_totals[stat] += value
            
            # Track fantasy points and games (using 0.5 PPR scoring)
            week_fantasy_points = player_week_stats.get('pts_half_ppr', 0)
            if week_fantasy_points > 0:
                total_fantasy_points += week_fantasy_points
                weeks_played += 1
        
        # Only include players with meaningful season fantasy stats
        if total_fantasy_points > 0:
            unrostered_with_stats[player_id] = {
                'player_info': {
                    'name': f"{player_info.get('first_name', '')} {player_info.get('last_name', '')}".strip(),
                    'position': player_info.get('position', 'N/A'),
                    'team': player_info.get('team', 'N/A'),
                    'years_exp': player_info.get('years_exp', 0),
                    'fantasy_positions': player_info.get('fantasy_positions', [])
                },
                'season_stats': season_totals,
                'weekly_stats': weekly_stats,
                'total_fantasy_points': total_fantasy_points,
                'weeks_played': weeks_played,
                'avg_points_per_week': total_fantasy_points / weeks_played if weeks_played > 0 else 0
            }
    
    return unrostered_with_stats


def save_unrostered_players_season_stats(unrostered_stats: Dict, league_id: str, current_week: int, season: str = "2025") -> str:
    """Save unrostered players season stats to JSON file."""
    
    # Sort players by total season fantasy points
    sorted_players = []
    for player_id, data in unrostered_stats.items():
        total_fantasy_points = data['total_fantasy_points']
        sorted_players.append({
            'player_id': player_id,
            'total_fantasy_points': total_fantasy_points,
            **data
        })
    
    # Sort by total season fantasy points descending
    sorted_players.sort(key=lambda x: x['total_fantasy_points'], reverse=True)
    
    output_data = {
        'league_id': league_id,
        'season': season,
        'weeks_included': list(range(1, current_week + 1)),
        'total_unrostered_players': len(sorted_players),
        'generated_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'players': sorted_players
    }
    
    filename = f"league_{league_id}_unrostered_season_stats.json"
    with open(filename, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    return filename


def save_formatted_data_for_web(matchups_by_week: Dict[int, List[Dict]], players_data: Dict, users_data: List[Dict], rosters_data: List[Dict], league_info: Dict, current_week: int, league_id: str) -> None:
    """Save formatted data for web interface consumption."""
    
    # Create roster to user mapping
    roster_to_user = {}
    for user in users_data:
        user_roster = next((r for r in rosters_data if r.get('owner_id') == user.get('user_id')), None)
        if user_roster:
            roster_to_user[user_roster['roster_id']] = {
                'display_name': user.get('display_name', 'Unknown'),
                'team_name': user.get('metadata', {}).get('team_name', user.get('display_name', 'Unknown'))
            }
    
    formatted_data = {
        'weeks': [],
        'teams': roster_to_user,
        'players': {}
    }
    
    # Process each week
    for week, matchups in matchups_by_week.items():
        if not matchups:
            continue
            
        week_data = {
            'week': week,
            'matchups': []
        }
        
        for matchup in matchups:
            roster_id = matchup.get('roster_id')
            team_info = roster_to_user.get(roster_id, {'display_name': 'Unknown', 'team_name': 'Unknown'})
            
            # Calculate total points from starters only
            starters_points = matchup.get('starters_points', [])
            total_starters_points = sum(starters_points) if starters_points else 0
            
            matchup_data = {
                'roster_id': roster_id,
                'team_name': team_info['team_name'],
                'display_name': team_info['display_name'],
                'total_points': total_starters_points,
                'starters': matchup.get('starters', []),
                'starters_points': matchup.get('starters_points', []),
                'players_points': matchup.get('players_points', {}),
                'matchup_id': matchup.get('matchup_id')
            }
            
            # Add player details to global players dict
            for player_id, points in matchup.get('players_points', {}).items():
                if player_id not in formatted_data['players'] and player_id in players_data:
                    player_info = players_data[player_id]
                    formatted_data['players'][player_id] = {
                        'name': f"{player_info.get('first_name', '')} {player_info.get('last_name', '')}".strip(),
                        'position': player_info.get('position', 'N/A'),
                        'team': player_info.get('team', 'N/A')
                    }
            
            week_data['matchups'].append(matchup_data)
        
        formatted_data['weeks'].append(week_data)
    
    # Add league info to formatted data
    formatted_data['league_info'] = {
        'name': league_info.get('name', 'Unknown League'),
        'league_id': league_id,
        'season': league_info.get('season'),
        'current_week': current_week,
        'total_rosters': league_info.get('total_rosters')
    }
    
    # Save formatted data for web interface
    with open('web_interface_data.json', 'w') as f:
        json.dump(formatted_data, f, indent=2)
    
    print("Formatted data saved to web_interface_data.json")


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
    
    # Fetch matchups for multiple weeks (current week and previous weeks)
    weeks_to_fetch = list(range(1, current_week + 1))
    print(f"Fetching matchups for weeks 1-{current_week}...")
    matchups_by_week = api.get_multiple_weeks_matchups(league_id, weeks_to_fetch)
    
    # Keep current week matchups for backward compatibility
    matchups = matchups_by_week.get(current_week)
    
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
    
    # Save formatted data for web interface
    if players_data and users and rosters and matchups_by_week:
        print("\nPreparing formatted data for web interface...")
        save_formatted_data_for_web(matchups_by_week, players_data, users, rosters, league_info, current_week, league_id)
        
        print("\n" + "=" * 60)
        print("WEB INTERFACE READY")
        print("=" * 60)
        print("You can now open index.html or sleeper_web_interface.html in your browser")
        print("to view the league data. The files will work as static HTML pages.")
        print("\nTo serve the files locally, you can use:")
        print("  python3 -m http.server 8080")
        print("  Then visit: http://localhost:8080")
    
    # Fetch and process unrostered players season stats
    if players_data and rosters:
        print("\n" + "=" * 60)
        print("FETCHING UNROSTERED PLAYERS SEASON STATS")
        print("=" * 60)
        
        # Get current season from league info
        season = str(league_info.get('season', 2025))
        
        # Fetch stats for all weeks up to current week
        weeks_to_fetch = list(range(1, current_week + 1))
        print(f"Fetching weekly stats for weeks 1-{current_week} of {season} season...")
        stats_by_week = api.get_multiple_weeks_stats(weeks_to_fetch, season=season)
        
        # Filter out failed requests
        valid_stats = {week: stats for week, stats in stats_by_week.items() if stats is not None}
        
        if valid_stats:
            print(f"Successfully fetched stats for {len(valid_stats)} weeks")
            print("Identifying rostered players...")
            rostered_players = get_rostered_players(rosters)
            print(f"Found {len(rostered_players)} rostered players")
            
            print("Calculating season totals for unrostered players...")
            unrostered_stats = get_unrostered_players_with_season_stats(players_data, rostered_players, valid_stats)
            print(f"Found {len(unrostered_stats)} unrostered players with season fantasy stats")
            
            if unrostered_stats:
                print("Saving unrostered players season stats...")
                unrostered_filename = save_unrostered_players_season_stats(unrostered_stats, league_id, current_week, season)
                output_files['Unrostered Season Stats'] = unrostered_filename
                
                # Show top 10 unrostered performers by season total
                sorted_unrostered = sorted(unrostered_stats.items(), 
                                         key=lambda x: x[1]['total_fantasy_points'], 
                                         reverse=True)
                
                print(f"\nTop 10 Unrostered Performers (Season Total):")
                print("-" * 70)
                for i, (player_id, data) in enumerate(sorted_unrostered[:10], 1):
                    name = data['player_info']['name']
                    pos = data['player_info']['position']
                    team = data['player_info']['team']
                    total_points = data['total_fantasy_points']
                    weeks_played = data['weeks_played']
                    avg_points = data['avg_points_per_week']
                    print(f"{i:2d}. {name:<20} ({pos}, {team}) - {total_points:.1f} pts ({weeks_played} wks, {avg_points:.1f} avg)")
            else:
                print("No unrostered players found with season fantasy stats.")
        else:
            print("Failed to fetch weekly stats data for any week.")


if __name__ == "__main__":
    main()
