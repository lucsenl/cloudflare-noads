import {
  deleteZeroTrustListsOneByOne,
  getZeroTrustLists,
} from "./lib/api.js";
import { DELETION_ENABLED, TIER_NAMES, getTierListPrefix } from "./lib/constants.js";
import { notifyWebhook } from "./lib/utils.js";

if (!DELETION_ENABLED) {
  console.warn(
    "The list deletion step is no longer needed to update filter lists, safely skipping. To proceed with deletion to e.g. stop using CGPS, set the environment variable CGPS_DELETION_ENABLED=true and re-run the script. Exiting."
  );
  process.exit(0);
}

(async () => {
  const { result: lists } = await getZeroTrustLists();

  if (!lists) {
    console.warn(
      "No file lists found - this is not an issue if it's your first time running this script. Exiting."
    );
    return;
  }

  // Match lists from all tiers + legacy "CGPS List" prefix
  const prefixes = [
    ...TIER_NAMES.map(getTierListPrefix),
    "CGPS List", // legacy prefix for backward compatibility
  ];

  const cgpsLists = lists.filter(({ name }) =>
    prefixes.some((prefix) => name.startsWith(prefix))
  );

  if (!cgpsLists.length) {
    console.warn(
      "No lists with matching name found - this is not an issue if you haven't created any filter lists before. Exiting."
    );
    return;
  }

  console.log(
    `Got ${lists.length} lists, ${cgpsLists.length} of which are CGPS lists that will be deleted.`
  );

  console.log(`Deleting ${cgpsLists.length} lists...`);

  await deleteZeroTrustListsOneByOne(cgpsLists);
  await notifyWebhook(`CF List Delete script finished running (${cgpsLists.length} lists)`);
})();
