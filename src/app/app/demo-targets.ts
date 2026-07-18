import type { GuidedDemoTarget } from "@/app/app/guided-demo-callout";

type DemoTargetItem = {
  id: string;
  item_key: string;
  title: string;
};

const discoveryMatchers = [
  /regional climate action summit/i,
  /venue contract|venue availability/i,
  /media advisory/i,
  /keynote speakers/i,
  /print venue signage/i,
  /volunteer shifts/i,
  /operational readiness review/i,
  /runbook/i,
] as const;

/**
 * Finds demo entry points in the records returned by the server. The matchers
 * describe presentation priorities only; returned labels and identifiers always
 * come from canonical project state.
 */
export function buildGuidedDemoTargets(
  items: readonly DemoTargetItem[],
): GuidedDemoTarget[] {
  const matches = discoveryMatchers.flatMap((matcher) => {
    const item = items.find((candidate) => matcher.test(candidate.title));
    return item ? [item] : [];
  });

  return [...new Map(matches.map((item) => [item.id, item])).values()].map(
    (item) => ({
      itemId: item.id,
      itemKey: item.item_key,
      title: item.title,
      href: `/app/items/${item.id}`,
    }),
  );
}
