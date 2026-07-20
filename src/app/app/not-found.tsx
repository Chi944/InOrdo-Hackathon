import Link from "next/link";

export default function WorkspaceNotFound() {
  return (
    <main
      className="mx-auto w-full max-w-3xl px-5 py-20 text-center"
      id="main-content"
      tabIndex={-1}
    >
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.15em] text-signal">
        Workspace unavailable
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] text-ink">
        The demo project could not be found.
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted">
        The project may not be configured, or this account may not belong to its workspace. No tenant details are disclosed.
      </p>
      <Link className="mt-8 inline-flex min-h-11 items-center bg-ink px-5 text-sm font-semibold text-white" href="/">
        Return home
      </Link>
    </main>
  );
}
