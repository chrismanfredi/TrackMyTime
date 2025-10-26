"use server";

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/db";
import { employees, timeOffRequests } from "@/db/schema";

const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  cancelled: "Denied",
} as const;

function mapRow(row: {
  id: string;
  status: string | null;
  type: string;
  startDate: string;
  endDate: string;
  hours: number | null;
  note: string | null;
  submittedAt: Date | string | null;
  clerkUserId: string;
  employeeId: string | null;
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

export async function GET() {
  const rows = await db
    .select({
      id: timeOffRequests.id,
      status: timeOffRequests.status,
      type: timeOffRequests.type,
      startDate: timeOffRequests.startDate,
      endDate: timeOffRequests.endDate,
      hours: timeOffRequests.hours,
      note: timeOffRequests.note,
      submittedAt: timeOffRequests.submittedAt,
      clerkUserId: timeOffRequests.clerkUserId,
      employeeId: employees.id,
      employeeName: employees.fullName,
      employeeRole: employees.role,
    })
    .from(timeOffRequests)
    .leftJoin(employees, eq(timeOffRequests.employeeId, employees.id))
    .orderBy(desc(timeOffRequests.submittedAt));

  const requests = rows.map(mapRow);

  return NextResponse.json({ requests });
}
