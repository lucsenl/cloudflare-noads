import { getZeroTrustLists, upsertZeroTrustDNSRule, upsertZeroTrustSNIRule } from "./lib/api.js";
import {
  BLOCK_BASED_ON_SNI,
  TIERS,
  TIER_NAMES,
  getTierListPrefix,
  getTierRuleName,
} from "./lib/constants.js";
import { notifyWebhook } from "./lib/utils.js";

const { result: lists } = await getZeroTrustLists();

for (const tier of TIER_NAMES) {
  const tierConfig = TIERS[tier];
  const prefix = getTierListPrefix(tier);
  const ruleName = getTierRuleName(tier);
  const locationIds = tierConfig.location_ids || [];

  console.log(`\n=== Creating rules for tier: ${tier.toUpperCase()} ===`);

  // Upsert DNS rule (with location filter for non-core tiers)
  await upsertZeroTrustDNSRule(lists, ruleName, prefix, locationIds);

  // Optionally create a rule that matches the SNI.
  if (BLOCK_BASED_ON_SNI) {
    await upsertZeroTrustSNIRule(
      lists,
      `${ruleName} - SNI`,
      prefix,
      locationIds
    );
  }
}

// Send a notification to the webhook
await notifyWebhook("CF Gateway Rule Create script finished running");
