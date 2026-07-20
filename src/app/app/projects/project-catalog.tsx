import { ArrowRight } from "lucide-react";
import Link from "next/link";

type ProjectCatalogProps = {
  demoProject: {
    name: string;
    description: string | null;
    itemCount: number;
  };
};

export function ProjectCatalog({ demoProject }: ProjectCatalogProps) {
  return (
    <section aria-labelledby="available-projects-heading">
      <div className="mb-4">
        <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
          Workspace availability
        </p>
        <h2
          className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-ink"
          id="available-projects-heading"
        >
          Available project views
        </h2>
      </div>

      <div className="grid border-l border-t border-rule lg:grid-cols-2">
        <Link
          aria-label="Open synthetic project"
          className="group min-w-0 border-b border-r border-rule bg-white p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          href="/app"
        >
          <span className="font-mono text-[0.63rem] uppercase tracking-[0.12em] text-signal">
            Synthetic workspace · Available
          </span>
          <span className="mt-5 flex items-start justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-xl font-semibold tracking-[-0.035em] text-ink">
                {demoProject.name}
              </span>
              <span className="mt-2 block text-sm leading-6 text-muted">
                {demoProject.description ??
                  "A synthetic planning workspace for the Build Week demonstration."}
              </span>
              <span className="mt-4 block text-sm font-semibold text-ink">
                {demoProject.itemCount} canonical records
              </span>
            </span>
            <ArrowRight
              aria-hidden="true"
              className="mt-1 size-4 shrink-0 text-signal transition group-hover:translate-x-0.5"
            />
          </span>
        </Link>

        <Link
          aria-label="Open ordinary project preview"
          className="group min-w-0 border-b border-r border-rule bg-white p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          href="/app/projects/ordinary"
        >
          <span className="font-mono text-[0.63rem] uppercase tracking-[0.12em] text-muted">
            Ordinary workspace · Informational preview
          </span>
          <span className="mt-5 flex items-start justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-xl font-semibold tracking-[-0.035em] text-ink">
                Team project
              </span>
              <span className="mt-2 block text-sm leading-6 text-muted">
                Project creation, invitations, and switching are not available
                in this Build Week demo.
              </span>
            </span>
            <ArrowRight
              aria-hidden="true"
              className="mt-1 size-4 shrink-0 text-signal transition group-hover:translate-x-0.5"
            />
          </span>
        </Link>
      </div>
    </section>
  );
}
