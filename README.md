# Cloudflare Gateway Pi-hole Scripts (CGPS)

![Cloudflare Gateway Analytics screenshot showing a thousand blocked DNS requests](.github/images/gateway_analytics.png)

Cloudflare Gateway allows you to create custom rules to filter HTTP, DNS, and network traffic based on your firewall policies. This is a collection of scripts that can be used to get a similar experience as if you were using Pi-hole, but with Cloudflare Gateway - so no servers to maintain or need to buy a Raspberry Pi!

## Tier System

CGPS uses a **tier hierarchy** with three fixed tiers — **Core**, **Lite** and **Pro** — that lets you apply different blocklists/allowlists to different Cloudflare Gateway DNS locations.

| Tier | Scope | Location filter |
|------|-------|-----------------|
| **Core** | Applies to **all** locations (no location filter) | — |
| **Lite** | Applies only to the locations you specify | `dns.location in {"uuid1" "uuid2"}` |
| **Pro** | Applies only to the locations you specify | `dns.location in {"uuid1" "uuid2"}` |

### How it works

1. **Download** — `download_lists.js` fetches the blocklist and allowlist URLs configured for each tier.
2. **Create lists** — `cf_list_create.js` processes domains per tier, deduplicates, and uploads them to Cloudflare Gateway as Zero Trust lists.
3. **Create rules** — `cf_gateway_rule_create.js` creates a DNS gateway rule for each tier. Core has no location filter (applies everywhere); Lite and Pro rules use `dns.location in {…}` to target specific locations.

### Deduplication

Domains present in the **Core** tier are automatically removed from Lite and Pro lists. This avoids wasting the 300k domain limit with duplicates across tiers.

## Environment Variables

All configuration is done via environment variables (`.env` for local, GitHub Actions secrets/variables for CI).

### Required

| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token with Zero Trust read and edit permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

### Tier configuration

Each tier reads three environment variables. URLs and IDs are **separated by newlines**.

| Variable | Description |
|----------|-------------|
| `CORE_BLOCKLIST_URLS` | Blocklist URLs for the Core tier |
| `CORE_ALLOWLIST_URLS` | Allowlist URLs for the Core tier (optional) |
| `CORE_LOCATION_IDS` | Location IDs for Core (optional — if empty, rule applies to all locations) |
| `LITE_BLOCKLIST_URLS` | Blocklist URLs for the Lite tier |
| `LITE_ALLOWLIST_URLS` | Allowlist URLs for the Lite tier (optional) |
| `LITE_LOCATION_IDS` | Location IDs for the Lite tier |
| `PRO_BLOCKLIST_URLS` | Blocklist URLs for the Pro tier |
| `PRO_ALLOWLIST_URLS` | Allowlist URLs for the Pro tier (optional) |
| `PRO_LOCATION_IDS` | Location IDs for the Pro tier |

### Shared allowlist

| Variable | Description |
|----------|-------------|
| `ALLOWLIST_URLS` | Shared allowlist URLs applied to **all** tiers. Per-tier allowlists are additive on top of this. |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `CLOUDFLARE_LIST_ITEM_LIMIT` | Max domains allowed across all tiers (free plan = 300 000) | `300000` |
| `BLOCK_PAGE_ENABLED` | Show a block page when a domain is blocked (`1` to enable) | `0` |
| `BLOCK_BASED_ON_SNI` | Enable experimental SNI-based filtering (`1` to enable) | `0` |
| `DRY_RUN` | Simulate changes without modifying Cloudflare (`1` to enable) | `0` |
| `DISCORD_WEBHOOK_URL` | Discord webhook URL for notifications | — |
| `PING_URL` | HTTP(S) URL to ping after a successful run | — |
| `DEBUG` | Enable debug logging (`1` to enable) | `0` |

### Example `.env`

```env
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id

ALLOWLIST_URLS=https://example.com/shared-allowlist.txt

CORE_BLOCKLIST_URLS=https://big.oisd.nl/domainswild2
https://adaway.org/hosts.txt
CORE_ALLOWLIST_URLS=https://example.com/core-allowlist.txt

LITE_BLOCKLIST_URLS=https://example.com/lite-blocklist.txt
LITE_LOCATION_IDS=605d364dadee4b09a80fc294f038bcbf
11c9874cbfbc468ead01b4297a74da8a

PRO_BLOCKLIST_URLS=https://example.com/pro-blocklist.txt
PRO_LOCATION_IDS=005c1b21f5b04c27aceab2146db90743
318b5ce939f7441ebab6156abb4a914c
```

