"""
parser_scraper.py
─────────────────────────────────────────────────────────────────────────────
Scrapes a SaaS tool's online presence to collect raw feature documentation.
Uses direct HTTP scraping + Claude-assisted web research.

Usage:
    python backend/scripts/parser_scraper.py --tool "Gong"
    python backend/scripts/parser_scraper.py --tool "Outreach" --url "https://www.outreach.io"
    python backend/scripts/parser_scraper.py --tool "Gong" --output backend/data/scraped_gong.json

Requires:
    ANTHROPIC_API_KEY env var

Outputs:
    backend/data/scraped_{tool_slug}.json
─────────────────────────────────────────────────────────────────────────────
"""

import argparse
import json
import re
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
from html.parser import HTMLParser
from datetime import datetime, timezone
from pathlib import Path

import anthropic

# ── Paths ──────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"

# ── Constants ──────────────────────────────────────────────────────────────────

# Sub-pages to probe on the tool's domain
STANDARD_PATHS = [
    "",
    "/features",
    "/product",
    "/platform",
    "/pricing",
    "/integrations",
    "/customers",
    "/case-studies",
    "/resources",
    "/docs",
    "/solutions",
    "/about",
]

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

MAX_PAGE_CHARS    = 6000   # Truncate each scraped page to this length
REQUEST_TIMEOUT   = 10     # HTTP timeout per page (seconds)
CRAWL_DELAY       = 0.4    # Polite delay between direct HTTP requests (seconds)


# ── HTML → Text ────────────────────────────────────────────────────────────────

class _TextExtractor(HTMLParser):
    """Strips HTML tags, returns clean visible text."""

    _SKIP = frozenset({
        "script", "style", "nav", "footer", "noscript",
        "iframe", "svg", "head", "form", "button", "aside",
    })

    def __init__(self):
        super().__init__()
        self._parts = []
        self._depth = 0

    def handle_starttag(self, tag, attrs):
        if tag.lower() in self._SKIP:
            self._depth += 1

    def handle_endtag(self, tag):
        if tag.lower() in self._SKIP:
            self._depth = max(0, self._depth - 1)

    def handle_data(self, data):
        if self._depth == 0:
            stripped = data.strip()
            if stripped:
                self._parts.append(stripped)

    @property
    def text(self):
        raw = " ".join(self._parts)
        return re.sub(r'\s+', ' ', raw).strip()


def _html_to_text(html: str) -> str:
    ex = _TextExtractor()
    try:
        ex.feed(html)
    except Exception:
        pass
    return ex.text


# ── Direct HTTP Scraping ───────────────────────────────────────────────────────

