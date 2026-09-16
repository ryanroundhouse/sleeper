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
