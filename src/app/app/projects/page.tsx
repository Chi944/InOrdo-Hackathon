import { loadProjectIndexView } from "@/app/app/project-view-data";
import { ProjectCatalog } from "@/app/app/projects/project-catalog";

export default async function ProjectsPage() {
  const { overview } = await loadProjectIndexView();

  return (
    <main
      className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-8 sm:py-10 lg:px-12"
      id="main-content"
      tabIndex={-1}
    >
      <header className="mb-8 border-b border-rule pb-6">
        <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
          Project directory
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-4xl">
          Projects
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Open the available synthetic workspace or review the current limits
          for ordinary team projects.
        </p>
      </header>

      <ProjectCatalog
        demoProject={{
          name: overview.project.name,
          description: overview.project.description,
          itemCount: overview.counts.items,
        }}
      />
    </main>
  );
}
