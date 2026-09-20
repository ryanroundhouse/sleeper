# Gacha machine

## Agreed behavior

- A compact machine sits at the bottom-right on every page, opening a larger panel that fits desktop and mobile screens.
- Turning the handle shakes the capsules, drops one, and reveals a player's externally hosted headshot, name, position, and NFL team. Reduced-motion preferences receive a simple reveal.
- Draws are for entertainment and do not change fantasy rosters or award prizes.
- The pool is this league's current-season draft selections, including when visiting archived pages.
- Every eligible player has equal odds. No repeats within the day's three draws; players become eligible again the next day.
- Each browser/device gets three draws per day, shared across site pages and surviving refreshes. Clearing browser data resets this local state; devices do not synchronize.
- The allowance resets at midnight America/Toronto. Display remaining draws and a reset countdown.
- Display saved draw history so viewers can reference previously drawn players.

## Source findings

The current draft snapshot contains 266 unique player IDs and includes names,
positions, and teams. Draft selections must come from the draft-picks data,
not the general player subset or current rosters.

Sleeper's CDN serves externally hosted player headshots using existing player
IDs, for example <https://sleepercdn.com/content/nfl/players/9221.jpg>.
That sample endpoint was verified to return a JPEG. The URL pattern is not a
documented API guarantee; unavailable images need a fallback.

## Draw history

History persists across days and seasons in this browser. Entries include the
player's headshot, name, position, NFL team, draft season, and Toronto date/time.
Newest draws appear first; repeat players on different days remain separate
entries. Earlier entries are available via “Show earlier draws”. Clearing
browser data removes the history.

The user confirmed the shared understanding and authorized implementation.

## Implementation

The shared widget resolves current-season data relative to its script, so archive
pages use the same current draft and allowance. A Web Lock serializes draws across
tabs, and each result is saved before its animation begins. Failed storage writes
or unavailable draft data do not consume a draw. Missing headshots fall back to
player initials. Browsers must support Web Locks and run on HTTPS or localhost.

The allowance is intentionally browser-local, not an authenticated anti-cheat
limit; browser data and the device clock remain under the viewer's control.
