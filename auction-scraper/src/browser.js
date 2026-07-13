const fs = require('fs');
const { chromium } = require('playwright');

// Environments that pre-install a browser at a fixed path (e.g. Claude's
// sandboxed sessions) should point PW_CHROMIUM_PATH there so `npx
// playwright install` isn't needed. Falls back to Playwright's normal
// managed-browser resolution when unset, which is what a local dev
// machine or CI runner should use.
const executablePath = process.env.PW_CHROMIUM_PATH;

async function withBrowser(fn) {
  const launchOpts = { headless: true };
  if (executablePath && fs.existsSync(executablePath)) {
    launchOpts.executablePath = executablePath;
  }
  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  try {
    return await fn(page, context);
  } finally {
    await browser.close();
  }
}

module.exports = { withBrowser };
