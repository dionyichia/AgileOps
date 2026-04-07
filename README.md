# AgileOps


Running instructions (Sri):

---
  Load .env files
  source .venv/bin/activate
  export $(grep -v '^#' .env | xargs)

  Step 1 — Scrape
  python backend/scripts/parser_scraper.py --tool "Gong" --url "https://www.gong.io" // Can be changed to anything

  Step 2 — Classify
  python backend/scripts/classifier.py --scraped backend/data/scraped_gong.json

  Step 3 — Simulate
  python backend/scripts/sim.py --tool_features backend/data/tool_features_gong.json \
      --output_path backend/data/monte_carlo_results_gong_scraped.json

  Step 4 — Verify the original still works
  python backend/scripts/sim.py
  // Runs with hardcoded Gong defaults, no change from before.