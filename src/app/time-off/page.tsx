"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard-shell";
import { useUser } from "@clerk/nextjs";

type CalendarStatus = "Pending" | "Approved" | "Denied";

type CalendarRequest = {
  id: string;
  employee: string;
  role: string;
  type: string;
  status: CalendarStatus;
  start: string; // ISO format YYYY-MM-DD
  end: string; // ISO format YYYY-MM-DD
  hours?: number;
  notes?: string;
  submitted?: string;
  dateLabel?: string;
};

type ApprovedRequestSnapshot = {
  id: string;
  employee: string;
  role: string;
  type: string;
  status: CalendarStatus;
  startDateISO: string;
  endDateISO: string;
  hours?: number;
  notes?: string;
  submitted?: string;
  datesLabel?: string;
};

const APPROVED_REQUESTS_STORAGE_KEY = "trackmytime-approved-requests";

const MANAGER_ROLE_TOKENS = ["manager", "director", "admin", "people ops"] as const;

const MANAGER_MESSAGES = {
  signIn: "Sign in as a manager to take action on requests.",
  missingPermission: "You do not have permission to modify requests.",
  updateFailed: "Unable to update request status.",
  requestNotUpdated: "This request could not be updated.",
};

const CALENDAR_ACTION_LABELS: Record<Exclude<CalendarStatus, "Pending">, string> = {
  Approved: "Approve",
  Denied: "Deny",
};

const navigation: DashboardNavItem[] = [
  { label: "Overview", href: "/", active: false },
  { label: "Employees", href: "/employees", active: false },
  { label: "Time Off", href: "/time-off", active: true },
];

const timeOffRequests: CalendarRequest[] = [
  {
    id: "kayley-pto",
    employee: "Kayley Manfredi",
    role: "Product Manager",
    type: "PTO",
    status: "Approved",
    start: "2025-01-11",
    end: "2025-01-12",
  },
  {
    id: "jordan-wfh",
    employee: "Jordan Lee",
    role: "Engineering Manager",
    type: "WFH",
    status: "Approved",
    start: "2025-03-04",
    end: "2025-03-08",
  },
  {
    id: "priya-sick",
    employee: "Priya Patel",
    role: "QA Analyst",
    type: "Sick",
    status: "Approved",
    start: "2025-05-20",
    end: "2025-05-22",
  },
  {
    id: "nina-pto",
    employee: "Nina Chen",
    role: "Customer Success Lead",
    type: "PTO",
    status: "Pending",
    start: "2025-07-01",
    end: "2025-07-05",
  },
  {
    id: "omar-wfh",
    employee: "Omar Hassan",
    role: "People Operations",
    type: "WFH",
    status: "Denied",
    start: "2025-09-09",
    end: "2025-09-10",
  },
  {
    id: "alex-fall-pto",
    employee: "Alex Wilson",
    role: "Product Designer",
    type: "PTO",
    status: "Approved",
    start: "2025-10-07",
    end: "2025-10-10",
  },
  {
    id: "nina-autumn-pto",
    employee: "Nina Chen",
    role: "Customer Success Lead",
    type: "PTO",
    status: "Pending",
    start: "2025-10-21",
    end: "2025-10-24",
  },
  {
    id: "omar-nov-pto",
    employee: "Omar Hassan",
    role: "People Operations",
    type: "PTO",
    status: "Approved",
    start: "2025-11-05",
    end: "2025-11-07",
  },
  {
    id: "priya-holiday-pto",
    employee: "Priya Patel",
    role: "QA Analyst",
    type: "PTO",
    status: "Pending",
    start: "2025-11-18",
    end: "2025-11-21",
  },
  {
    id: "sofia-pto",
    employee: "Sofia Martinez",
    role: "Senior Account Executive",
    type: "PTO",
    status: "Approved",
    start: "2025-11-24",
    end: "2025-11-29",
  },
];

const STATUS_CLASSES: Record<CalendarStatus, string> = {
  Pending: "border-amber-200 bg-amber-50 text-amber-700",
  Approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Denied: "border-rose-200 bg-rose-50 text-rose-700",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
});

