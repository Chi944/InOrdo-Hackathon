"use server";

import { revalidatePath } from "next/cache";

import type { RecordActionState } from "@/app/app/project-record-action-state";
import { createProjectRecordOperations } from "@/features/project-records/operations";
import { ProjectRecordError } from "@/features/project-records/errors";
import { AuthorizationError } from "@/lib/auth/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function stringValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function optionalString(formData: FormData, name: string) {
  const value = stringValue(formData, name);
  return value === "" ? undefined : value;
}

function nullableString(formData: FormData, name: string) {
  if (!formData.has(name)) return undefined;
  const value = stringValue(formData, name);
  return value === "" ? null : value;
}

function actionError(error: unknown): RecordActionState {
  if (error instanceof ProjectRecordError || error instanceof AuthorizationError) {
    return { status: "error", message: error.message };
  }
  return {
    status: "error",
    message: "The project record could not be changed. Please try again.",
  };
}

async function operations() {
  const client = await createServerSupabaseClient();
  return createProjectRecordOperations({ client });
}

export async function createProjectItemAction(
  _previousState: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  try {
    const projectRecords = await operations();
    await projectRecords.createItem({
      projectId: stringValue(formData, "projectId"),
      itemKey: stringValue(formData, "itemKey"),
      itemType: stringValue(formData, "itemType"),
      title: stringValue(formData, "title"),
      description: optionalString(formData, "description"),
      status: stringValue(formData, "status"),
      priority: stringValue(formData, "priority"),
      ownerId: optionalString(formData, "ownerId"),
      startDate: optionalString(formData, "startDate"),
      dueDate: optionalString(formData, "dueDate"),
      eventDate: optionalString(formData, "eventDate"),
    });
    revalidatePath("/app");
    return { status: "success", message: "Project item created." };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateProjectItemAction(
  _previousState: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  try {
    const projectRecords = await operations();
    const input = {
      projectId: stringValue(formData, "projectId"),
      itemId: stringValue(formData, "itemId"),
      expectedVersion: Number(stringValue(formData, "expectedVersion")),
      ...(formData.has("itemKey") && {
        itemKey: stringValue(formData, "itemKey"),
      }),
      ...(formData.has("itemType") && {
        itemType: stringValue(formData, "itemType"),
      }),
      ...(formData.has("title") && { title: stringValue(formData, "title") }),
      ...(formData.has("description") && {
        description: nullableString(formData, "description"),
      }),
      ...(formData.has("status") && {
        status: stringValue(formData, "status"),
      }),
      ...(formData.has("priority") && {
        priority: stringValue(formData, "priority"),
      }),
      ...(formData.has("ownerId") && {
        ownerId: nullableString(formData, "ownerId"),
      }),
      ...(formData.has("startDate") && {
        startDate: nullableString(formData, "startDate"),
      }),
      ...(formData.has("dueDate") && {
        dueDate: nullableString(formData, "dueDate"),
      }),
      ...(formData.has("eventDate") && {
        eventDate: nullableString(formData, "eventDate"),
      }),
    };
    await projectRecords.updateItem(input);
    revalidatePath("/app");
    return { status: "success", message: "Project item updated." };
  } catch (error) {
    return actionError(error);
  }
}

export async function createDependencyAction(
  _previousState: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  try {
    const projectRecords = await operations();
    await projectRecords.createDependency({
      projectId: stringValue(formData, "projectId"),
      fromItemId: stringValue(formData, "fromItemId"),
      toItemId: stringValue(formData, "toItemId"),
      relationship: stringValue(formData, "relationship"),
      rationale: optionalString(formData, "rationale"),
    });
    revalidatePath("/app");
    return { status: "success", message: "Dependency added." };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeDependencyAction(
  _previousState: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  try {
    const projectRecords = await operations();
    await projectRecords.removeDependency({
      projectId: stringValue(formData, "projectId"),
      dependencyId: stringValue(formData, "dependencyId"),
    });
    revalidatePath("/app");
    return { status: "success", message: "Dependency removed." };
  } catch (error) {
    return actionError(error);
  }
}
