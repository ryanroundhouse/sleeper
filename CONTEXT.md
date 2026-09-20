# Sleeper League Viewer

A static site that shows a Sleeper fantasy football league's current season and its archived past seasons.

## Language

### Data flow

**Snapshot**:
A copy of league data pulled from Sleeper and written to JSON files in the repo.
_Avoid_: update, fetch, data dump

**Publish**:
Making a snapshot visible on the site by committing and pushing it.
_Avoid_: deploy, update

**Live view**:
A page reading directly from the Sleeper API when opened, instead of from a snapshot.
_Avoid_: realtime mode, direct fetch

### Seasons

**Current season**:
The league season Sleeper reports as in progress. Its pages live at the site root.
_Avoid_: this year, primary

**Archived season**:
A completed season frozen at its final scored week, with its own copy of the pages under a year-named directory.
_Avoid_: historic, history, last year

**Game window**:
The stretches of the NFL week during which scores change: Thursday night, Sunday, and Monday night.

### League concepts

**Points For**:
A team's season total of starter points across all scored weeks.
_Avoid_: fpts, season points

**Best unowned team**:
The highest-scoring lineup that could be built from players no one in the league rosters, using season totals.
_Avoid_: free agent all-stars, unrostered team

### Gacha machine

**Draft pool**:
The players selected in this league's current-season draft, eligible to appear in the gacha machine.
_Avoid_: rostered players, available players

**Draw**:
A random player reveal from the draft pool for entertainment, with no effect on fantasy rosters. Each eligible player has equal odds, and a player cannot repeat within the same daily allowance.
_Avoid_: pick, transaction

**Daily allowance**:
The three draws available to a viewer each calendar day, resetting at midnight in America/Toronto.
_Avoid_: rolling limit

**Draw history**:
The saved list of players revealed by a viewer's draws across days and seasons, newest first. Each draw remains a separate entry, including repeat players on different days.
_Avoid_: roster, draft results
