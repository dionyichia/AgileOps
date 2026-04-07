# AgileOps


Running instructions (Sri):

---
  The scripts use anthropic.Anthropic() which reads from the OS environment, not .env files. Load it before running:

  cd "/Users/sricharan/Charan/Berkeley/Y3S2/PM Project/AgileOps"
  source .venv/bin/activate
  export $(grep -v '^#' .env | xargs)

  Then test the pipeline end-to-end with Gong (good first test since you can compare against the hardcoded values):

  Step 1 — Scrape
  python backend/scripts/parser_scraper.py --tool "Gong" --url "https://www.gong.io"
  Expected: backend/data/scraped_gong.json created, ~8-12 sources listed.

  Step 2 — Classify
  python backend/scripts/classifier.py --scraped backend/data/scraped_gong.json
  Expected: backend/data/tool_features_gong.json created, node impacts printed to terminal.

  Step 3 — Simulate
  python backend/scripts/sim.py --tool_features backend/data/tool_features_gong.json \
      --output_path backend/data/monte_carlo_results_gong_scraped.json
  Expected: Weekly table printed, results saved. Compare the node impacts against the hardcoded Gong values in sim.py lines 73–90 — they should be in the same ballpark.

  Step 4 — Verify the original still works
  python backend/scripts/sim.py
  Expected: Runs with hardcoded Gong defaults, no change from before.