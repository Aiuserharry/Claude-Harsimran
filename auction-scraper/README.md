# Auction Scraper

On-demand CLI that scrapes distress-sale auction portals (bank NPA/SARFAESI
auctions, govt e-auctions, etc.) and filters listings by value/category.
Nothing runs on a schedule — it only does anything when you invoke it.

Currently supports two sites:
- **IBAPI** (ibapi.in) — Indian Banks Association's aggregator for public
  sector bank mortgaged-property (SARFAESI) auctions. Structured HTML
  results with reserve price/EMD.
- **IBBI** (ibbi.gov.in) — liquidation auction notices for companies in
  corporate insolvency. This one's a paginated list of PDF sale notices,
  not a structured table — reserve price/asset details live inside each
  PDF's free text, which this tool deliberately does not regex-parse (too
  unreliable for numbers you'd act on financially). It surfaces notice
  titles + PDF links, and can download the PDFs for you to read.

## ⚠️ First run will likely need one fix-up round

The selectors in `src/sites/ibapi.js` are based on IBAPI's publicly
documented search filters (State, District, Bank, Property Type) and result
fields (Reserve Price, EMD, Auction Date) — they have **not** been verified
against the live DOM, because the environment this was written in has no
outbound internet access. Run with `--debug` the first time; if a filter
doesn't get applied (it prints a warning) or the results table comes back
empty, send me `debug/ibapi-loaded.selects.json` and `debug/ibapi-loaded.html`
and I'll fix the label strings in one pass.

## Setup

```
cd auction-scraper
npm install
npx playwright install chromium   # downloads a browser Playwright can drive
```

## Usage

```
npm run scrape -- --site=ibapi --state=Maharashtra --minReserve=500000 --maxReserve=5000000 --debug
npm run scrape -- --site=ibbi --maxPages=5 --downloadPdfs --debug
```

Flags (all optional):
- `--site` — which adapter to use (default `ibapi`; also `ibbi`)
- `--state`, `--district`, `--bank`, `--propertyType` — IBAPI-only search
  filters, applied if a matching dropdown is found
- `--minReserve`, `--maxReserve` — IBAPI-only post-filter on parsed reserve
  price (₹)
- `--maxPages` — IBBI-only, how many list pages to walk (default 3)
- `--downloadPdfs` — IBBI-only, download each notice PDF into
  `out/ibbi-pdfs/`
- `--out` — output JSON path (default `out/<site>-<timestamp>.json`)
- `--debug` — dump page HTML/screenshot/select-inventory to `debug/` at each
  step, and print warnings for filters that couldn't be applied

Results print a short summary to the console and get written in full to a
JSON file.

## Adding another site

Each site is a module in `src/sites/` exporting `scrape(page, filters, opts)`.
Use `scrapeKeyedTable()` from `src/dom.js` to parse GridView-style result
tables by header text instead of column position — most of these portals are
old ASP.NET WebForms apps and that's the most resilient way to read them.

## Being a good citizen

These are public listing pages, not user accounts — no login/paywall is
bypassed. Still:
- Keep to one run at a time, don't parallelize requests against a single
  site.
- Don't scrape on a tight loop; this tool is on-demand by design.
- If a site's `robots.txt` disallows the search path, respect it.
