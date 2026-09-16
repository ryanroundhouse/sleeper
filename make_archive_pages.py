#!/usr/bin/env python3
"""
Generate the pages for an archived season from the current-season pages.

Usage: python make_archive_pages.py <year>

Writes <year>/index.html, weekly.html, stats.html and hall-of-fame.html with:
- live view switched off (the season is frozen at its final snapshot)
- the shared script loaded from the parent directory
- an archive banner and a "Current Season" link back to the root
Run sleeper_league_data.py <old_league_id> <year> first to write the snapshot.
"""
import os
import sys

PAGES = ['index.html', 'weekly.html', 'stats.html', 'hall-of-fame.html']


def archive_page(html: str, year: str) -> str:
    # The season nav link is an <a> on stats.html and a <button> elsewhere;
    # exactly one of the two forms must be present.
    nav_forms = [
        (f'<a href="{year}/index.html" class="nav-button nav-button-archive">{year} Season</a>',
         '<a href="../index.html" class="nav-button nav-button-archive">⬅ Current Season</a>'),
        (f'<button class="nav-button nav-button-archive" onclick="window.location.href=\'{year}/index.html\'">{year} Season</button>',
         '<button class="nav-button nav-button-archive" onclick="window.location.href=\'../index.html\'">⬅ Current Season</button>'),
    ]
    present = [pair for pair in nav_forms if pair[0] in html]
    if len(present) != 1:
        raise ValueError(f'expected exactly one "{year} Season" nav link, found {len(present)}')

    replacements = present + [
        ('const LIVE_VIEW = true;', 'const LIVE_VIEW = false;'),
        ('<script src="sleeper-live.js"></script>', '<script src="../sleeper-live.js"></script>'),
        ('            <p id="league-info">Fetching league information...</p>\n        </div>\n',
         '            <p id="league-info">Fetching league information...</p>\n        </div>\n\n'
         f'        <div class="archive-banner">📦 {year} Season Archive — final results as of the end of the season. '
         '<a href="../index.html">Go to the current season</a>.</div>\n'),
        ('<title>', f'<title>{year} Archive - '),
    ]
    for old, new in replacements:
        if old not in html:
            raise ValueError(f"expected to find {old!r}; has the page markup drifted?")
        html = html.replace(old, new, 1)
    # Page-specific wording; only present on some pages
    html = html.replace('No champions yet... the season is still young!', 'No champions recorded for this season.')
    return html


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    year = sys.argv[1]
    os.makedirs(year, exist_ok=True)
    for page in PAGES:
        with open(page) as f:
            html = f.read()
        try:
            out = archive_page(html, year)
        except ValueError as err:
            sys.exit(f"{page}: {err}")
        with open(os.path.join(year, page), 'w') as f:
            f.write(out)
        print(f"wrote {year}/{page}")


if __name__ == '__main__':
    main()
