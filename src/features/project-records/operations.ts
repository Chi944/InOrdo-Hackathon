import "server-only";

import { z, type ZodType } from "zod";

import type {
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
  const { scope } = await requireCurrentUserProjectAccess(
    client,
    projectId,
    allowedRoles,
  );
  return { scope };
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

type CreateProjectRecordOperationsOptions = {
  client: ServerSupabaseClient;
  store?: ProjectRecordStore;
  getStore?: () => ProjectRecordStore;
  authorize?: ProjectRecordAuthorizer;
};

export function createProjectRecordOperations({
  client,
  store,
  getStore,
  authorize = authorizeProjectRecord,
}: CreateProjectRecordOperationsOptions) {
  let initializedStore = store ?? null;
  const resolveStore = () => {
    initializedStore ??= getStore?.() ?? createSupabaseProjectRecordStore(client);
    return initializedStore;
  };

  return {
    async createItem(input: unknown) {
      const record = parseInput(createProjectItemSchema, input);
      const authorization = await authorize(
        client,
        record.projectId,
        workspaceContributorRoles,
      );

      return resolveStore().createItem(authorization.scope, record);
    },

    async updateItem(input: unknown) {
      const record = parseInput(updateProjectItemSchema, input);
      const authorization = await authorize(
        client,
        record.projectId,
        workspaceContributorRoles,
      );
      return resolveStore().updateItem(authorization.scope, record);
    },

    async listItems(projectId: unknown, input: unknown = {}) {
      const parsedProjectId = parseInput(projectIdSchema, projectId);
      const filters = parseInput(listProjectItemsFilterSchema, input);
      const authorization = await authorize(
        client,
        parsedProjectId,
        workspaceReadRoles,
      );
      return resolveStore().listItems(authorization.scope, filters);
    },

    async createDependency(input: unknown) {
      const dependency = parseInput(createDependencySchema, input);
      const authorization = await authorize(
        client,
        dependency.projectId,
        workspaceContributorRoles,
      );
      return resolveStore().createDependency(authorization.scope, dependency);
    },

    async removeDependency(input: unknown) {
      const dependency = parseInput(deleteDependencySchema, input);
      const authorization = await authorize(
        client,
        dependency.projectId,
        workspaceContributorRoles,
      );
      return resolveStore().removeDependency(authorization.scope, dependency);
    },

    async listDependencies(projectId: unknown) {
      const parsedProjectId = parseInput(projectIdSchema, projectId);
      const authorization = await authorize(
        client,
        parsedProjectId,
        workspaceReadRoles,
      );
      return resolveStore().listDependencies(authorization.scope);
    },
  };
}
