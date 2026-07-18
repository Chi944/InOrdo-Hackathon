import "server-only";

import { z, type ZodType } from "zod";

import type {
  ProjectItemPatch,
  ProjectRecordAuthorizer,
  ProjectRecordStore,
} from "@/features/project-records/contracts";
import { ProjectRecordError } from "@/features/project-records/errors";
import {
  createDependencySchema,
  createProjectItemSchema,
  deleteDependencySchema,
  listProjectItemsFilterSchema,
  updateProjectItemSchema,
} from "@/features/project-records/schemas";
import { createSupabaseProjectRecordStore } from "@/features/project-records/supabase-store";
import {
  requireCurrentUserProjectAccess,
  workspaceContributorRoles,
  workspaceReadRoles,
} from "@/lib/auth/guards";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

export type {
  ProjectRecordAuthorizer,
  ProjectRecordStore,
} from "@/features/project-records/contracts";

const projectIdSchema = z.uuid({ error: "Project ID must be a valid UUID." });

const authorizeProjectRecord: ProjectRecordAuthorizer = async (
  client,
  projectId,
  allowedRoles,
) => {
  const { user, scope } = await requireCurrentUserProjectAccess(
    client,
    projectId,
    allowedRoles,
  );
  return { userId: user.id, scope };
};

function parseInput<Result>(schema: ZodType<Result>, input: unknown): Result {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ProjectRecordError(
      "validation",
      result.error.issues[0]?.message ?? "Check the submitted project record.",
    );
  }
  return result.data;
}

function updatePatch(input: z.infer<typeof updateProjectItemSchema>) {
  const patch: ProjectItemPatch = {};
  if (input.itemKey !== undefined) patch.itemKey = input.itemKey;
  if (input.itemType !== undefined) patch.itemType = input.itemType;
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.ownerId !== undefined) patch.ownerId = input.ownerId;
  if (input.startDate !== undefined) patch.startDate = input.startDate;
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate;
  if (input.eventDate !== undefined) patch.eventDate = input.eventDate;
  return patch;
}

type CreateProjectRecordOperationsOptions = {
  client: ServerSupabaseClient;
  store?: ProjectRecordStore;
  authorize?: ProjectRecordAuthorizer;
};

export function createProjectRecordOperations({
  client,
  store = createSupabaseProjectRecordStore(client),
  authorize = authorizeProjectRecord,
}: CreateProjectRecordOperationsOptions) {
  return {
    async createItem(input: unknown) {
      const record = parseInput(createProjectItemSchema, input);
      const authorization = await authorize(
        client,
        record.projectId,
        workspaceContributorRoles,
      );

      if (
        record.ownerId &&
        !(await store.hasWorkspaceMember(authorization.scope, record.ownerId))
      ) {
        throw new ProjectRecordError(
          "invalid_reference",
          "The selected owner is not a member of this workspace.",
        );
      }

      return store.createItem(
        authorization.scope,
        authorization.userId,
        record,
      );
    },

    async updateItem(input: unknown) {
      const record = parseInput(updateProjectItemSchema, input);
      const authorization = await authorize(
        client,
        record.projectId,
        workspaceContributorRoles,
      );
      const current = await store.getItem(authorization.scope, record.itemId);

      if (!current) {
        throw new ProjectRecordError("not_found", "The project item was not found.");
      }
      if (current.version !== record.expectedVersion) {
        throw new ProjectRecordError(
          "conflict",
          "This item changed since you loaded it. Refresh and try again.",
        );
      }

      const patch = updatePatch(record);
      const nextItemType = patch.itemType ?? current.item_type;
      const nextStartDate =
        patch.startDate !== undefined ? patch.startDate : current.start_date;
      const nextDueDate =
        patch.dueDate !== undefined ? patch.dueDate : current.due_date;
      const nextEventDate =
        patch.eventDate !== undefined ? patch.eventDate : current.event_date;

      if (nextStartDate && nextDueDate && nextStartDate > nextDueDate) {
        throw new ProjectRecordError(
          "validation",
          "Start date must be on or before due date.",
        );
      }
      if (nextItemType !== "event" && nextEventDate) {
        throw new ProjectRecordError(
          "validation",
          "Event date is only allowed for event items.",
        );
      }
      if (
        typeof patch.ownerId === "string" &&
        !(await store.hasWorkspaceMember(authorization.scope, patch.ownerId))
      ) {
        throw new ProjectRecordError(
          "invalid_reference",
          "The selected owner is not a member of this workspace.",
        );
      }

      const updated = await store.updateItem(
        authorization.scope,
        record.itemId,
        record.expectedVersion,
        patch,
      );
      if (!updated) {
        throw new ProjectRecordError(
          "conflict",
          "This item changed since you loaded it. Refresh and try again.",
        );
      }
      return updated;
    },

    async listItems(projectId: unknown, input: unknown = {}) {
      const parsedProjectId = parseInput(projectIdSchema, projectId);
      const filters = parseInput(listProjectItemsFilterSchema, input);
      const authorization = await authorize(
        client,
        parsedProjectId,
        workspaceReadRoles,
      );
      return store.listItems(authorization.scope, filters);
    },

    async createDependency(input: unknown) {
      const dependency = parseInput(createDependencySchema, input);
      const authorization = await authorize(
        client,
        dependency.projectId,
        workspaceContributorRoles,
      );
      const endpointIds = await store.getProjectItemIds(authorization.scope, [
        dependency.fromItemId,
        dependency.toItemId,
      ]);
      if (new Set(endpointIds).size !== 2) {
        throw new ProjectRecordError(
          "invalid_reference",
          "Both dependency items must belong to this project.",
        );
      }
      return store.createDependency(
        authorization.scope,
        authorization.userId,
        dependency,
      );
    },

    async removeDependency(input: unknown) {
      const dependency = parseInput(deleteDependencySchema, input);
      const authorization = await authorize(
        client,
        dependency.projectId,
        workspaceContributorRoles,
      );
      const removed = await store.removeDependency(
        authorization.scope,
        dependency.dependencyId,
      );
      if (!removed) {
        throw new ProjectRecordError(
          "not_found",
          "The dependency was not found in this project.",
        );
      }
      return removed;
    },

    async listDependencies(projectId: unknown) {
      const parsedProjectId = parseInput(projectIdSchema, projectId);
      const authorization = await authorize(
        client,
        parsedProjectId,
        workspaceReadRoles,
      );
      return store.listDependencies(authorization.scope);
    },
  };
}
