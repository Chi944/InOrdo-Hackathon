export default function WorkspaceLoading() {
  return (
    <main
      className="mx-auto w-full max-w-[90rem] px-5 py-10 sm:px-8 lg:px-12"
      id="main-content"
      tabIndex={-1}
    >
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.15em] text-signal">
        Loading authenticated workspace
      </p>
      <div className="mt-5 h-16 max-w-3xl animate-pulse bg-rule/50" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div className="h-32 animate-pulse border border-rule bg-white" key={item} />
        ))}
      </div>
    </main>
  );
}
