import { DependencyView } from "@/app/app/dependencies/dependency-view";
import { loadProjectViewData } from "@/app/app/project-view-data";

export default async function ProjectDependenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string | string[] }>;
}) {
  const { dependencies, items, overview, role } = await loadProjectViewData();
  const params = await searchParams;
  const requestedItemId = Array.isArray(params.item) ? params.item[0] : params.item;
  const initialSelectedItemId = items.some((item) => item.id === requestedItemId)
    ? requestedItemId
    : undefined;

  return (
    <main
      className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-8 sm:py-10 lg:px-12"
      id="main-content"
    >
      <DependencyView
        canEdit={role !== "viewer"}
        dependencies={dependencies.map((dependency) => ({
          id: dependency.id,
          fromItemId: dependency.from_item_id,
          toItemId: dependency.to_item_id,
          relationship: dependency.relationship,
          rationale: dependency.rationale,
        }))}
        initialSelectedItemId={initialSelectedItemId}
        items={items.map((item) => ({
          id: item.id,
          itemKey: item.item_key,
          title: item.title,
          itemType: item.item_type,
          status: item.status,
        }))}
        projectId={overview.project.id}
      />
    </main>
  );
}
