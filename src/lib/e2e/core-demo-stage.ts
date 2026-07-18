export const coreDemoStageCookieName = "inordo-core-demo-stage";

export const coreDemoStages = [
  "baseline",
  "analyzed",
  "applied",
  "undone",
] as const;

export type CoreDemoStage = (typeof coreDemoStages)[number];

export function parseCoreDemoStage(
  value: string | null | undefined,
): CoreDemoStage {
  return coreDemoStages.find((stage) => stage === value) ?? "baseline";
}