const RANGE_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const RANGE_DAY_WITH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const FULL_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISODate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatISODateRangeLabel(startISO: string, endISO: string) {
  const startDate = parseISODate(startISO);
  if (!startDate) {
    return "Dates pending";
  }
  const endDate = parseISODate(endISO);
  if (!endDate || startISO === endISO) {
    return RANGE_DAY_WITH_YEAR_FORMATTER.format(startDate);
  }
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const startLabel = sameYear
    ? RANGE_DAY_FORMATTER.format(startDate)
    : RANGE_DAY_WITH_YEAR_FORMATTER.format(startDate);
  const endLabel = RANGE_DAY_WITH_YEAR_FORMATTER.format(endDate);
  return `${startLabel} – ${endLabel}`;
}

function formatISODateLabel(dateISO: string) {
  const date = parseISODate(dateISO);
  return date ? FULL_DAY_FORMATTER.format(date) : "Unknown date";
}

function hasManagerAccess(role: string | null | undefined) {
  if (!role) {
    return false;
  }
  const normalizedRole = role.toLowerCase();
  return MANAGER_ROLE_TOKENS.some((token) => normalizedRole.includes(token));
}

function getRequestTypeLabel(type: string) {
  return type;
}

function enumerateDateRange(startISO: string, endISO: string) {
  const dates: string[] = [];
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function buildRequestCalendarMap(requests: CalendarRequest[]) {
  const map = new Map<string, CalendarRequest[]>();
  for (const request of requests) {
    for (const day of enumerateDateRange(request.start, request.end)) {
      const existing = map.get(day);
      if (existing) {
        existing.push(request);
      } else {
        map.set(day, [request]);
      }
    }
  }
  return map;
}

function buildMonthMatrix(year: number, monthIndex: number) {
  const firstDay = new Date(year, monthIndex, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, monthIndex, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export default function TimeOffCalendarPage() {
  const { user, isSignedIn } = useUser();
  const userRoleMetadata =
    (user?.publicMetadata?.role as string | undefined) ?? "";
  const userDisplayName =
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress ??
    "Unknown user";
  const normalizedDisplayName = userDisplayName.toLowerCase();
  const managerOverride = normalizedDisplayName.includes("chris manfredi");
  const effectiveRoleMetadata = managerOverride ? "manager" : userRoleMetadata;
  const managerCanReview = managerOverride || hasManagerAccess(effectiveRoleMetadata);

  const [dynamicApprovedRequests, setDynamicApprovedRequests] = useState<
    CalendarRequest[]
  >([]);
  const [activeRequestContext, setActiveRequestContext] = useState<{
    request: CalendarRequest;
    dateKey: string;
    dayRequests: CalendarRequest[];
  } | null>(null);
  const [managerFeedback, setManagerFeedback] = useState<string | null>(null);
  const [actioningRequestId, setActioningRequestId] = useState<string | null>(
    null,
  );

  const closeActiveRequest = () => {
    setActiveRequestContext(null);
    setManagerFeedback(null);
    setActioningRequestId(null);
  };

  useEffect(() => {
    queueMicrotask(() => {
      setManagerFeedback(null);
      setActioningRequestId(null);
    });
  }, [activeRequestContext?.request.id]);

  const loadSnapshots = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const raw = window.localStorage.getItem(APPROVED_REQUESTS_STORAGE_KEY);
      if (!raw) {
        setDynamicApprovedRequests([]);
        return;
      }
      const parsed = JSON.parse(raw) as ApprovedRequestSnapshot[];
      if (!Array.isArray(parsed)) {
        setDynamicApprovedRequests([]);
        return;
      }
      const mapped = parsed
        .filter(
          (snapshot): snapshot is ApprovedRequestSnapshot =>
            typeof snapshot === "object" &&
            snapshot !== null &&
            typeof snapshot.id === "string" &&
            typeof snapshot.employee === "string" &&
            typeof snapshot.role === "string" &&
            typeof snapshot.type === "string" &&
            typeof snapshot.startDateISO === "string" &&
            typeof snapshot.endDateISO === "string",
        )
        .map<CalendarRequest>((snapshot) => ({
          id: snapshot.id,
          employee: snapshot.employee,
          role: snapshot.role,
          type: snapshot.type,
          status: snapshot.status,
          start: snapshot.startDateISO,
          end: snapshot.endDateISO,
          hours: snapshot.hours,
          notes: snapshot.notes,
          submitted: snapshot.submitted,
          dateLabel: snapshot.datesLabel,
        }));
      setDynamicApprovedRequests(mapped);
    } catch (error) {
      console.error("Failed to read approved requests", error);
      setDynamicApprovedRequests([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    queueMicrotask(loadSnapshots);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === APPROVED_REQUESTS_STORAGE_KEY) {
        loadSnapshots();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadSnapshots]);

  const persistSnapshotUpdate = useCallback(
    (request: CalendarRequest, status: CalendarStatus) => {
      if (typeof window === "undefined") {
        return;
      }

      const snapshotPayload: ApprovedRequestSnapshot = {
        id: request.id,
        employee: request.employee,
        role: request.role,
        type: request.type,
        status,
        startDateISO: request.start,
        endDateISO: request.end,
        hours: request.hours,
        notes: request.notes,
        submitted: request.submitted,
        datesLabel:
          request.dateLabel ?? formatISODateRangeLabel(request.start, request.end),
      };

      try {
        const raw = window.localStorage.getItem(APPROVED_REQUESTS_STORAGE_KEY);
        if (!raw) {
          window.localStorage.setItem(
            APPROVED_REQUESTS_STORAGE_KEY,
            JSON.stringify([snapshotPayload]),
          );
          return;
        }
        const parsed = JSON.parse(raw) as ApprovedRequestSnapshot[];
        if (!Array.isArray(parsed)) {
          window.localStorage.setItem(
            APPROVED_REQUESTS_STORAGE_KEY,
            JSON.stringify([snapshotPayload]),
          );
          return;
        }
        const index = parsed.findIndex((snapshot) => snapshot.id === request.id);
        if (index >= 0) {
          parsed[index] = { ...parsed[index], ...snapshotPayload };
        } else {
          parsed.push(snapshotPayload);
        }
        window.localStorage.setItem(
          APPROVED_REQUESTS_STORAGE_KEY,
          JSON.stringify(parsed),
        );
      } catch (error) {
        console.error("Failed to update approved requests cache", error);
      }
    },
    [],
  );

  useEffect(() => {
    if (!activeRequestContext) {
      return;
    }
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveRequestContext(null);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [activeRequestContext]);

  const combinedRequests = useMemo(() => {
    const byId = new Map<string, CalendarRequest>();
    for (const request of timeOffRequests) {
      byId.set(request.id, request);
    }
    for (const request of dynamicApprovedRequests) {
      byId.set(request.id, request);
    }
    return Array.from(byId.values());
  }, [dynamicApprovedRequests]);

  const updateRequestStatusLocally = useCallback(
    (targetRequest: CalendarRequest, nextStatus: CalendarStatus) => {
      setDynamicApprovedRequests((previous) => {
        const index = previous.findIndex((item) => item.id === targetRequest.id);
        const updatedEntry: CalendarRequest = { ...targetRequest, status: nextStatus };
        if (index >= 0) {
          const next = [...previous];
          next[index] = { ...next[index], status: nextStatus };
          return next;
        }
        return [...previous, updatedEntry];
      });

      setActiveRequestContext((previous) => {
        if (!previous) {
          return previous;
        }
        const updatedDayRequests = previous.dayRequests.map((dayRequest) =>
          dayRequest.id === targetRequest.id
            ? { ...dayRequest, status: nextStatus }
            : dayRequest,
        );
        const updatedSelectedRequest =
          previous.request.id === targetRequest.id
            ? { ...previous.request, status: nextStatus }
            : previous.request;
        return {
          dateKey: previous.dateKey,
          dayRequests: updatedDayRequests,
          request: updatedSelectedRequest,
        };
      });
    },
    [],
  );

  const processRequestStatusChange = useCallback(
    (targetRequest: CalendarRequest, nextStatus: Exclude<CalendarStatus, "Pending">) => {
      if (!isSignedIn || !user) {
        setManagerFeedback(MANAGER_MESSAGES.signIn);
        return;
      }
      if (!managerCanReview) {
        setManagerFeedback(MANAGER_MESSAGES.missingPermission);
        return;
      }
      if (targetRequest.status === nextStatus) {
        setManagerFeedback(
          `Request is already marked as ${nextStatus.toLowerCase()}.`,
        );
        return;
      }

      setManagerFeedback(null);
      setActioningRequestId(targetRequest.id);

      try {
        const updatedRequest: CalendarRequest = {
          ...targetRequest,
          status: nextStatus,
        };

        updateRequestStatusLocally(updatedRequest, nextStatus);
        persistSnapshotUpdate(updatedRequest, nextStatus);

        setManagerFeedback(
          `${updatedRequest.employee} marked as ${nextStatus.toLowerCase()} by ${userDisplayName}.`,
        );

        loadSnapshots();
      } catch (error) {
        setManagerFeedback(
          error instanceof Error
            ? error.message
            : MANAGER_MESSAGES.updateFailed,
        );
      }

      setActioningRequestId(null);
    },
    [
      isSignedIn,
      user,
      managerCanReview,
      userDisplayName,
      updateRequestStatusLocally,
      persistSnapshotUpdate,
      loadSnapshots,
    ],
  );

  const requestMap = useMemo(
    () => buildRequestCalendarMap(combinedRequests),
    [combinedRequests],
  );

  const uniqueYears = useMemo(() => {
    const years = new Set<number>();
    for (const request of combinedRequests) {
      years.add(new Date(request.start).getFullYear());
      years.add(new Date(request.end).getFullYear());
    }
    return Array.from(years).sort((a, b) => a - b);
  }, [combinedRequests]);

  const today = new Date();
  const defaultYear = uniqueYears.includes(today.getFullYear())
    ? today.getFullYear()
    : uniqueYears[0] ?? today.getFullYear();

  const [viewYear, setViewYear] = useState(defaultYear);
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const displayedRequests = useMemo(
    () =>
      combinedRequests.filter((request) => {
        const startYear = new Date(request.start).getFullYear();
        const endYear = new Date(request.end).getFullYear();
        return startYear === viewYear || endYear === viewYear;
      }),
    [combinedRequests, viewYear],
  );

  const monthMatrix = useMemo(
    () => buildMonthMatrix(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const monthLabel = MONTH_FORMATTER.format(
    new Date(viewYear, viewMonth, 1),
  );
  const yearLabel = YEAR_FORMATTER.format(new Date(viewYear, 0, 1));

  const goToPreviousMonth = () => {
    setViewMonth((current) => {
      if (current === 0) {
        setViewYear((prev) => prev - 1);
        return 11;
      }
      return current - 1;
    });
  };

  const goToNextMonth = () => {
    setViewMonth((current) => {
      if (current === 11) {
        setViewYear((prev) => prev + 1);
        return 0;
      }
      return current + 1;
    });
  };

  const yearOptions = useMemo(() => {
    const extended = new Set<number>([viewYear, ...uniqueYears]);
    return Array.from(extended).sort((a, b) => a - b);
  }, [viewYear, uniqueYears]);

  const summaryByStatus = useMemo(() => {
    const base = {
      Pending: 0,
      Approved: 0,
      Denied: 0,
    } as Record<CalendarStatus, number>;
    for (const request of displayedRequests) {
      base[request.status] += 1;
    }
    return base;
  }, [displayedRequests]);

  const activeRequest = activeRequestContext?.request ?? null;
  const activeDayKey = activeRequestContext?.dateKey ?? null;
  const activeDayRequests = activeRequestContext?.dayRequests ?? [];
  const activeDateLabel = activeDayKey ? formatISODateLabel(activeDayKey) : null;
  const activeRequestRangeLabel = activeRequest
    ? activeRequest.dateLabel ?? formatISODateRangeLabel(activeRequest.start, activeRequest.end)
    : null;
  const otherRequests = activeRequest
    ? activeDayRequests.filter((request) => request.id !== activeRequest.id)
    : [];

  const handleModalAction = useCallback(
    (status: Exclude<CalendarStatus, "Pending">) => {
      if (!activeRequestContext) {
        return;
      }
      void processRequestStatusChange(activeRequestContext.request, status);
    },
    [activeRequestContext, processRequestStatusChange],
  );

  return (
    <DashboardShell
      navigation={navigation}
      title="Time off calendar"
      subtitle="Scan monthly coverage and track which time-off requests still need action."
      badge="Time Off Planning"
      navActiveLabel="Active"
      actions={
        <div className="flex items-center gap-3">
          <button
            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-500 transition hover:border-indigo-300 hover:text-indigo-600"
            onClick={goToPreviousMonth}
          >
            Previous
          </button>
          <div className="flex items-center gap-2">
            <select
              value={viewMonth}
              onChange={(event) => setViewMonth(Number(event.target.value))}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/60"
            >
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index} value={index}>
                  {MONTH_FORMATTER.format(new Date(2025, index, 1)).split(" ")[0]}
                </option>
              ))}
            </select>
            <select
              value={viewYear}
              onChange={(event) => setViewYear(Number(event.target.value))}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/60"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <button
            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-500 transition hover:border-indigo-300 hover:text-indigo-600"
            onClick={goToNextMonth}
          >
            Next
          </button>
        </div>
      }
    >
      <main className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Total requests in {yearLabel}
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-zinc-900">
                {displayedRequests.length}
              </span>
              <span className="text-xs text-zinc-400">covering the year</span>
            </div>
          </article>
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm text-amber-700">
            <p className="text-xs font-semibold uppercase tracking-wide">
              Pending manager review
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-semibold">
                {summaryByStatus.Pending}
              </span>
              <span className="text-xs">awaiting decisions</span>
            </div>
          </article>
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm text-emerald-700">
            <p className="text-xs font-semibold uppercase tracking-wide">
              Approved coverage
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-semibold">
                {summaryByStatus.Approved}
              </span>
              <span className="text-xs">cleared reservations</span>
            </div>
          </article>
          <article className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm text-rose-700">
            <p className="text-xs font-semibold uppercase tracking-wide">
              Declined requests
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-semibold">
                {summaryByStatus.Denied}
              </span>
              <span className="text-xs">require follow-up</span>
            </div>
          </article>
      </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                {monthLabel}
              </h2>
              <p className="text-sm text-zinc-500">
                View overlapping time off requests for this month.
              </p>
            </div>
          </header>

          <div className="mt-6 grid gap-1 text-[11px] font-medium text-zinc-400 sm:grid-cols-7">
            {DAY_LABELS.map((day) => (
              <span key={day} className="hidden text-center sm:block">
                {day}
              </span>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-7">
            {monthMatrix.flat().map((date, index) => {
              if (!date) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="hidden min-h-[92px] rounded-xl border border-transparent bg-transparent sm:block"
                  />
                );
              }

              const dateKey = formatDateKey(date);
              const dayRequests = requestMap.get(dateKey) ?? [];
              const handleOpenDetails = (request: CalendarRequest) => {
                setActiveRequestContext({
                  request,
                  dateKey,
                  dayRequests,
                });
              };
              return (
                <div
                  key={dateKey}
                  className="min-h-[92px] rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-zinc-500 transition hover:border-indigo-200 hover:bg-indigo-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-800">
                      {date.getDate()}
                    </span>
                    {dayRequests.length > 0 ? (
                      <span className="text-[10px] font-semibold text-indigo-500">
                        {dayRequests.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 space-y-1">
                    {dayRequests.slice(0, 2).map((request) => (
                      <button
                        key={`${request.id}-${dateKey}`}
                        type="button"
                        onClick={() => handleOpenDetails(request)}
                        className={`w-full rounded-xl border px-2 py-1 text-left text-[10px] font-medium transition hover:translate-x-0.5 hover:shadow ${STATUS_CLASSES[request.status]}`}
                      >
                        <span className="block text-zinc-700">
                          {request.employee}
                        </span>
                        <span className="block text-zinc-500">
                          {request.type}
                        </span>
                      </button>
                    ))}
                    {dayRequests.length > 2 ? (
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(dayRequests[0])}
                        className="text-[10px] font-semibold text-indigo-500 underline-offset-2 hover:underline"
                      >
                        +{dayRequests.length - 2} more
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
      {activeRequest ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-900/30 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendar-request-details-title"
          onClick={closeActiveRequest}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-6 pr-16">
              <div>
                <h2
                  id="calendar-request-details-title"
                  className="text-lg font-semibold text-zinc-900"
                >
                  Time off request
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {activeDateLabel
                    ? `Selected day: ${activeDateLabel}`
                    : "Selected day unavailable"}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-xs font-semibold ${STATUS_CLASSES[activeRequest.status]}`}
              >
                {activeRequest.status}
              </span>
            </div>
            <button
              type="button"
              onClick={closeActiveRequest}
              className="absolute right-4 top-4 rounded-xl border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-500 transition hover:border-indigo-300 hover:text-indigo-600"
            >
              Close
            </button>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Employee</dt>
                <dd className="font-semibold text-zinc-800">
                  {activeRequest.employee}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Role</dt>
                <dd className="text-zinc-700">{activeRequest.role}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Type</dt>
                <dd className="text-zinc-700">
                  {getRequestTypeLabel(activeRequest.type)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Dates</dt>
                <dd className="text-zinc-700">
                  {activeRequestRangeLabel}
                </dd>
              </div>
              {typeof activeRequest.hours === "number" ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Total hours</dt>
                  <dd className="text-zinc-700">{activeRequest.hours}</dd>
                </div>
              ) : null}
              {activeRequest.submitted ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Submitted</dt>
                  <dd className="text-zinc-700">{activeRequest.submitted}</dd>
                </div>
              ) : null}
              {activeRequest.notes ? (
                <div className="flex flex-col gap-2">
                  <dt className="text-zinc-500">Notes</dt>
                  <dd className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                    {activeRequest.notes}
                  </dd>
                </div>
              ) : null}
            </dl>
            {managerFeedback ? (
              <p className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] font-medium text-indigo-700">
                {managerFeedback}
              </p>
            ) : null}
            {managerCanReview ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-emerald-100 disabled:bg-emerald-50 disabled:text-emerald-300"
                  onClick={() => handleModalAction("Approved")}
                  disabled={
                    actioningRequestId === activeRequest.id ||
                    activeRequest.status === "Approved"
                  }
                >
                  {CALENDAR_ACTION_LABELS.Approved}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-rose-100 disabled:bg-rose-50 disabled:text-rose-300"
                  onClick={() => handleModalAction("Denied")}
                  disabled={
                    actioningRequestId === activeRequest.id ||
                    activeRequest.status === "Denied"
                  }
                >
                  {CALENDAR_ACTION_LABELS.Denied}
                </button>
              </div>
            ) : (
              <p className="mt-4 text-xs text-zinc-500">
                {isSignedIn
                  ? MANAGER_MESSAGES.missingPermission
                  : MANAGER_MESSAGES.signIn}
              </p>
            )}
            {otherRequests.length > 0 ? (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Other requests on this day
                </p>
                <ul className="mt-3 space-y-2">
                  {otherRequests.map((other) => (
                    <li key={other.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveRequestContext({
                            request: other,
                            dateKey: activeDayKey ?? other.start,
                            dayRequests: activeDayRequests,
                          })
                        }
                        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-sm text-zinc-700 transition hover:border-indigo-300 hover:text-indigo-600"
                      >
                        <span className="font-semibold text-zinc-900">
                          {other.employee}
                        </span>
                        <span className="ml-2 text-xs uppercase tracking-wide text-zinc-400">
                          {getRequestTypeLabel(other.type)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}