def _fetch(url: str) -> tuple[str, str]:
    """
    Fetch a URL. Returns (final_url, clean_text).
    Returns ("", "") on any failure.
    """
    req = urllib.request.Request(url, headers=REQUEST_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            ctype = resp.headers.get("Content-Type", "")
            if "text" not in ctype and "html" not in ctype:
                return url, ""
            raw = resp.read(600_000).decode("utf-8", errors="replace")
            return resp.url, _html_to_text(raw)
    except Exception:
        return "", ""


def direct_scrape(base_url: str) -> list[dict]:
    """
    Fetch the tool's homepage and standard sub-pages.
    Returns list of source objects: {url, type, title, content}.
    """
    if not base_url.startswith("http"):
        base_url = "https://" + base_url
    base_url = base_url.rstrip("/")

    sources = []
    visited: set[str] = set()

    print(f"  Direct scraping {base_url}")
    for path in STANDARD_PATHS:
        url = base_url + path
        final_url, text = _fetch(url)
        if not text or final_url in visited:
            continue
        visited.add(final_url)

        if any(kw in path for kw in ("case", "customer", "success", "story", "resource")):
            ptype = "case_study"
        elif any(kw in path for kw in ("docs", "api", "developer", "guide")):
            ptype = "docs"
        elif "pricing" in path:
            ptype = "pricing"
        elif "integr" in path:
            ptype = "integration"
        else:
            ptype = "website"

        sources.append({
            "url": final_url,
            "type": ptype,
            "title": path or "homepage",
            "content": text[:MAX_PAGE_CHARS],
        })
        print(f"    ✓  [{ptype:12s}]  {final_url[:72]}")
        time.sleep(CRAWL_DELAY)

    return sources


# ── AI-Assisted Research ───────────────────────────────────────────────────────

_AI_SYSTEM = """\
You are a research assistant collecting structured information about a B2B SaaS
sales tool for workflow-impact analysis.

You will be given:
1. Any content already scraped from the tool's website
2. The tool name and URL

Your job is to synthesise everything you know (from the scraped content AND your
training knowledge about this tool) into a structured JSON object.

Focus on:
- What specific features the tool has (especially AI/automation capabilities)
- Quantified ROI claims — time saved, productivity %, win-rate changes
- Which sales workflow steps it replaces, accelerates, or eliminates
- What other tools it integrates with

Return a JSON object — no markdown fences, pure JSON — with this structure:
{
  "tool_summary": "2-3 sentences on what this tool does and its core value prop",
  "key_features_raw": ["list of feature names / short descriptions"],
  "roi_benchmarks": ["quantified productivity claims, e.g. '60% less time on call prep'"],
  "integrations": ["tool/platform names it connects with"],
  "additional_sources": []
}"""


def ai_research(tool_name: str, base_url: str, already_scraped: list[dict]) -> dict:
    """
    Call Claude (no tools) to synthesise scraped content + training knowledge
    into structured tool data.

    Returns a dict with: tool_summary, key_features_raw, roi_benchmarks,
    integrations, additional_sources.
    """
    client = anthropic.Anthropic()

    # Summarise what we scraped to include in the prompt
    scraped_summary = ""
    if already_scraped:
        parts = []
        for s in already_scraped[:8]:
            body = s.get("content", "")[:2000]
            if body:
                parts.append(f"[{s.get('type','page')}] {s.get('url','')}\n{body}")
        scraped_summary = "\n\n---\n\n".join(parts)

    user_msg = (
        f"Tool: {tool_name}"
        + (f"\nWebsite: {base_url}" if base_url else "")
        + ("\n\nScraped content:\n\n" + scraped_summary if scraped_summary else "")
        + "\n\nReturn the JSON object as described in the system prompt."
    )

    print(f"\n  AI synthesis for '{tool_name}'...")

    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4096,
        system=_AI_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(l for l in lines if not l.strip().startswith("```")).strip()

    try:
        result = json.loads(raw)
        print(f"    ✓  Synthesis complete — "
              f"{len(result.get('key_features_raw', []))} features, "
              f"{len(result.get('roi_benchmarks', []))} benchmarks")
        return result
    except json.JSONDecodeError:
        print("    ⚠  AI synthesis returned non-JSON — using text summary")
        return {
            "tool_summary": raw[:600],
            "key_features_raw": [],
            "roi_benchmarks": [],
            "integrations": [],
            "additional_sources": [],
        }


# ── Main ──────────────────────────────────────────────────────────────────────

def slugify(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def run(tool_name: str, base_url: str, output_path: Path) -> dict:
    print(f"\n{'═'*60}")
    print(f"  PARSER / SCRAPER — {tool_name}")
    print(f"{'═'*60}")

    # Stage 1: Direct HTTP scrape (if base URL provided)
    direct_sources: list[dict] = []
    if base_url:
        direct_sources = direct_scrape(base_url)
        print(f"\n  Direct scrape complete: {len(direct_sources)} pages")
    else:
        print("  No base URL — skipping direct scrape")

    # Stage 2: AI-assisted research via Claude + web_search
    ai_data = ai_research(tool_name, base_url, direct_sources)

    # Merge and deduplicate sources
    all_sources = direct_sources + ai_data.get("additional_sources", [])
    seen: set[str] = set()
    deduped: list[dict] = []
    for s in all_sources:
        if not isinstance(s, dict):
            continue
        url = s.get("url", "")
        if url and url not in seen:
            seen.add(url)
            deduped.append(s)

    output = {
        "tool_name":        tool_name,
        "tool_slug":        slugify(tool_name),
        "base_url":         base_url,
        "scraped_at":       datetime.now(timezone.utc).isoformat(),
        "tool_summary":     ai_data.get("tool_summary", ""),
        "key_features_raw": ai_data.get("key_features_raw", []),
        "roi_benchmarks":   ai_data.get("roi_benchmarks", []),
        "integrations":     ai_data.get("integrations", []),
        "sources":          deduped,
        "source_count":     len(deduped),
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")

    print(f"\n{'─'*60}")
    print(f"  Total sources     : {len(deduped)}")
    print(f"  Features found    : {len(output['key_features_raw'])}")
    print(f"  ROI benchmarks    : {len(output['roi_benchmarks'])}")
    print(f"  Integrations      : {len(output['integrations'])}")
    print(f"  Saved → {output_path}")
    print(f"{'═'*60}\n")

    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Scrape a SaaS tool's online presence for feature analysis"
    )
    parser.add_argument("--tool", "-t", required=True,
        help="Tool name (e.g. 'Gong', 'Outreach', 'Salesloft')")
    parser.add_argument("--url", "-u", default="",
        help="Tool's base website URL (e.g. https://www.gong.io)")
    parser.add_argument("--output", "-o", default="",
        help="Output JSON path (default: backend/data/scraped_{slug}.json)")
    args = parser.parse_args()

    slug = slugify(args.tool)
    out = Path(args.output) if args.output else DATA_DIR / f"scraped_{slug}.json"
    run(args.tool, args.url.rstrip("/"), out)
