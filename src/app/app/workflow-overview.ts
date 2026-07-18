type WorkflowOverviewInput = {
  analysisLoadFailed: boolean;
  operationsLoadFailed: boolean;
  impactCount: number;
  hasProposal: boolean;
  operationCount: number;
};

export function buildWorkflowOverview({
  analysisLoadFailed,
  operationsLoadFailed,
  impactCount,
  hasProposal,
  operationCount,
}: WorkflowOverviewInput) {
  const reviewRecordCount = impactCount + (hasProposal ? 1 : 0);

  return {
    analysisUnavailable: analysisLoadFailed,
    operationsUnavailable: operationsLoadFailed,
    impactDetail: analysisLoadFailed
      ? "Impact data unavailable"
      : `${impactCount} affected records`,
    historyDetail: operationsLoadFailed
      ? "Operation history unavailable"
      : `${operationCount} recorded operations`,
    reviewRecordCountLabel: analysisLoadFailed
      ? "Unavailable"
      : String(reviewRecordCount),
    reviewMessage: analysisLoadFailed
      ? "Impact analysis and proposal records could not be loaded. Refresh before making review decisions."
      : reviewRecordCount === 0
        ? "No impact analysis or recovery proposal exists in the reset baseline."
        : "Reviewable impact and proposal records are available in the current workflow generation.",
    operationCountLabel: operationsLoadFailed
      ? "Unavailable"
      : String(operationCount),
    operationMessage: operationsLoadFailed
      ? "Operation history could not be loaded. Refresh before relying on audit status."
      : operationCount === 0
        ? "No applied operation exists in the reset baseline."
        : "Applied and reversed operations are recorded in the current workflow generation.",
  } as const;
}
