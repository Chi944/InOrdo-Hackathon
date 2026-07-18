import "server-only";

import type {
  ProjectItemPatch,
  ProjectRecordStore,
} from "@/features/project-records/contracts";
import { mapProjectRecordDatabaseError } from "@/features/project-records/errors";
import type { CreateProjectItemInput } from "@/features/project-records/schemas";
import type { AuthorizedProjectScope } from "@/lib/auth/guards";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { TablesInsert, TablesUpdate } from "@/types/database";

export const projectRecordItemSelector =
  "id,workspace_id,project_id,item_key,item_type,title,description,status,priority,owner_id,start_date,due_date,event_date,metadata,version,is_demo_retired,created_by,created_at,updated_at" as const;

export const dependencyRecordSelector =
  "id,workspace_id,project_id,from_item_id,to_item_id,relationship,rationale,created_by,created_at" as const;

function itemInsert(
  scope: AuthorizedProjectScope,
  userId: string,
  input: CreateProjectItemInput,
): TablesInsert<"project_items"> {
  return {
    workspace_id: scope.workspaceId,
    project_id: scope.projectId,
    item_key: input.itemKey,
    item_type: input.itemType,
    title: input.title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    owner_id: input.ownerId,
    start_date: input.startDate,
    due_date: input.dueDate,
    event_date: input.eventDate,
    created_by: userId,
  };
}

function itemUpdate(patch: ProjectItemPatch): TablesUpdate<"project_items"> {
  const update: TablesUpdate<"project_items"> = {};

  if (patch.itemKey !== undefined) update.item_key = patch.itemKey;
  if (patch.itemType !== undefined) update.item_type = patch.itemType;
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.ownerId !== undefined) update.owner_id = patch.ownerId;
  if (patch.startDate !== undefined) update.start_date = patch.startDate;
  if (patch.dueDate !== undefined) update.due_date = patch.dueDate;
  if (patch.eventDate !== undefined) update.event_date = patch.eventDate;

  return update;
}

function escapeLike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export function createSupabaseProjectRecordStore(
  client: ServerSupabaseClient,
): ProjectRecordStore {
  return {
    async createItem(scope, userId, input) {
      const { data, error } = await client
        .from("project_items")
        .insert(itemInsert(scope, userId, input))
        .select(projectRecordItemSelector)
        .single();

      if (error) throw mapProjectRecordDatabaseError(error);
      return data;
    },

    async getItem(scope, itemId) {
      const { data, error } = await client
        .from("project_items")
        .select(projectRecordItemSelector)
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("id", itemId)
        .eq("is_demo_retired", false)
        .maybeSingle();

      if (error) throw mapProjectRecordDatabaseError(error);
      return data;
    },

    async updateItem(scope, itemId, expectedVersion, patch) {
      const { data, error } = await client
        .from("project_items")
        .update(itemUpdate(patch))
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("id", itemId)
        .eq("version", expectedVersion)
        .eq("is_demo_retired", false)
        .select(projectRecordItemSelector)
        .maybeSingle();

      if (error) throw mapProjectRecordDatabaseError(error);
      return data;
    },

    async listItems(scope, filters) {
      let query = client
        .from("project_items")
        .select(projectRecordItemSelector, { count: "exact" })
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("is_demo_retired", false);

      if (filters.status) query = query.eq("status", filters.status);
      if (filters.itemType) query = query.eq("item_type", filters.itemType);
      if (filters.priority) query = query.eq("priority", filters.priority);
      if (filters.ownerId) query = query.eq("owner_id", filters.ownerId);
      if (filters.search) {
        query = query.ilike("title", `%${escapeLike(filters.search)}%`);
      }
      if (filters.cursor) query = query.gt("item_key", filters.cursor);

      const { data, error, count } = await query
        .order("item_key")
        .order("id")
        .limit(filters.limit + 1);

      if (error) throw mapProjectRecordDatabaseError(error);

      const rows = data ?? [];
      const hasMore = rows.length > filters.limit;
      const items = rows.slice(0, filters.limit);

      return {
        items,
        total: count ?? 0,
        nextCursor: hasMore ? (items.at(-1)?.item_key ?? null) : null,
      };
    },

    async hasWorkspaceMember(scope, userId) {
      const { data, error } = await client
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", scope.workspaceId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw mapProjectRecordDatabaseError(error);
      return data !== null;
    },

    async getProjectItemIds(scope, itemIds) {
      const uniqueIds = [...new Set(itemIds)];
      const { data, error } = await client
        .from("project_items")
        .select("id")
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("is_demo_retired", false)
        .in("id", uniqueIds)
        .order("id");

      if (error) throw mapProjectRecordDatabaseError(error);
      return (data ?? []).map((item) => item.id);
    },

    async createDependency(scope, userId, input) {
      const insert: TablesInsert<"item_dependencies"> = {
        workspace_id: scope.workspaceId,
        project_id: scope.projectId,
        from_item_id: input.fromItemId,
        to_item_id: input.toItemId,
        relationship: input.relationship,
        rationale: input.rationale,
        created_by: userId,
      };
      const { data, error } = await client
        .from("item_dependencies")
        .insert(insert)
        .select(dependencyRecordSelector)
        .single();

      if (error) throw mapProjectRecordDatabaseError(error);
      return data;
    },

    async removeDependency(scope, dependencyId) {
      const { data, error } = await client
        .from("item_dependencies")
        .delete()
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("id", dependencyId)
        .select(dependencyRecordSelector)
        .maybeSingle();

      if (error) throw mapProjectRecordDatabaseError(error);
      return data;
    },

    async listDependencies(scope) {
      const { data, error } = await client
        .from("item_dependencies")
        .select(dependencyRecordSelector)
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .order("created_at")
        .order("id")
        .limit(500);

      if (error) throw mapProjectRecordDatabaseError(error);
      return data ?? [];
    },
  };
}
