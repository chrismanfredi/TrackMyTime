"use server";

import { getAuth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { db } from "@/db/db";
import { timeOffRequests } from "@/db/schema";

import { getOrCreateEmployeeByClerkId } from "./users";
import type { CreateTaskActionState, CreateTaskField } from "./request-state";
import { buildClerkRequest } from "./auth-request";

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

function toDbDate(value: string) {
  return value;
}

export async function createTaskAction(
  _prevState: CreateTaskActionState,
  formData: FormData,
): Promise<CreateTaskActionState> {
  const request = buildClerkRequest();
  const { userId } = await getAuth(request);
  if (!userId) {
    return {
      status: "error",
      message: "You must be signed in to create a request.",
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

    const endDateValue = validation.data.endDate ?? validation.data.startDate;

    const [request] = await db
      .insert(timeOffRequests)
      .values({
        employeeId: employee.id,
        clerkUserId: userId,
        status: "pending",
        type: validation.data.type,
        startDate: toDbDate(validation.data.startDate),
        endDate: toDbDate(endDateValue),
        hours: validation.data.hours,
        note: validation.data.note ?? null,
        metadata: undefined,
      })
      .returning();

    if (!request) {
      return {
        status: "error",
        message: "Failed to create the time off request.",
      };
    }

    revalidatePath("/");
    revalidatePath("/time-off");

    return {
      status: "success",
      message: "Request submitted successfully.",
      task: {
        id: request.id,
        employeeId: request.employeeId ?? employee.id,
        type: request.type,
        startDate: request.startDate,
        endDate: request.endDate,
        hours: request.hours ?? validation.data.hours,
        note: request.note ?? undefined,
        status: "Pending",
      },
    };
  } catch (error) {
    console.error("Failed to create time off request", error);
    return {
      status: "error",
      message: "Something went wrong while creating the request.",
    };
  }
}
