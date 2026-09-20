"""Archive generation must keep the gacha widget rooted at the current season."""
import unittest
from pathlib import Path

from make_archive_pages import PAGES, archive_page


class GachaArchive(unittest.TestCase):
    def test_every_archive_loads_shared_gacha_assets(self):
        root = Path(__file__).resolve().parents[1]
        for name in PAGES:
            with self.subTest(page=name):
                archived = archive_page((root / name).read_text(), '2025')
                self.assertIn('href="../gacha.css"', archived)
                self.assertIn('src="../gacha-core.js" defer', archived)
                self.assertIn('src="../gacha.js" defer', archived)
                self.assertIn('const LIVE_VIEW = false;', archived)


if __name__ == '__main__':
    unittest.main()
