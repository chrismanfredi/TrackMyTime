"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/db";
import {
  employees,
  timeOffApprovals,
  timeOffRequests,
} from "@/db/schema";

const MANAGER_ROLE_TOKENS = ["manager", "director", "admin", "people ops"] as const;

const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  cancelled: "Denied",
} as const;

function normalizeRoleTokens(role: unknown): string[] {
  if (Array.isArray(role)) {
    return role
      .flatMap((value) =>
        typeof value === "string" ? value.toLowerCase().split(/\s*,\s*/) : [],
      )
      .filter(Boolean);
  }
  if (typeof role === "string") {
    return role
      .toLowerCase()
      .split(/\s*,\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function canManageRequests(roleTokens: string[]): boolean {
  return MANAGER_ROLE_TOKENS.some((token) => roleTokens.includes(token));
}

function safeDisplayName(user: Awaited<ReturnType<typeof clerkClient.users.getUser>>) {
  return (
    user.fullName ??
    user.username ??
    user.primaryEmailAddress?.emailAddress ??
    user.id
  );
}

function mapDbRequest(row: {
  id: string;
  status: string | null;
  type: string;
  startDate: string;
  endDate: string;
  hours: number | null;
  note: string | null;
  submittedAt: Date | string | null;
  employeeId: string | null;
  clerkUserId: string;
  employeeName: string | null;
  employeeRole: string | null;
}) {
  const statusKey = (row.status ?? "pending") as keyof typeof STATUS_LABELS;
  return {
    id: row.id,
    status: STATUS_LABELS[statusKey] ?? "Pending",
    type: row.type,
    startDate: row.startDate,
    endDate: row.endDate,
    hours: row.hours ?? undefined,
    note: row.note ?? undefined,
    submittedAt:
      row.submittedAt instanceof Date
        ? row.submittedAt.toISOString()
        : row.submittedAt ?? null,
    employee: {
      id: row.employeeId,
      clerkUserId: row.clerkUserId,
      name: row.employeeName ?? "Unknown employee",
      role: row.employeeRole ?? "Team Member",
    },
  };
}

export async function PATCH(
  request: Request,
  context: { params: Record<string, string | string[]> },
) {
  const idValue = context?.params?.id;
  const requestId = Array.isArray(idValue) ? idValue[0] : idValue;

  if (!requestId || typeof requestId !== "string") {
    return NextResponse.json(
      { ok: false, error: "Request id is required." },
      { status: 400 },
    );
  }

  const { userId } = auth();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request payload." },
      { status: 400 },
    );
  }

  if (
    typeof parsedBody !== "object" ||
    parsedBody === null ||
    !("status" in parsedBody) ||
    typeof (parsedBody as { status: unknown }).status !== "string"
  ) {
    return NextResponse.json(
      { ok: false, error: "Status is required." },
      { status: 400 },
    );
  }

  const requestedStatus = (parsedBody as { status: string }).status;
  if (requestedStatus !== "Approved" && requestedStatus !== "Denied") {
    return NextResponse.json(
      { ok: false, error: "Status must be Approved or Denied." },
      { status: 400 },
    );
  }

  const normalizedStatus =
    requestedStatus === "Approved" ? "approved" : "denied";

  const user = await clerkClient.users.getUser(userId);
  const roleTokens = normalizeRoleTokens(user.publicMetadata?.role);

  if (!canManageRequests(roleTokens)) {
    const employeeRecord = await db.query.employees.findFirst({
      where: eq(employees.clerkUserId, userId),
    });
    const employeeRoleTokens = normalizeRoleTokens(employeeRecord?.role);
    if (!canManageRequests(employeeRoleTokens)) {
      return NextResponse.json(
        {
          ok: false,
          error: "You do not have permission to modify this request.",
        },
        { status: 403 },
      );
    }
  }

  const [updatedRequest] = await db
    .update(timeOffRequests)
    .set({
      status: normalizedStatus,
      lastUpdatedAt: new Date(),
    })
    .where(eq(timeOffRequests.id, requestId))
    .returning();

  if (!updatedRequest) {
    return NextResponse.json(
      { ok: false, error: "Request not found." },
      { status: 404 },
    );
  }

  await db.insert(timeOffApprovals).values({
    requestId: updatedRequest.id,
    action: normalizedStatus,
    actionedByClerkUserId: userId,
    actionedByName: safeDisplayName(user),
    comment: null,
  });

  const [responsePayload] = await db
    .select({
      id: timeOffRequests.id,
      status: timeOffRequests.status,
      type: timeOffRequests.type,
      startDate: timeOffRequests.startDate,
      endDate: timeOffRequests.endDate,
      hours: timeOffRequests.hours,
      note: timeOffRequests.note,
      submittedAt: timeOffRequests.submittedAt,
      employeeId: timeOffRequests.employeeId,
      clerkUserId: timeOffRequests.clerkUserId,
      employeeName: employees.fullName,
      employeeRole: employees.role,
    })
    .from(timeOffRequests)
    .leftJoin(
      employees,
      and(
        eq(employees.id, timeOffRequests.employeeId),
        eq(employees.clerkUserId, updatedRequest.clerkUserId),
      ),
    )
    .where(eq(timeOffRequests.id, updatedRequest.id));

  revalidatePath("/");
  revalidatePath("/time-off");

  const formatted = responsePayload ? mapDbRequest(responsePayload) : null;

  return NextResponse.json({
    ok: true,
    request: formatted,
  });
}
