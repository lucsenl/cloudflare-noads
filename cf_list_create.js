import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { synchronizeZeroTrustLists } from "./lib/api.js";
import {
  DEBUG,
  DRY_RUN,
  LIST_ITEM_LIMIT,
  LIST_ITEM_SIZE,
  PROCESSING_FILENAME,
  TIERS,
  TIER_NAMES,
  getTierBlocklistFilename,
  getTierAllowlistFilename,
  getTierListPrefix,
} from "./lib/constants.js";
import { normalizeDomain } from "./lib/helpers.js";
import {
  extractDomain,
  isComment,
  isValidDomain,
  memoize,
  notifyWebhook,
  readFile,
} from "./lib/utils.js";

const memoizedNormalizeDomain = memoize(normalizeDomain);

// Determine allowlist filename
const allowlistFilename = existsSync(PROCESSING_FILENAME.OLD_ALLOWLIST)
  ? PROCESSING_FILENAME.OLD_ALLOWLIST
  : PROCESSING_FILENAME.ALLOWLIST;

// Read shared allowlist (optional - may not exist if no ALLOWLIST_URLS configured)
const allowlist = new Map();
if (existsSync(allowlistFilename)) {
  console.log(`Processing shared allowlist: ${allowlistFilename}`);
  await readFile(resolve(`./${allowlistFilename}`), (line) => {
    const _line = line.trim();
    if (!_line) return;
    if (isComment(_line)) return;
    const domain = memoizedNormalizeDomain(_line, true);
    if (!isValidDomain(domain)) return;
    allowlist.set(domain, 1);
  });
  console.log(`Loaded ${allowlist.size} allowlisted domains.\n`);
} else {
  console.log("No shared allowlist found, proceeding without one.\n");
}

// Track global domain count across all tiers (shared LIST_ITEM_LIMIT)
let globalDomainCount = 0;

// Core domains set - used to deduplicate other tiers
const coreDomains = new Set();

// Process each tier
const tierResults = {};

for (const tier of TIER_NAMES) {
  const blocklistFilename = getTierBlocklistFilename(tier);
  const prefix = getTierListPrefix(tier);

  if (!existsSync(blocklistFilename)) {
    console.log(
      `Blocklist file not found for tier "${tier}": ${blocklistFilename} - Skipping.`
    );
    continue;
  }

  console.log(`\n=== Processing tier: ${tier.toUpperCase()} ===`);
  console.log(`Blocklist file: ${blocklistFilename}`);
  console.log(`List prefix: ${prefix}`);

  // Build tier-specific allowlist = shared + per-tier
  const tierAllowlist = new Map(allowlist);
  const tierAllowlistFilename = getTierAllowlistFilename(tier);
  if (existsSync(tierAllowlistFilename)) {
    console.log(`Loading per-tier allowlist: ${tierAllowlistFilename}`);
    await readFile(resolve(`./${tierAllowlistFilename}`), (line) => {
      const _line = line.trim();
      if (!_line) return;
      if (isComment(_line)) return;
      const domain = memoizedNormalizeDomain(_line, true);
      if (!isValidDomain(domain)) return;
      tierAllowlist.set(domain, 1);
    });
    console.log(`Tier "${tier}" allowlist: ${tierAllowlist.size} domains (shared: ${allowlist.size}, tier-specific: ${tierAllowlist.size - allowlist.size})`);
  }

  const blocklist = new Map();
  const domains = [];
  let processedDomainCount = 0;
  let unnecessaryDomainCount = 0;
  let duplicateDomainCount = 0;
  let allowedDomainCount = 0;
  let deduplicatedFromCoreCount = 0;

  const remainingLimit = LIST_ITEM_LIMIT - globalDomainCount;
  if (remainingLimit <= 0) {
    console.log(
      `Global domain limit reached (${LIST_ITEM_LIMIT}). Skipping tier "${tier}".`
    );
    continue;
  }

  await readFile(resolve(`./${blocklistFilename}`), (line, rl) => {
    if (domains.length >= remainingLimit) {
      return;
    }

    const _line = line.trim();
    if (!_line) return;
    if (isComment(_line)) return;

    const domain = memoizedNormalizeDomain(_line);
    if (!isValidDomain(domain)) return;

    processedDomainCount++;

    if (tierAllowlist.has(domain)) {
      if (DEBUG) console.log(`Found ${domain} in allowlist - Skipping`);
      allowedDomainCount++;
      return;
    }

    // For non-core tiers, skip domains already in core (they're blocked for everyone)
    if (tier !== "core" && coreDomains.has(domain)) {
      if (DEBUG)
        console.log(
          `Found ${domain} in core blocklist - Skipping (already blocked for everyone)`
        );
      deduplicatedFromCoreCount++;
      return;
    }

    if (blocklist.has(domain)) {
      if (DEBUG) console.log(`Found ${domain} in blocklist already - Skipping`);
      duplicateDomainCount++;
      return;
    }

    for (const item of extractDomain(domain).slice(1)) {
      if (tierAllowlist.has(item)) {
        if (DEBUG)
          console.log(
            `Found parent domain ${item} in allowlist - Skipping ${domain}`
          );
        allowedDomainCount++;
        return;
      }

      if (!blocklist.has(item)) continue;

      if (DEBUG)
        console.log(`Found ${item} in blocklist already - Skipping ${domain}`);
      unnecessaryDomainCount++;
      return;
    }

    blocklist.set(domain, 1);
    domains.push(domain);

    if (domains.length >= remainingLimit) {
      console.log(
        `Maximum number of blocked domains reached for tier "${tier}" - Stopping...`
      );
      rl.close();
    }
  });

  // If this is core, save domains for deduplication against other tiers
  if (tier === "core") {
    domains.forEach((d) => coreDomains.add(d));
  }

  globalDomainCount += domains.length;
  const numberOfLists = Math.ceil(domains.length / LIST_ITEM_SIZE);

  console.log(`\nTier "${tier}" statistics:`);
  console.log(`  Processed domains: ${processedDomainCount}`);
  console.log(`  Duplicate domains: ${duplicateDomainCount}`);
  console.log(`  Unnecessary domains: ${unnecessaryDomainCount}`);
  console.log(`  Allowed domains: ${allowedDomainCount}`);
  if (tier !== "core") {
    console.log(`  Deduplicated from core: ${deduplicatedFromCoreCount}`);
  }
  console.log(`  Blocked domains: ${domains.length}`);
  console.log(`  Lists to create/sync: ${numberOfLists}`);

  tierResults[tier] = { domains, prefix, numberOfLists };
}

console.log(`\n=== Total domains across all tiers: ${globalDomainCount} ===\n`);

(async () => {
  if (DRY_RUN) {
    console.log(
      "Dry run complete - no lists were created. Remove DRY_RUN env var to proceed."
    );
    return;
  }

  for (const [tier, { domains, prefix, numberOfLists }] of Object.entries(
    tierResults
  )) {
    if (domains.length === 0) {
      console.log(`No domains for tier "${tier}" - Skipping list creation.`);
      continue;
    }

    console.log(
      `\nSyncing ${numberOfLists} lists for tier "${tier}" (${domains.length} domains, prefix: "${prefix}")...`
    );
    await synchronizeZeroTrustLists(domains, prefix);
  }

  const summary = Object.entries(tierResults)
    .map(
      ([tier, { domains, numberOfLists }]) =>
        `${tier}: ${domains.length} domains / ${numberOfLists} lists`
    )
    .join("; ");

  await notifyWebhook(`CF List Create finished (${summary})`);
})();
