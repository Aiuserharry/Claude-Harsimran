const { scrapeKeyedTable, dumpDebug } = require('../dom');

const URL = 'https://mstcecommerce.com/auctionhome/customs/index.jsp';

const EXPECTED_HEADER_KEYWORDS = [
  'lot',
  'description',
  'quantity',
  'reserve',
  'custom house',
  'location',
  'emd',
];

// MSTC's customs e-auction portal (seized/confiscated/unclaimed cargo —
// electronics, vehicles, misc imports) is a JSP app, structurally similar
// in vintage to IBAPI's ASP.NET pages but with a different flow: pick
// "Indian Customs Auction" then usually a specific Custom House/location
// before a catalog table appears, rather than one search form.
//
// This is the least-verified adapter of the three: search results only
// confirmed the entry URL, not the filter/table field names. Treat this as
// a scaffold to be corrected against real --debug output, more so than
// ibapi.js or ibbi.js. It reuses the same generic header-keyed table
// parser, so it degrades to "found no matching table" rather than
// silently returning wrong data if the real DOM differs.
async function scrape(page, filters, opts) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (opts.debug) await dumpDebug(page, opts.debugDir, 'mstc-entry');

  const customsLink = page.getByRole('link', { name: /customs/i }).first();
  if (await customsLink.count()) {
    await Promise.all([
      page.waitForLoadState('domcontentloaded').catch(() => {}),
      customsLink.click(),
    ]);
  } else {
    console.warn('[mstc] no "Customs" link found on entry page — may already be on the catalog, or the entry flow changed.');
  }

  if (filters.location) {
    const locationLink = page.getByText(new RegExp(filters.location, 'i')).first();
    if (await locationLink.count()) {
      await Promise.all([
        page.waitForLoadState('domcontentloaded').catch(() => {}),
        locationLink.click(),
      ]);
    } else {
      console.warn(`[mstc] could not find a link/option matching location "${filters.location}"`);
    }
  }

  if (opts.debug) await dumpDebug(page, opts.debugDir, 'mstc-catalog');

  const rows = await scrapeKeyedTable(page, EXPECTED_HEADER_KEYWORDS);
  if (rows.length === 0) {
    console.warn('[mstc] no catalog table matched expected headers — run with --debug and inspect mstc-catalog.html.');
  }

  return rows.map(normalizeRow).filter((r) => withinValueRange(r, filters));
}

function normalizeRow(raw) {
  const findValue = (keyword) => {
    const key = Object.keys(raw).find((k) => k.toLowerCase().includes(keyword));
    return key ? raw[key] : '';
  };

  const reserveText = findValue('reserve');
  return {
    source: 'mstc',
    lotNo: findValue('lot'),
    description: findValue('description'),
    quantity: findValue('quantity'),
    location: findValue('custom house') || findValue('location'),
    reservePriceRaw: reserveText,
    reservePrice: parseIndianCurrency(reserveText),
    emd: findValue('emd'),
    raw,
  };
}

function parseIndianCurrency(text) {
  if (!text) return null;
  const digits = text.replace(/[^0-9.]/g, '');
  return digits ? Number(digits) : null;
}

function withinValueRange(row, filters) {
  if (row.reservePrice == null) return true;
  if (filters.minReserve != null && row.reservePrice < filters.minReserve) return false;
  if (filters.maxReserve != null && row.reservePrice > filters.maxReserve) return false;
  return true;
}

module.exports = { scrape, URL };
