"use client";

export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-20 text-center" id="main-content">
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.15em] text-caution">
        Workspace error
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] text-ink">
        The project preview could not be loaded.
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted">
        Check the server configuration and try again. Internal database and authorization details are not shown here.
      </p>
      <button className="mt-8 min-h-11 bg-ink px-5 text-sm font-semibold text-white" onClick={reset} type="button">
        Try again
      </button>
    </main>
  );
}
