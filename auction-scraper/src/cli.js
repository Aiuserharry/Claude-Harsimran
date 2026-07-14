const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./browser');

const SITES = {
  ibapi: require('./sites/ibapi'),
  ibbi: require('./sites/ibbi'),
  mstc: require('./sites/mstc'),
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
    location: args.location || null,
    minReserve: args.minReserve ? Number(args.minReserve) : null,
    maxReserve: args.maxReserve ? Number(args.maxReserve) : null,
    maxPages: args.maxPages ? Number(args.maxPages) : null,
  };

  const debugDir = path.join(__dirname, '..', 'debug');
  const outDir = path.join(__dirname, '..', 'out');
  const opts = { debug: Boolean(args.debug), debugDir, outDir, downloadPdfs: Boolean(args.downloadPdfs) };

  console.log(`Scraping ${args.site} with filters:`, filters);

  const listings = await withBrowser((page) => site.scrape(page, filters, opts));

  console.log(`Found ${listings.length} matching listing(s).`);
  for (const l of listings.slice(0, 20)) {
    console.log(`- ${summarizeListing(l)}`);
  }
  if (listings.length > 20) console.log(`  ...and ${listings.length - 20} more.`);

  const outPath = args.out || path.join(outDir, `${args.site}-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(listings, null, 2));
  console.log(`Wrote full results to ${outPath}`);
}

function summarizeListing(l) {
  if (l.source === 'ibbi') {
    return `${l.title || '(untitled notice)'} — ${l.pdfUrl}`;
  }
  if (l.source === 'mstc') {
    return `[Lot ${l.lotNo || '?'}] ${l.description || '(no description)'} — ₹${l.reservePrice ?? l.reservePriceRaw} — ${l.location}`;
  }
  return `[${l.bank || '?'}] ${l.description || l.propertyType || '(no description)'} — ₹${l.reservePrice ?? l.reservePriceRaw} — ${l.auctionDate}`;
}

main().catch((err) => {
  console.error('Scrape failed:', err);
  process.exit(1);
});
