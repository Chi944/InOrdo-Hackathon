const maximumRecordedModelLength = 120;
const safeRecordedModelPattern = /^[A-Za-z0-9][A-Za-z0-9._:/+-]*$/;
const knownProviderLabels = new Map<string, string>([
  ["gpt-5.6-luna", "OpenAI · GPT-5.6"],
  ["gpt-5.6-luna-2026-07-01", "OpenAI · GPT-5.6"],
  ["openai/gpt-oss-20b", "Vercel AI Gateway · GPT-OSS 20B"],
]);
const reservedKnownFamilyPrefixes = [
  "gpt-5.6-luna",
  "openai/gpt-oss-20b",
] as const;

export function analysisProviderLabel(modelName: string): string {
  const knownLabel = knownProviderLabels.get(modelName);
  if (knownLabel) {
    return knownLabel;
  }
  const normalizedModelName = modelName.toLowerCase();
  if (
    reservedKnownFamilyPrefixes.some((prefix) =>
      normalizedModelName.startsWith(prefix),
    )
  ) {
    return "Recorded model";
  }
  if (
    modelName.length > 0 &&
    modelName.length <= maximumRecordedModelLength &&
    safeRecordedModelPattern.test(modelName)
  ) {
    return `Recorded model · ${modelName}`;
  }
  return "Recorded model";
}
