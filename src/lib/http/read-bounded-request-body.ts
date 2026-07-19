export type BoundedRequestBodyResult =
  | { ok: true; text: string }
  | { ok: false; reason: "invalid_body" | "payload_too_large" };

async function cancelQuietly(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // The original body error or size result is the only safe route response.
  }
}

function declaredBodyIsTooLarge(
  value: string | null,
  maximumBytes: number,
): boolean {
  if (value === null) return false;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return false;
  return BigInt(normalized) > BigInt(maximumBytes);
}

export async function readBoundedRequestBody(
  request: Request,
  maximumBytes: number,
): Promise<BoundedRequestBodyResult> {
  if (declaredBodyIsTooLarge(request.headers.get("content-length"), maximumBytes)) {
    return { ok: false, reason: "payload_too_large" };
  }

  if (request.body === null) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const textParts: string[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;

      receivedBytes += chunk.value.byteLength;
      if (receivedBytes > maximumBytes) {
        await cancelQuietly(reader);
        return { ok: false, reason: "payload_too_large" };
      }
      textParts.push(decoder.decode(chunk.value, { stream: true }));
    }
    textParts.push(decoder.decode());
    return { ok: true, text: textParts.join("") };
  } catch {
    await cancelQuietly(reader);
    return { ok: false, reason: "invalid_body" };
  } finally {
    reader.releaseLock();
  }
}