## Scripts

| Script | Description |
|--------|-------------|
| `download_lists.js` | Downloads blocklists and allowlists for all tiers |
| `cf_list_create.js` | Processes domains per tier and syncs Zero Trust lists to Cloudflare |
| `cf_gateway_rule_create.js` | Creates DNS gateway rules per tier with location filtering |
| `cf_list_delete.js` | Deletes all CGPS lists from Cloudflare Gateway |
| `cf_gateway_rule_delete.js` | Deletes all CGPS gateway rules |
| `cf_defragment.js` | Defragments lists per tier (compacts sparse lists) |

### npm commands

```bash
npm start              # Download lists + create lists + create rules (full run)
npm run download       # Download blocklists and allowlists only
npm run cloudflare-create       # Create lists + rules
npm run cloudflare-create:list  # Create lists only
npm run cloudflare-create:rule  # Create rules only
npm run cloudflare-delete       # Delete rules + lists
npm run cloudflare-delete:list  # Delete lists only
npm run cloudflare-delete:rule  # Delete rules only
npm run cloudflare-defragment   # Defragment lists
npm run dry            # Dry run (download + simulate list creation)
```

## Usage

### Prerequisites

1. Node.js 24+ installed on your machine
2. A Cloudflare [Zero Trust](https://one.dash.cloudflare.com/) account (the free plan is enough)
3. A Cloudflare API **Token** with Zero Trust read and edit permissions, and your account ID
4. One or more DNS locations configured in Zero Trust (Networks → DNS locations) — collect their UUIDs for the tier configuration

### Running locally

1. Clone this repository.
2. Run `npm install` to install dependencies.
3. Copy `.env.example` to `.env` and fill in the variables (see [Environment Variables](#environment-variables)).
4. Run `npm start` to download lists, create Cloudflare Gateway lists, and create rules — all in one step.

To update your filters later, just run `npm start` again.

### Running in GitHub Actions

The workflow at `.github/workflows/update-filters.yml` automates everything. It runs weekly (Monday 3 AM UTC), on push to `main`, or via manual dispatch.

1. Create a **private** repository and copy the project files.
2. Add the following **secrets** in your repository settings (Settings → Secrets and variables → Actions):

   | Secret | Required |
   |--------|----------|
   | `CLOUDFLARE_API_TOKEN` | Yes |
   | `CLOUDFLARE_ACCOUNT_ID` | Yes |
   | `CLOUDFLARE_LIST_ITEM_LIMIT` | No (defaults to 300 000) |
   | `DISCORD_WEBHOOK_URL` | No |
   | `PING_URL` | No |

3. Add the following **variables** (Settings → Secrets and variables → Actions → Variables tab):

   | Variable | Description |
   |----------|-------------|
   | `ALLOWLIST_URLS` | Shared allowlist URLs (one per line) |
   | `CORE_BLOCKLIST_URLS` | Core tier blocklist URLs (one per line) |
   | `CORE_ALLOWLIST_URLS` | Core tier allowlist URLs (one per line) |
   | `CORE_LOCATION_IDS` | Core location IDs (one per line, optional) |
   | `LITE_BLOCKLIST_URLS` | Lite tier blocklist URLs (one per line) |
   | `LITE_ALLOWLIST_URLS` | Lite tier allowlist URLs (one per line) |
   | `LITE_LOCATION_IDS` | Lite tier location IDs (one per line) |
   | `PRO_BLOCKLIST_URLS` | Pro tier blocklist URLs (one per line) |
   | `PRO_ALLOWLIST_URLS` | Pro tier allowlist URLs (one per line) |
   | `PRO_LOCATION_IDS` | Pro tier location IDs (one per line) |
   | `BLOCK_PAGE_ENABLED` | Set to `1` to enable block page |

4. Enable GitHub Actions in the repository and trigger the workflow manually to test.

### DNS setup for Cloudflare Gateway

1. Go to your Cloudflare Zero Trust dashboard → Networks → DNS locations.
2. Create locations (or use existing ones) and note their **UUIDs** — these are the IDs you will use in `LITE_LOCATION_IDS` / `PRO_LOCATION_IDS`.
3. Configure your router or device to use the DNS addresses provided for each location.

Alternatively, install the Cloudflare WARP client and log in to Zero Trust.

### Dry runs

Set `DRY_RUN=1` in your `.env` to simulate list creation without modifying anything in Cloudflare.

```bash
npm run dry
```

## License

MIT License. See `LICENSE` for more information.
