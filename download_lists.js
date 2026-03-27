import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";

import {
  PROCESSING_FILENAME,
  USER_DEFINED_ALLOWLIST_URLS,
  TIERS,
  TIER_NAMES,
  getTierBlocklistFilename,
  getTierAllowlistFilename,
} from "./lib/constants.js";
import { downloadFiles } from "./lib/utils.js";

const allowlistUrls = USER_DEFINED_ALLOWLIST_URLS;

const downloadList = async (filename, urls) => {
  const filePath = resolve(`./${filename}`);

  if (existsSync(filePath)) {
    await unlink(filePath);
  }

  if (!urls || urls.length === 0) {
    console.log(`No URLs configured for ${filename}, skipping.`);
    return;
  }

  try {
    await downloadFiles(filePath, urls);

    console.log(
      `Done. The ${filename} file contains merged data from the following list(s):`
    );
    console.log(
      urls.reduce(
        (previous, current, index) => previous + `${index + 1}. ${current}\n`,
        ""
      )
    );
  } catch (err) {
    console.error(`An error occurred while processing ${filename}:\n`, err);
    console.error("URLs:\n", urls);
    throw err;
  }
};

// Download shared allowlist
console.log("Downloading shared allowlist...");
await downloadList(PROCESSING_FILENAME.ALLOWLIST, allowlistUrls);

// Download blocklists and allowlists per tier
for (const tier of TIER_NAMES) {
  const tierConfig = TIERS[tier];

  // Blocklist
  const blockFilename = getTierBlocklistFilename(tier);
  if (tierConfig.blocklist_urls && tierConfig.blocklist_urls.length > 0) {
    console.log(`\nDownloading blocklist for tier "${tier}"...`);
    await downloadList(blockFilename, tierConfig.blocklist_urls);
  } else {
    console.log(`\nNo blocklist URLs for tier "${tier}", skipping.`);
  }

  // Per-tier allowlist
  const allowFilename = getTierAllowlistFilename(tier);
  if (tierConfig.allowlist_urls && tierConfig.allowlist_urls.length > 0) {
    console.log(`Downloading allowlist for tier "${tier}"...`);
    await downloadList(allowFilename, tierConfig.allowlist_urls);
  }
}
