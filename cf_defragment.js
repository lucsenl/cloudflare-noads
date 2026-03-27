import {
  defragmentZeroTrustLists,
  upsertZeroTrustDNSRule,
  upsertZeroTrustSNIRule,
  deleteZeroTrustListsOneByOne,
  getZeroTrustLists,
} from "./lib/api.js";
import {
  BLOCK_BASED_ON_SNI,
  TIERS,
  TIER_NAMES,
  getTierListPrefix,
  getTierRuleName,
} from "./lib/constants.js";
import { notifyWebhook } from "./lib/utils.js";

for (const tier of TIER_NAMES) {
  const tierConfig = TIERS[tier];
  const prefix = getTierListPrefix(tier);
  const ruleName = getTierRuleName(tier);
  const locationIds = tierConfig.location_ids || [];

  console.log(`\n=== Defragmenting tier: ${tier.toUpperCase()} ===`);

  const result = await defragmentZeroTrustLists(prefix);

  if (!result) {
    console.log(`No lists found for tier "${tier}". Skipping.`);
    continue;
  }

  const { emptyLists, nonEmptyLists, stats } = result;

  if (emptyLists.length > 0) {
    console.log(`Updating rules for tier "${tier}"...`);
    await upsertZeroTrustDNSRule(nonEmptyLists, ruleName, prefix, locationIds);

    if (BLOCK_BASED_ON_SNI) {
      await upsertZeroTrustSNIRule(
        nonEmptyLists,
        `${ruleName} - SNI`,
        prefix,
        locationIds
      );
    }

    console.log(`Deleting empty lists for tier "${tier}"...`);
    await deleteZeroTrustListsOneByOne(emptyLists);
  }

  console.log(`Defragmented ${stats.chunks} lists into ${stats.assignedLists} lists`);
  console.log(`Patches: ${stats.patches}, moved: ${stats.entriesToMove} entries`);

  if (emptyLists.length > 0) {
    console.log(`Updated rules using ${stats.nonEmptyLists} lists`);
    console.log(`Deleted ${stats.emptyLists} empty lists`);
  }
}

await notifyWebhook("CF Defragment script finished running");
