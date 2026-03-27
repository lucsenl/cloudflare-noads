import dotenv from "dotenv";

dotenv.config();

if (process.env.CLOUDFLARE_API_KEY) {
  console.warn(
    "Using Global API Key is very risky for your Cloudflare account. It is strongly recommended to create an API Token with scoped permissions instead."
  );
}

export const API_KEY = process.env.CLOUDFLARE_API_KEY;

export const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

export const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

export const ACCOUNT_EMAIL = process.env.CLOUDFLARE_ACCOUNT_EMAIL;

export const LIST_ITEM_LIMIT = isNaN(process.env.CLOUDFLARE_LIST_ITEM_LIMIT)
  ? 300000
  : parseInt(process.env.CLOUDFLARE_LIST_ITEM_LIMIT, 10);

export const LIST_ITEM_SIZE = 1000;

export const API_HOST = "https://api.cloudflare.com/client/v4";

export const DRY_RUN = !!parseInt(process.env.DRY_RUN, 10);

export const DELETION_ENABLED = !!process.env.CGPS_DELETION_ENABLED;

export const BLOCK_PAGE_ENABLED = !!parseInt(process.env.BLOCK_PAGE_ENABLED, 10);

export const BLOCK_BASED_ON_SNI = !!parseInt(process.env.BLOCK_BASED_ON_SNI, 10);

export const DEBUG = !!parseInt(process.env.DEBUG, 10);

export const CLOUDFLARE_RATE_LIMITING_COOLDOWN_TIME = 2 * 60 * 1000;
export const RATE_LIMITING_HTTP_ERROR_CODE = 429;

export const PROCESSING_FILENAME = {
  ALLOWLIST: "allowlist.txt",
  BLOCKLIST: "blocklist.txt",
  OLD_ALLOWLIST: "whitelist.csv",
  OLD_BLOCKLIST: "input.csv",
};

export const LIST_TYPE = {
  ALLOWLIST: "allowlist",
  BLOCKLIST: "blocklist",
};

export const USER_DEFINED_ALLOWLIST_URLS = process.env.ALLOWLIST_URLS
  ? process.env.ALLOWLIST_URLS.split("\n").filter((x) => x)
  : [];

// Tiers configuration (fixed: core, lite, pro)
// Per tier env vars: <TIER>_BLOCKLIST_URLS, <TIER>_ALLOWLIST_URLS, <TIER>_LOCATION_IDS (newline-separated)

const parseEnvList = (value) =>
  value ? value.split("\n").map(s => s.trim()).filter(Boolean) : [];

export const TIER_NAMES = ["core", "lite", "pro"];

export const TIERS = Object.fromEntries(
  TIER_NAMES.map((tier) => {
    const upper = tier.toUpperCase();
    return [tier, {
      blocklist_urls: parseEnvList(process.env[`${upper}_BLOCKLIST_URLS`]),
      allowlist_urls: parseEnvList(process.env[`${upper}_ALLOWLIST_URLS`]),
      location_ids: parseEnvList(process.env[`${upper}_LOCATION_IDS`]),
    }];
  })
);

export const getTierBlocklistFilename = (tier) => `blocklist_${tier}.txt`;

export const getTierAllowlistFilename = (tier) => `allowlist_${tier}.txt`;

export const getTierListPrefix = (tier) =>
  `CGPS ${tier.charAt(0).toUpperCase() + tier.slice(1)}`;

export const getTierRuleName = (tier) =>
  `CGPS Filter Lists - ${tier.charAt(0).toUpperCase() + tier.slice(1)}`;
