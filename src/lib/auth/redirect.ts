const LOCAL_ORIGIN = "https://inordo.local";

export function getSafeRedirect(
  candidate: string | null | undefined,
  fallback = "/app",
): string {
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, LOCAL_ORIGIN);
    const isAppPath =
      parsed.pathname === "/app" || parsed.pathname.startsWith("/app/");

    if (parsed.origin !== LOCAL_ORIGIN || !isAppPath) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
