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

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function createOrUpdateEmployeeFromClerk(
  clerkUserId: string,
): Promise<EmployeeRecord | null> {
  const clerkUser = await clerkClient.users.getUser(clerkUserId);

  const fallbackEmail = `${clerkUserId}@users.clerk`;
  const primaryEmail =
    normalizeString(clerkUser.primaryEmailAddress?.emailAddress) ??
    normalizeString(clerkUser.emailAddresses?.[0]?.emailAddress) ??
    null;
  const email = primaryEmail ?? fallbackEmail;
  const providedFullName = normalizeString(clerkUser.fullName);
  const combinedName =
    [normalizeString(clerkUser.firstName), normalizeString(clerkUser.lastName)]
      .filter((value): value is string => Boolean(value))
      .join(" ");
  const usernameFallback = normalizeString(clerkUser.username);
  const resolvedFullName =
    providedFullName ??
    (combinedName.length > 0 ? combinedName : null) ??
    usernameFallback ??
    primaryEmail ??
    fallbackEmail;
  const fullName = normalizeString(resolvedFullName) ?? fallbackEmail;
  const photoUrl = clerkUser.imageUrl ?? null;
  const roleMetadata = normalizeString(clerkUser.publicMetadata?.role);
  const teamMetadata = normalizeString(clerkUser.publicMetadata?.team);
  const role = roleMetadata ?? "employee";
  const team = teamMetadata ?? null;
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

  if (roleMetadata) {
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
