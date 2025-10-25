"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/db";
import { employees } from "@/db/schema";

export type EmployeeRecord = typeof employees.$inferSelect;

export type SyncCurrentUserResult =
  | { status: "success"; employee: EmployeeRecord }
  | { status: "error"; message: string };

export async function getEmployeeByClerkId(
  clerkUserId: string,
): Promise<EmployeeRecord | null> {
  return db.query.employees.findFirst({
    where: eq(employees.clerkUserId, clerkUserId),
  });
}

async function createOrUpdateEmployeeFromClerk(
  clerkUserId: string,
): Promise<EmployeeRecord | null> {
  const clerkUser = await clerkClient.users.getUser(clerkUserId);

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses?.[0]?.emailAddress ??
    null;
  const fullName =
    clerkUser.fullName ??
    [clerkUser.firstName, clerkUser.lastName]
      .filter((value): value is string => Boolean(value && value.length > 0))
      .join(" ") ||
    clerkUser.username ??
    email;
  const photoUrl = clerkUser.imageUrl ?? null;
  const roleMetadata = clerkUser.publicMetadata?.role;
  const teamMetadata = clerkUser.publicMetadata?.team;
  const role =
    typeof roleMetadata === "string" && roleMetadata.trim().length > 0
      ? roleMetadata
      : "employee";
  const team =
    typeof teamMetadata === "string" && teamMetadata.trim().length > 0
      ? teamMetadata
      : null;
  const metadata =
    clerkUser.publicMetadata &&
    Object.keys(clerkUser.publicMetadata).length > 0
      ? clerkUser.publicMetadata
      : undefined;

  const updateValues: Record<string, unknown> = {
    email,
    fullName,
    photoUrl,
    updatedAt: new Date(),
  };

  if (typeof roleMetadata === "string" && roleMetadata.trim().length > 0) {
    updateValues.role = roleMetadata;
  }

  if (team) {
    updateValues.team = team;
  }

  if (metadata) {
    updateValues.metadata = metadata;
  }

  const insertValues: typeof employees.$inferInsert = {
    clerkUserId,
    email,
    fullName,
    photoUrl,
    role,
    updatedAt: new Date(),
  };

  if (team) {
    insertValues.team = team;
  }

  if (metadata) {
    insertValues.metadata = metadata;
  }

  const [record] = await db
    .insert(employees)
    .values(insertValues)
    .onConflictDoUpdate({
      target: employees.clerkUserId,
      set: updateValues,
    })
    .returning();

  if (record) {
    return record;
  }

  return getEmployeeByClerkId(clerkUserId);
}

export async function getOrCreateEmployeeByClerkId(
  clerkUserId: string,
): Promise<EmployeeRecord | null> {
  const existing = await getEmployeeByClerkId(clerkUserId);
  if (existing) {
    return existing;
  }
  return createOrUpdateEmployeeFromClerk(clerkUserId);
}

export async function syncCurrentUser(): Promise<SyncCurrentUserResult> {
  const { userId } = await auth();
  if (!userId) {
    return { status: "error", message: "Not authenticated." };
  }

  try {
    const employee = await createOrUpdateEmployeeFromClerk(userId);
    if (!employee) {
      return { status: "error", message: "Unable to sync user." };
    }
    return { status: "success", employee };
  } catch (error) {
    console.error("Failed to sync Clerk user", error);
    return { status: "error", message: "Failed to sync Clerk user." };
  }
}
