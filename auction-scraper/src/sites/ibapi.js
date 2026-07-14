const { scrapeTableBySelector, dumpDebug } = require('../dom');

const URL = 'https://www.ibapi.in/sale_info_home.aspx';

// Confirmed against a real debug dump (2026-07-14) of sale_info_home.aspx.
const SEL = {
  propertyType: '#DropDownList_Property_Type',
  state: '#DropDownList_State',
  district: '#DropDownList_District',
  bank: '#DropDownList_Bank',
  termsCheckbox: '#chk_term',
  auctionDateAll: '#radio_all',
  searchButton: '#Button_search',
  resultsTable: '#tbl_search',
};

async function scrape(page, filters, opts) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (opts.debug) await dumpDebug(page, opts.debugDir, 'ibapi-loaded');

  // "Notified" vs "ALL" auction-date radio has no default selection;
  // ALL is the broader net and matches this tool's on-demand discovery use.
  await page.locator(SEL.auctionDateAll).check({ force: true }).catch(() => {});

  await selectOptionContaining(page, SEL.propertyType, filters.propertyType);
  const stateApplied = await selectOptionContaining(page, SEL.state, filters.state);

  if (filters.district) {
    if (!stateApplied) {
      console.warn('[ibapi] --district given without a matching --state; district list only populates after a state is selected, so this filter is being skipped.');
    } else {
      // District dropdown is populated by an onchange AJAX call after state
      // selection; selectOption already fires 'change', so just wait for
      // more than the default "All Districts" option to show up.
      await page.waitForFunction(
        (sel) => document.querySelector(sel)?.options.length > 1,
        SEL.district,
        { timeout: 8000 }
      ).catch(() => console.warn('[ibapi] district list never populated after selecting state — skipping district filter.'));
      await selectOptionContaining(page, SEL.district, filters.district);
    }
  }

  await selectOptionContaining(page, SEL.bank, filters.bank);

  await acceptTerms(page, opts);

  const searchButton = page.locator(SEL.searchButton);
  const enabled = await page.waitForFunction(
    (sel) => !document.querySelector(sel)?.disabled,
    SEL.searchButton,
    { timeout: 10000 }
  ).then(() => true).catch(() => false);

  if (!enabled) {
    if (opts.debug) await dumpDebug(page, opts.debugDir, 'ibapi-terms-failed');
    console.warn('[ibapi] Search button never became enabled after accepting terms — see debug/ibapi-terms-failed.* if --debug was on.');
  }
  await searchButton.click();

  // Results load via an async call into the #tbl_search DataTable; wait for
  // the "Showing X to Y of Z entries" summary to move off the initial zero
  // state, or for the empty-table placeholder, whichever comes first.
  await page.waitForFunction(
    () => {
      const info = document.querySelector('#tbl_search_info')?.textContent || '';
      return !/Showing 0 to 0 of 0/.test(info);
    },
    { timeout: 15000 }
  ).catch(() => console.warn('[ibapi] results summary never updated — table may still be empty or the AJAX call is slower than expected.'));

  if (opts.debug) await dumpDebug(page, opts.debugDir, 'ibapi-results');

  const rows = await scrapeTableBySelector(page, SEL.resultsTable);
  return rows.map(normalizeRow).filter((r) => withinValueRange(r, filters));
}

// A plain simulated click on #chk_term doesn't stick (confirmed live: Playwright's
// check() throws "Clicking the checkbox did not change its state") — some page JS
// intercepts the click, probably to force the Terms modal open instead of a bare
// toggle. Try several strategies in order, since we can't see sale_info_home.js:
// (1) set the property directly + fire the events real user interaction would
// produce, in case the click handler is what's reverting a native click but a
// programmatic change event is still honored; (2) a real click as fallback in
// case the page instead requires an isTrusted event.
async function acceptTerms(page, opts) {
  const checkbox = page.locator(SEL.termsCheckbox);
  if (!(await checkbox.count())) {
    console.warn('[ibapi] no terms checkbox found on page.');
    return;
  }

  await checkbox.evaluate((el) => {
    el.checked = true;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('click', { bubbles: true }));
  });

  const enabledAfterDirect = await page
    .locator(SEL.searchButton)
    .evaluate((el) => !el.disabled)
    .catch(() => false);
  if (enabledAfterDirect) return;

  await checkbox.click({ force: true }).catch(() => {});
}

async function selectOptionContaining(page, selector, value) {
  if (!value) return false;
  const locator = page.locator(selector);
  if (!(await locator.count())) return false;
  const options = await locator.locator('option').allTextContents();
  const match = options.find((o) => o.toLowerCase().includes(value.toLowerCase()));
  if (!match) {
    console.warn(`[ibapi] no option matching "${value}" in ${selector}`);
    return false;
  }
  await locator.selectOption({ label: match });
  return true;
}

// Real headers confirmed from a debug dump: "Property ID", "Bank Name",
// "Property", "Reserve Price (Rs)", "EMD (Rs)", "EMD Last Date & Time",
// "Auction Start Date & Time", "Auction End Date & Time", "State",
// "District", "City". Matched case-insensitively but exactly (not by
// substring) since e.g. "Property ID" and "Property" would otherwise
// collide on a naive .includes('property') check.
function normalizeRow(raw) {
  const findExact = (headerName) => {
    const key = Object.keys(raw).find((k) => k.trim().toLowerCase() === headerName.toLowerCase());
    return key ? raw[key] : '';
  };

  const reserveText = findExact('Reserve Price (Rs)');
  return {
    source: 'ibapi',
    propertyId: findExact('Property ID'),
    bank: findExact('Bank Name'),
    description: findExact('Property'),
    reservePriceRaw: reserveText,
    reservePrice: parseIndianCurrency(reserveText),
    emd: findExact('EMD (Rs)'),
    emdLastDate: findExact('EMD Last Date & Time'),
    auctionStart: findExact('Auction Start Date & Time'),
    auctionEnd: findExact('Auction End Date & Time'),
    state: findExact('State'),
    district: findExact('District'),
    city: findExact('City'),
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
