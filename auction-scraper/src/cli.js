const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./browser');

const SITES = {
  ibapi: require('./sites/ibapi'),
};

function parseArgs(argv) {
  const args = { site: 'ibapi', debug: false, out: null };
  for (const arg of argv) {
    const [rawKey, rawVal] = arg.replace(/^--/, '').split('=');
    const key = rawKey;
    const val = rawVal === undefined ? true : rawVal;
    args[key] = val;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const site = SITES[args.site];
  if (!site) {
    console.error(`Unknown site "${args.site}". Available: ${Object.keys(SITES).join(', ')}`);
    process.exit(1);
  }

  const filters = {
    state: args.state || null,
    district: args.district || null,
    bank: args.bank || null,
    propertyType: args.propertyType || null,
    minReserve: args.minReserve ? Number(args.minReserve) : null,
    maxReserve: args.maxReserve ? Number(args.maxReserve) : null,
  };

  const debugDir = path.join(__dirname, '..', 'debug');
  const opts = { debug: Boolean(args.debug), debugDir };

  console.log(`Scraping ${args.site} with filters:`, filters);

  const listings = await withBrowser((page) => site.scrape(page, filters, opts));

  console.log(`Found ${listings.length} matching listing(s).`);
  for (const l of listings.slice(0, 20)) {
    console.log(`- [${l.bank || '?'}] ${l.description || l.propertyType || '(no description)'} — ₹${l.reservePrice ?? l.reservePriceRaw} — ${l.auctionDate}`);
  }
  if (listings.length > 20) console.log(`  ...and ${listings.length - 20} more.`);

  const outPath = args.out || path.join(__dirname, '..', 'out', `${args.site}-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(listings, null, 2));
  console.log(`Wrote full results to ${outPath}`);
}

main().catch((err) => {
  console.error('Scrape failed:', err);
  process.exit(1);
});
