const { scrapeKeyedTable, trySelectByLabel, dumpDebug } = require('../dom');

const URL = 'https://www.ibapi.in/sale_info_home.aspx';

const EXPECTED_HEADER_KEYWORDS = [
  'bank',
  'state',
  'district',
  'reserve',
  'emd',
  'auction',
  'property',
];

// Best-effort field names based on IBAPI's public description (state,
// district, bank, property type filters). Unverified against the live DOM
// because this environment's outbound network is currently blocked — run
// with --debug on first use and share debug/*.selects.json if these don't
// match, so the label strings below can be corrected.
async function scrape(page, filters, opts) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  if (opts.debug) await dumpDebug(page, opts.debugDir, 'ibapi-loaded');

  const applied = {};
  applied.state = await trySelectByLabel(page, 'State', filters.state);
  applied.district = await trySelectByLabel(page, 'District', filters.district);
  applied.bank = await trySelectByLabel(page, 'Bank', filters.bank);
  applied.propertyType = await trySelectByLabel(page, 'Property Type', filters.propertyType);

  for (const [field, ok] of Object.entries(applied)) {
    if (filters[field] && !ok) {
      console.warn(`[ibapi] could not apply filter "${field}=${filters[field]}" (selector not found)`);
    }
  }

  const searchButton = page.getByRole('button', { name: /search/i }).first();
  if (await searchButton.count()) {
    await Promise.all([
      page.waitForLoadState('networkidle').catch(() => {}),
      searchButton.click(),
    ]);
  }

  if (opts.debug) await dumpDebug(page, opts.debugDir, 'ibapi-results');

  const rows = await scrapeKeyedTable(page, EXPECTED_HEADER_KEYWORDS);

  return rows.map(normalizeRow).filter((r) => withinValueRange(r, filters));
}

function normalizeRow(raw) {
  const findValue = (keyword) => {
    const key = Object.keys(raw).find((k) => k.toLowerCase().includes(keyword));
    return key ? raw[key] : '';
  };

  const reserveText = findValue('reserve');
  const reservePrice = parseIndianCurrency(reserveText);

  return {
    source: 'ibapi',
    bank: findValue('bank'),
    state: findValue('state'),
    district: findValue('district'),
    propertyType: findValue('property') || findValue('asset'),
    description: findValue('description') || findValue('description'),
    reservePriceRaw: reserveText,
    reservePrice,
    emd: findValue('emd'),
    auctionDate: findValue('auction date') || findValue('date'),
    raw,
  };
}

function parseIndianCurrency(text) {
  if (!text) return null;
  const digits = text.replace(/[^0-9.]/g, '');
  return digits ? Number(digits) : null;
}

function withinValueRange(row, filters) {
  if (row.reservePrice == null) return true; // keep unparsed rows rather than silently dropping them
  if (filters.minReserve != null && row.reservePrice < filters.minReserve) return false;
  if (filters.maxReserve != null && row.reservePrice > filters.maxReserve) return false;
  return true;
}

module.exports = { scrape, URL };
