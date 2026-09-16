# 1. Pages read live scores from the Sleeper API instead of committed snapshots

Date: 2026-09-16

## Status

Accepted

## Context

The site is static HTML on GitHub Pages. Until now every number on it came
from JSON snapshots that a cron job pulled from Sleeper and pushed to git a few
times per game day. Two problems surfaced at the start of the 2026 season:

- Freshness was bounded by the cron schedule, and Sleeper's roster totals lag
  the live scores by up to a day, so the site showed zero Points For on a
  Tuesday after a full week of games.
- Every run rewrote the 19 MB NFL player database, so the repo history grew by
  that much per commit. It reached 196 MB after one season.

The goal was an update cadence of one to five minutes without the repo growing.
GitHub Pages can only build about ten times an hour, so committing at that
cadence was never an option on this host.

## Decision

The pages fetch league, rosters, users, NFL state, and matchups straight from
the Sleeper API when opened, and poll adaptively: every minute while scores are
changing, every five minutes once two consecutive polls see no change. Sleeper
serves these endpoints with `Access-Control-Allow-Origin: *` and a 60-second
edge cache, so no server sits in between.

Points For is computed in the browser as the sum of starter points across the
season's matchups. This is live during games and equals Sleeper's own total
once the week is finalized.

The cron job still writes a small snapshot, now once a day plus a Tuesday run.
It exists for three reasons: it is the fallback when the API is unreachable
from a viewer's browser, it carries the trimmed player-name subset the pages
need, and it is what gets frozen when a season is archived. The full player
database is never committed; a page that meets an unknown player id fetches
Sleeper's copy lazily and caches it in the browser for a day.

Archived seasons load the same shared script with live view disabled and stay
fully static.

## Consequences

- Freshness is now Sleeper's cache window, about a minute, with no repo growth.
- The site depends on Sleeper's API being reachable from viewers' browsers.
  When it is not, the page shows the last snapshot and says so in the header.
- Each open tab makes one small request per minute during games and one per
  five minutes otherwise. With a 14-team league this is negligible.
- Git history is rewritten once, right after this change lands, to drop the
  old player database copies. Any existing clone, including the cron box, has
  to be re-cloned.
- The four pages share one loader script. Adding a page means calling
  `SleeperLive.start` rather than fetching JSON by hand.
