"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { db } from "@/db/db";
import { tasks } from "@/db/schema";

import { getOrCreateEmployeeByClerkId } from "./users";

export type CreateTaskField = "type" | "startDate" | "endDate" | "hours" | "note";

export type CreateTaskActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<CreateTaskField, string>>;
  task?: {
    id: string;
    employeeId: string;
    type: string;
    startDate: string;
    endDate?: string;
    hours: number;
    note?: string;
  };
};

export const CREATE_TASK_INITIAL_STATE: CreateTaskActionState = {
  status: "idle",
};

type ValidatedTaskInput = {
  type: string;
  startDate: string;
  endDate?: string;
  hours: number;
  note?: string;
};

type ValidationFailure = {
  success: false;
  message: string;
  errors: Partial<Record<CreateTaskField, string>>;
};

type ValidationSuccess = {
  success: true;
  data: ValidatedTaskInput;
};

type ValidationResult = ValidationFailure | ValidationSuccess;

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function validateCreateTaskForm(formData: FormData): ValidationResult {
  const errors: Partial<Record<CreateTaskField, string>> = {};

  const rawType = (formData.get("type") ?? "").toString().trim();
  if (!rawType) {
    errors.type = "Task type is required.";
  }

  const rawStartDate = (formData.get("startDate") ?? "").toString().trim();
  if (!rawStartDate) {
    errors.startDate = "Start date is required.";
  } else if (!isValidDateString(rawStartDate)) {
    errors.startDate = "Start date must be a valid date.";
  }

  const rawEndDate = (formData.get("endDate") ?? "").toString().trim();
  if (rawEndDate && !isValidDateString(rawEndDate)) {
    errors.endDate = "End date must be a valid date.";
  }

  const rawHours = formData.get("hours");
  const hoursValue = Number(rawHours);
  if (!Number.isFinite(hoursValue)) {
    errors.hours = "Hours must be a number.";
  } else if (hoursValue <= 0) {
    errors.hours = "Hours must be greater than zero.";
  } else if (!Number.isInteger(hoursValue)) {
    errors.hours = "Hours must be a whole number.";
  }

  const note = (formData.get("note") ?? "").toString().trim();

  if (rawStartDate && rawEndDate && !errors.startDate && !errors.endDate) {
    const start = new Date(rawStartDate);
    const end = new Date(rawEndDate);
    if (end.getTime() < start.getTime()) {
      errors.endDate = "End date cannot be before the start date.";
    }
  }

  if (Object.keys(errors).length > 0) {
    const message =
      errors.startDate ??
      errors.type ??
      errors.hours ??
      errors.endDate ??
      "Please correct the errors and try again.";
    return {
      success: false,
      message,
      errors,
    };
  }

  return {
    success: true,
    data: {
      type: rawType,
      startDate: rawStartDate,
      endDate: rawEndDate || undefined,
      hours: hoursValue,
      note: note || undefined,
    },
  };
}

export async function createTaskAction(
  _prevState: CreateTaskActionState,
  formData: FormData,
): Promise<CreateTaskActionState> {
  const { userId } = await auth();
  if (!userId) {
    return {
      status: "error",
      message: "You must be signed in to create a task.",
    };
  }

  const validation = validateCreateTaskForm(formData);
  if (!validation.success) {
    return {
      status: "error",
      message: validation.message,
      fieldErrors: validation.errors,
    };
  }

  try {
    const employee = await getOrCreateEmployeeByClerkId(userId);
    if (!employee) {
      return {
        status: "error",
        message: "Unable to determine the current user.",
      };
    }

    const [task] = await db
      .insert(tasks)
      .values({
        employeeId: employee.id,
        type: validation.data.type,
        startDate: validation.data.startDate,
        endDate: validation.data.endDate ?? null,
        hours: validation.data.hours,
        note: validation.data.note ?? null,
        updatedAt: new Date(),
      })
      .returning();

    if (!task) {
      return {
        status: "error",
        message: "Failed to create the task.",
      };
    }

    revalidatePath("/");

    return {
      status: "success",
      message: "Task created successfully.",
      task: {
        id: task.id,
        employeeId: task.employeeId,
        type: task.type,
        startDate: task.startDate,
        endDate: task.endDate ?? undefined,
        hours: task.hours,
        note: task.note ?? undefined,
      },
    };
  } catch (error) {
    console.error("Failed to create task", error);
    return {
      status: "error",
      message: "Something went wrong while creating the task.",
    };
  }
}
