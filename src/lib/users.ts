"use server";

import type { User } from "@clerk/nextjs/server";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
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
  const record = await db.query.employees.findFirst({
    where: eq(employees.clerkUserId, clerkUserId),
  });
  return record ?? null;
}

async function createOrUpdateEmployeeFromClerk(
  clerkUserId: string,
): Promise<EmployeeRecord | null> {
  const clerkUser = await clerkClient.users.getUser(clerkUserId);

  const normalized = await normalizeClerkUser(clerkUser);
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

  const email =
    normalized?.email ??
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses?.[0]?.emailAddress ??
    clerkUser.username ??
    clerkUser.id;

  const fallbackFullName = [clerkUser.firstName, clerkUser.lastName]
    .filter((value): value is string => Boolean(value && value.length > 0))
    .join(" ");

  const fullNameCandidates: Array<string | null | undefined> = [
    normalized?.displayName,
    clerkUser.fullName,
    fallbackFullName.length > 0 ? fallbackFullName : undefined,
    clerkUser.username,
    email,
  ];

  const fullName = fullNameCandidates.find(
    (value): value is string => Boolean(value && value.trim().length > 0),
  )!;

  const updateValues: Record<string, unknown> = {
    email,
    fullName,
    photoUrl: normalized?.photoUrl ?? null,
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
    photoUrl: normalized?.photoUrl ?? null,
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
  const { userId } = await getAuth(undefined);
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

type NullableString = string | null | undefined;

const isNonEmptyString = (value: NullableString): value is string =>
  typeof value === "string" && value.trim().length > 0;

export type NormalizedClerkUser = {
  id: string;
  displayName: string;
  email: string | null;
  photoUrl: string | null;
  role: string | null;
};

export async function normalizeClerkUser(
  clerkUser: User | null | undefined,
  explicitEmail?: NullableString,
): Promise<NormalizedClerkUser | null> {
  if (!clerkUser) {
    return null;
  }

  const fullName = [clerkUser.firstName, clerkUser.lastName]
    .filter((value): value is string => isNonEmptyString(value))
    .join(" ");

  const primaryEmail =
    explicitEmail ??
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses?.[0]?.emailAddress ??
    null;

  const fallbackIdentifier =
    clerkUser.username ?? primaryEmail ?? clerkUser.id;

  const displayName =
    isNonEmptyString(fullName) ? fullName : fallbackIdentifier ?? "Unknown user";

  const roleMetadata = clerkUser.publicMetadata?.role;
  const role =
    typeof roleMetadata === "string"
      ? roleMetadata
      : Array.isArray(roleMetadata)
        ? roleMetadata.join(", ")
        : null;

  return {
    id: clerkUser.id,
    displayName,
    email: primaryEmail,
    photoUrl: clerkUser.imageUrl ?? null,
    role,
  };
}
