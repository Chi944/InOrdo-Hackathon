export function createOperationIdempotencyKey(scope: string) {
  const nonce =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `inordo-ui:${scope}:${nonce}`;
}

export function shouldRotateOperationIdempotencyKey(status: number) {
  return status >= 400 && status < 500;
}
