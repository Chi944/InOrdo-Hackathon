import type { AuthorizedProjectScope } from "@/lib/auth/guards";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/auth/membership";
import type { Tables } from "@/types/database";
import type {
  CreateDependencyInput,
  CreateProjectItemInput,
  ListProjectItemsFilters,
  UpdateProjectItemInput,
} from "@/features/project-records/schemas";

export type ProjectItemPatch = Omit<
  UpdateProjectItemInput,
  "projectId" | "itemId" | "expectedVersion"
>;

export type ProjectItemPage = {
  items: Tables<"project_items">[];
  total: number;
  nextCursor: string | null;
};

export type ProjectRecordAuthorization = {
  userId: string;
  scope: AuthorizedProjectScope;
};

export type ProjectRecordAuthorizer = (
  client: ServerSupabaseClient,
  projectId: string,
  allowedRoles: readonly WorkspaceRole[],
) => Promise<ProjectRecordAuthorization>;

export interface ProjectRecordStore {
  createItem(
    scope: AuthorizedProjectScope,
    userId: string,
    input: CreateProjectItemInput,
  ): Promise<Tables<"project_items">>;
  getItem(
    scope: AuthorizedProjectScope,
    itemId: string,
  ): Promise<Tables<"project_items"> | null>;
  updateItem(
    scope: AuthorizedProjectScope,
    itemId: string,
    expectedVersion: number,
    patch: ProjectItemPatch,
  ): Promise<Tables<"project_items"> | null>;
  listItems(
    scope: AuthorizedProjectScope,
    filters: ListProjectItemsFilters,
  ): Promise<ProjectItemPage>;
  hasWorkspaceMember(
    scope: AuthorizedProjectScope,
    userId: string,
  ): Promise<boolean>;
  getProjectItemIds(
    scope: AuthorizedProjectScope,
    itemIds: readonly string[],
  ): Promise<string[]>;
  createDependency(
    scope: AuthorizedProjectScope,
    userId: string,
    input: CreateDependencyInput,
  ): Promise<Tables<"item_dependencies">>;
  removeDependency(
    scope: AuthorizedProjectScope,
    dependencyId: string,
  ): Promise<Tables<"item_dependencies"> | null>;
  listDependencies(
    scope: AuthorizedProjectScope,
  ): Promise<Tables<"item_dependencies">[]>;
}
