import { buildGuidedDemoTargets } from "@/app/app/demo-targets";
import { GuidedDemoCallout } from "@/app/app/guided-demo-callout";
import { ProjectItemsView } from "@/app/app/items/project-items-view";
import { loadProjectViewData } from "@/app/app/project-view-data";

export default async function ProjectItemsPage() {
  const { items, memberOptions, overview, role } = await loadProjectViewData();

  return (
    <main
      className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-8 sm:py-10 lg:px-12"
      id="main-content"
      tabIndex={-1}
    >
      <header className="mb-6 border-b border-rule pb-6">
        <p className="font-mono text-[0.63rem] uppercase tracking-[0.13em] text-signal">
          Project management
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-4xl">
          Project items
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Review and manage the canonical tasks, milestones, decisions, events,
          risks, and artifacts returned by the project server.
        </p>
      </header>
      <div className="mb-5">
        <GuidedDemoCallout
          seedNote="The current canonical seed has no sponsor record or sponsor relationship, so this interface does not fabricate one."
          targets={buildGuidedDemoTargets(items)}
        />
      </div>
      <ProjectItemsView
        canEdit={role !== "viewer"}
        items={items.map((item) => ({
          id: item.id,
          itemKey: item.item_key,
          itemType: item.item_type,
          title: item.title,
          description: item.description,
          status: item.status,
          priority: item.priority,
          assignee:
            item.owner_id && item.owner?.display_name
              ? { id: item.owner_id, displayName: item.owner.display_name }
              : null,
          startDate: item.start_date,
          dueDate: item.due_date,
          eventDate: item.event_date,
        }))}
        memberOptions={memberOptions.map((member) => ({
          id: member.id,
          displayName: member.name,
        }))}
        projectId={overview.project.id}
        workflowGeneration={overview.project.workflow_generation}
      />
    </main>
  );
}
