import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "approved",
  "denied",
  "cancelled",
]);

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: varchar("clerk_user_id", { length: 191 }).notNull(),
    fullName: varchar("full_name", { length: 191 }).notNull(),
    email: varchar("email", { length: 191 }).notNull(),
    role: varchar("role", { length: 100 }).notNull(),
    photoUrl: text("photo_url"),
    team: varchar("team", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    metadata: jsonb("metadata").default({}),
  },
  (table) => ({
    clerkUserIdIdx: index("employees_clerk_user_id_idx").on(table.clerkUserId),
    emailIdx: index("employees_email_idx").on(table.email),
  }),
);

export const timeOffRequests = pgTable(
  "time_off_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id").references(() => employees.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    clerkUserId: varchar("clerk_user_id", { length: 191 }).notNull(),
    status: requestStatusEnum("status").default("pending").notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    hours: integer("hours"),
    note: text("note"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    metadata: jsonb("metadata").default({}),
  },
  (table) => ({
    statusIdx: index("time_off_requests_status_idx").on(table.status),
    clerkUserIdx: index("time_off_requests_clerk_user_idx").on(
      table.clerkUserId,
    ),
    dateRangeIdx: index("time_off_requests_date_range_idx").on(
      table.startDate,
      table.endDate,
    ),
  }),
);

export const timeOffApprovals = pgTable(
  "time_off_approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => timeOffRequests.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    actionedByClerkUserId: varchar("actioned_by_clerk_user_id", {
      length: 191,
    }).notNull(),
    actionedByName: varchar("actioned_by_name", { length: 191 }).notNull(),
    action: requestStatusEnum("action").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    requestIdx: index("time_off_approvals_request_idx").on(table.requestId),
  }),
);
