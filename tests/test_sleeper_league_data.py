import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import sleeper_league_data as sld


class ResolveCurrentWeek(unittest.TestCase):
    def test_in_season_uses_nfl_week(self):
        league = {'season': '2026', 'status': 'in_season', 'settings': {'last_scored_leg': 1}}
        state = {'season': '2026', 'week': 3}
        self.assertEqual(sld.resolve_current_week(league, state), 3)

    def test_complete_league_uses_final_scored_week(self):
        league = {'season': '2025', 'status': 'complete', 'settings': {'last_scored_leg': 18, 'leg': 18}}
        state = {'season': '2026', 'week': 1}
        self.assertEqual(sld.resolve_current_week(league, state), 18)

    def test_previous_season_without_complete_status_still_frozen(self):
        league = {'season': '2025', 'status': 'in_season', 'settings': {'leg': 17}}
        state = {'season': '2026', 'week': 1}
        self.assertEqual(sld.resolve_current_week(league, state), 17)

    def test_missing_nfl_state_defaults_to_week_one(self):
        league = {'season': '2026', 'status': 'in_season', 'settings': {}}
        self.assertEqual(sld.resolve_current_week(league, None), 1)


PLAYERS = {
    '1': {'first_name': 'Josh', 'last_name': 'Allen', 'position': 'QB', 'team': 'BUF'},
    '2': {'first_name': 'Derrick', 'last_name': 'Henry', 'position': 'RB', 'team': 'BAL'},
    'DET': {'first_name': 'Detroit', 'last_name': 'Lions', 'position': 'DEF', 'team': 'DET'},
}


class BuildPlayerSubset(unittest.TestCase):
    def test_only_requested_ids_with_trimmed_fields(self):
        subset = sld.build_player_subset(PLAYERS, {'1', 'DET'})
        self.assertEqual(subset, {
            '1': {'name': 'Josh Allen', 'position': 'QB', 'team': 'BUF'},
            'DET': {'name': 'Detroit Lions', 'position': 'DEF', 'team': 'DET'},
        })

    def test_unknown_ids_are_skipped(self):
        self.assertEqual(sld.build_player_subset(PLAYERS, {'999'}), {})


class SaveFormattedDataForWeb(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cwd = os.getcwd()
        os.chdir(self.tmp.name)

    def tearDown(self):
        os.chdir(self.cwd)
        self.tmp.cleanup()

    def test_players_cover_matchups_rosters_and_extra_ids(self):
        users = [{'user_id': 'u1', 'display_name': 'Ryan', 'metadata': {'team_name': 'Team R'}}]
        rosters = [{'roster_id': 1, 'owner_id': 'u1', 'players': ['1', '2']}]
        matchups = {1: [{'roster_id': 1, 'matchup_id': 1, 'starters': ['1'], 'starters_points': [20.5],
                         'players_points': {'1': 20.5, '2': 8.0}}]}
        sld.save_formatted_data_for_web(matchups, PLAYERS, users, rosters,
                                        {'name': 'L', 'season': '2026', 'total_rosters': 1},
                                        1, 'abc', extra_player_ids={'DET'})
        with open('web_interface_data.json') as f:
            data = json.load(f)
        self.assertEqual(set(data['players']), {'1', '2', 'DET'})
        self.assertEqual(data['players']['2'], {'name': 'Derrick Henry', 'position': 'RB', 'team': 'BAL'})
        self.assertEqual(data['weeks'][0]['matchups'][0]['total_points'], 20.5)
        self.assertIn('snapshot_time', data['league_info'])
        self.assertEqual(data['teams']['1']['team_name'], 'Team R')


if __name__ == '__main__':
    unittest.main()
