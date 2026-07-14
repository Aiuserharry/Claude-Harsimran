const fs = require('fs');
const path = require('path');

/**
 * Government/bank auction portals are usually classic ASP.NET GridViews:
 * a plain <table> with a header row of <th>/<td> and one <tr> per listing.
 * Rather than hardcoding column positions (which break the moment a site
 * adds/reorders a column), find the table whose header row contains most
 * of the expected keywords, then key each row by its header text.
 */
async function scrapeKeyedTable(page, expectedHeaderKeywords) {
  const tables = await page.locator('table').all();
  let best = { score: 0, rows: [] };

  for (const table of tables) {
    const headerCells = await table
      .locator('tr').first()
      .locator('th, td')
      .allTextContents();
    const headers = headerCells.map((h) => h.trim()).filter(Boolean);
    if (headers.length < 2) continue;

    const lowerHeaders = headers.map((h) => h.toLowerCase());
    const score = expectedHeaderKeywords.reduce(
      (n, kw) => n + (lowerHeaders.some((h) => h.includes(kw)) ? 1 : 0),
      0
    );
    if (score <= best.score) continue;

    const bodyRows = await table.locator('tr').all();
    const rows = [];
    for (let i = 1; i < bodyRows.length; i++) {
      const cells = await bodyRows[i].locator('th, td').allTextContents();
      const trimmed = cells.map((c) => c.trim());
      if (trimmed.every((c) => c === '')) continue;
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = trimmed[idx] ?? '';
      });
      rows.push(obj);
    }
    best = { score, rows };
  }

  return best.rows;
}

/**
 * Best-effort dropdown filler: finds a <select> near text matching
 * labelText (checks aria-label, preceding label/span/td text) and picks
 * the option whose visible text contains `value` (case-insensitive).
 * Returns true if a selection was made, false if no matching
 * select/option was found (caller should treat this as "filter skipped",
 * not a hard failure).
 */
async function trySelectByLabel(page, labelText, value) {
  if (!value) return false;

  const byAria = page.locator(
    `select[aria-label*="${labelText}" i], select[title*="${labelText}" i], select[id*="${labelText}" i], select[name*="${labelText}" i]`
  );
  if (await byAria.count()) {
    return selectMatchingOption(byAria.first(), value);
  }

  const selects = await page.locator('select').all();
  for (const select of selects) {
    const nearbyText = await select
      .evaluate((el, len) => {
        const row = el.closest('tr, td, div, li');
        return (row?.textContent || '').slice(0, len);
      }, 200)
      .catch(() => '');
    if (nearbyText.toLowerCase().includes(labelText.toLowerCase())) {
      return selectMatchingOption(select, value);
    }
  }

  return false;
}

/**
 * Like scrapeKeyedTable, but for when the table's selector is already
 * known (confirmed from a real debug dump) rather than guessed by header
 * keywords. Skips DataTables' "No data available in table" placeholder
 * row instead of returning it as a bogus listing.
 */
async function scrapeTableBySelector(page, selector) {
  const table = page.locator(selector).first();
  if (!(await table.count())) return [];

  const headers = (await table.locator('thead th, tr').first().locator('th, td').allTextContents())
    .map((h) => h.trim())
    .filter(Boolean);
  if (headers.length < 2) return [];

  const bodyRows = await table.locator('tbody tr').all();
  const rows = [];
  for (const row of bodyRows) {
    const cells = await row.locator('th, td').allTextContents();
    const trimmed = cells.map((c) => c.trim());
    if (trimmed.every((c) => c === '')) continue;
    if (trimmed.length === 1 && /no data available/i.test(trimmed[0])) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = trimmed[idx] ?? '';
    });
    rows.push(obj);
  }
  return rows;
}

async function selectMatchingOption(selectLocator, value) {
  const options = await selectLocator.locator('option').allTextContents();
  const match = options.find((o) => o.toLowerCase().includes(value.toLowerCase()));
  if (!match) return false;
  await selectLocator.selectOption({ label: match });
  return true;
}

async function dumpDebug(page, dir, name) {
  fs.mkdirSync(dir, { recursive: true });
  const htmlPath = path.join(dir, `${name}.html`);
  const pngPath = path.join(dir, `${name}.png`);
  fs.writeFileSync(htmlPath, await page.content());
  await page.screenshot({ path: pngPath, fullPage: true }).catch(() => {});

  const selects = await page.locator('select').all();
  const selectInfo = [];
  for (const s of selects) {
    const id = await s.getAttribute('id');
    const name = await s.getAttribute('name');
    const nearbyText = await s
      .evaluate((el) => el.closest('tr, td, div, li')?.textContent?.trim().slice(0, 80))
      .catch(() => '');
    selectInfo.push({ id, name, nearbyText });
  }
  fs.writeFileSync(path.join(dir, `${name}.selects.json`), JSON.stringify(selectInfo, null, 2));

  const checkboxes = await page.locator('input[type="checkbox"]').all();
  const checkboxInfo = [];
  for (const cb of checkboxes) {
    checkboxInfo.push({
      id: await cb.getAttribute('id'),
      name: await cb.getAttribute('name'),
      checked: await cb.isChecked().catch(() => null),
      visible: await cb.isVisible().catch(() => null),
    });
  }
  const buttons = await page.locator('input[type="button"], button').all();
  const buttonInfo = [];
  for (const b of buttons) {
    buttonInfo.push({
      id: await b.getAttribute('id'),
      value: await b.getAttribute('value'),
      disabled: await b.isDisabled().catch(() => null),
    });
  }
  fs.writeFileSync(
    path.join(dir, `${name}.controls.json`),
    JSON.stringify({ checkboxes: checkboxInfo, buttons: buttonInfo }, null, 2)
  );

  console.log(`[debug] wrote ${htmlPath}, ${pngPath}, ${name}.selects.json, and ${name}.controls.json`);
}

module.exports = { scrapeKeyedTable, scrapeTableBySelector, trySelectByLabel, dumpDebug };
