const fs = require('fs');
const path = require('path');
const { dumpDebug } = require('../dom');

const BASE = 'https://ibbi.gov.in';
const LIST_PATH = '/liquidation-auction-notices/lists';

// IBBI's liquidation auction notices are a paginated list of PDF sale
// notices (corporate debtor asset sales), not an HTML table with reserve
// price/EMD columns like IBAPI. The reliable, unfakeable part of this
// scrape is finding links to those PDFs — everything else (asset
// description, reserve price, auction date) lives inside the PDF's free
// text, which varies notice-to-notice and isn't safe to regex-parse for a
// number you'd act on financially. So this adapter surfaces notice
// metadata + PDF links, and optionally downloads the PDFs for you to read,
// rather than guessing at structured fields.
//
// Unverified against the live DOM (same sandbox network limitation as
// ibapi.js) beyond confirming the URL pattern and PDF path via search
// results. Run with --debug on first use.
async function scrape(page, filters, opts) {
  const maxPages = filters.maxPages ? Number(filters.maxPages) : 3;
  const notices = [];
  const seenUrls = new Set();

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const url = `${BASE}${LIST_PATH}?page=${pageNum}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (opts.debug && pageNum === 1) await dumpDebug(page, opts.debugDir, 'ibbi-loaded');

    const links = await page.locator('a[href*="auction_notice_liquidation"]').all();
    if (links.length === 0) {
      if (pageNum === 1) {
        console.warn(
          '[ibbi] no PDF links found on page 1 — site structure may differ from what this was built against. Run with --debug and check ibbi-loaded.html.'
        );
      }
      break; // either ran past the last page, or the link pattern changed
    }

    let newOnThisPage = 0;
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (!href) continue;
      const pdfUrl = href.startsWith('http') ? href : `${BASE}${href}`;
      if (seenUrls.has(pdfUrl)) continue;
      seenUrls.add(pdfUrl);
      newOnThisPage++;

      const linkText = (await link.textContent())?.trim();
      const context = await link
        .evaluate((el) => el.closest('li, tr, div')?.textContent?.trim().slice(0, 300))
        .catch(() => '');

      notices.push({
        source: 'ibbi',
        title: linkText || extractTitleFromContext(context) || null,
        pdfUrl,
        context: context || null,
      });
    }

    if (newOnThisPage === 0) break; // pagination looped back to page 1's content
  }

  if (opts.downloadPdfs) {
    const pdfDir = path.join(opts.outDir || path.join(__dirname, '..', '..', 'out'), 'ibbi-pdfs');
    await downloadAll(notices, pdfDir);
  }

  return notices;
}

function extractTitleFromContext(context) {
  if (!context) return null;
  return context.split(/\s{2,}|\n/)[0]?.trim().slice(0, 120) || null;
}

async function downloadAll(notices, pdfDir) {
  fs.mkdirSync(pdfDir, { recursive: true });
  for (const [i, notice] of notices.entries()) {
    const filename = `${String(i + 1).padStart(3, '0')}-${path.basename(new URL(notice.pdfUrl).pathname)}`;
    const dest = path.join(pdfDir, filename);
    try {
      const res = await fetch(notice.pdfUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      notice.localPdfPath = dest;
    } catch (err) {
      console.warn(`[ibbi] failed to download ${notice.pdfUrl}: ${err.message}`);
    }
  }
}

module.exports = { scrape, LIST_PATH };
