"use client";

import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { DashboardShell } from "@/components/dashboard-shell";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type RequestStatus = "Pending" | "Approved" | "Denied";

type TimeOffRequest = {
  id: string;
  employee: string;
  role: string;
  type: string;
  status: RequestStatus;
  dates: string;
  startDateISO: string;
  endDateISO: string;
  hours: number;
  submitted: string;
  notes?: string;
};

type NewRequestFormState = {
  type: string;
  startDate: string;
  endDate: string;
  hours: string;
  note: string;
};

type ManagerActivity = {
  id: string;
  type: string;
  detail: string;
  meta: string;
};

type ApprovedRequestSnapshot = {
  id: string;
  employee: string;
  role: string;
  type: string;
  status: RequestStatus;
  startDateISO: string;
  endDateISO: string;
  hours?: number;
  notes?: string;
  submitted?: string;
  datesLabel?: string;
};

type Locale = "en" | "es";

const LANGUAGE_STORAGE_KEY = "trackmytime-locale";

type Translation = {
  nav: {
    overview: string;
    employees: string;
    timeOff: string;
  };
  header: {
    badge: string;
    title: string;
    subtitle: string;
    activeLabel: string;
  };
  language: {
    label: string;
    options: Record<Locale, string>;
  };
  searchPlaceholder: string;
  quickFiltersLabel: string;
  quickFilters: string[];
  newRequestButton: string;
  pendingCopy: {
    zero: string;
    one: string;
    many: (count: number) => string;
  };
  stats: {
    pendingTitle: string;
    pendingBadge: string;
    approvedHoursTitle: string;
    approvedHoursDelta: string;
    totalRequestsPrefix: string;
    totalRequestsSuffix: string;
    summaryTitles: Record<RequestStatus, string>;
    summarySubtitles: Record<RequestStatus, string>;
  };
  statusLabels: Record<RequestStatus, string>;
  statusVerbs: Record<Exclude<RequestStatus, "Pending">, string>;
  managerMessages: {
    requireManager: string;
    signInManager: string;
    authRequired: string;
    missingPermission: string;
    updateFailed: string;
    requestUpdateError: string;
    success: (employee: string, statusLabel: string, actor: string) => string;
  };
  validation: {
    startDateRequired: string;
    endDateInvalid: string;
    hoursInvalid: string;
  };
  table: {
    title: string;
    subtitle: string;
    viewHistory: string;
    headings: {
      employee: string;
      type: string;
      dates: string;
      status: string;
    };
    typeRequestedLabel: string;
    hoursSuffix: string;
    submittedPrefix: string;
    buttons: {
      approve: string;
      deny: string;
      view: string;
      hide: string;
    };
    detailsHeader: string;
    selectedDayLabel: string;
    unavailableDayLabel: string;
    requestDetailsLabel: string;
    otherRequestsTitle: string;
    moreLabel: (count: number) => string;
    detailsFields: {
      employee: string;
      dates: string;
      hours: string;
      submitted: string;
      notes: string;
    };
  };
  newRequestModal: {
    title: string;
    description: string;
    badge: string;
    close: string;
  };
  newRequestCard: {
    title: string;
    subtitle: string;
    signInPrompt: string;
    signInButton: string;
    successMessage: string;
    form: {
      type: string;
      startDate: string;
      endDate: string;
      hours: string;
      notes: string;
      notesPlaceholder: string;
      submit: string;
    };
  };
  highlights: {
    title: string;
    items: string[];
  };
  managerNotifications: {
    title: string;
    viewAutomation: string;
  };
  requestTypeLabels: Record<(typeof requestTypes)[number], string>;
  managerActivity: {
    initialType: string;
    initialDetail: string;
    initialMeta: string;
    submittedType: string;
    submittedDetail: (name: string, type: string, dates: string) => string;
    statusTitles: Record<Exclude<RequestStatus, "Pending">, string>;
    statusDetails: Record<
      Exclude<RequestStatus, "Pending">,
      (employee: string, type: string, dates: string) => string
    >;
    justNow: string;
  };
  highlightsLabel: string;
  otherRequestsMore: (count: number) => string;
};

const requestTypes = ["PTO", "WFH", "Sick", "Unpaid", "Other"] as const;

const translations: Record<Locale, Translation> = {
  en: {
    nav: {
      overview: "Overview",
      employees: "Employees",
      timeOff: "Time Off",
    },
    header: {
      badge: "Time Off Dashboard",
      title: "Team availability & approvals",
      subtitle:
        "Monitor pending requests, coverage risks, and upcoming time off trends for your teams.",
      activeLabel: "Live",
    },
    language: {
      label: "Language",
      options: {
        en: "English",
        es: "Español",
      },
    },
    searchPlaceholder: "Search employees, requests, teams",
    quickFiltersLabel: "Quick filters:",
    quickFilters: ["This week", "This month", "Quarter to date"],
    newRequestButton: "New request",
    pendingCopy: {
      zero: "All caught up on approvals.",
      one: "1 request needs action.",
      many: (count: number) => `${count} requests need action.`,
    },
    stats: {
      pendingTitle: "Pending approvals",
      pendingBadge: "Manager alert",
      approvedHoursTitle: "Approved hours",
      approvedHoursDelta: "+18% vs September",
      totalRequestsPrefix: "Total requests in",
      totalRequestsSuffix: "covering the year",
      summaryTitles: {
        Pending: "Pending manager review",
        Approved: "Approved coverage",
        Denied: "Declined requests",
      },
      summarySubtitles: {
        Pending: "awaiting decisions",
        Approved: "cleared reservations",
        Denied: "require follow-up",
      },
    },
    statusLabels: {
      Pending: "Pending",
      Approved: "Approved",
      Denied: "Denied",
    },
    statusVerbs: {
      Approved: "approved",
      Denied: "denied",
    },
    managerMessages: {
      requireManager: "Approval actions require manager permissions.",
      signInManager: "Sign in as a manager to review and approve requests.",
      authRequired: "Sign in as a manager to take action on requests.",
      missingPermission: "You do not have permission to modify requests.",
      updateFailed: "Unable to update request status.",
      requestUpdateError: "This request could not be updated.",
      success: (employee, statusLabel, actor) =>
        `${employee} marked as ${statusLabel.toLowerCase()} by ${actor}.`,
    },
    validation: {
      startDateRequired: "Select a start date for your request.",
      endDateInvalid: "End date cannot be before the start date.",
      hoursInvalid: "Hours must be greater than zero.",
    },
    table: {
      title: "Time off requests",
      subtitle:
        "Prioritize approvals and resolve conflicts before pay period close.",
      viewHistory: "View history",
      headings: {
        employee: "Employee",
        type: "Type",
        dates: "Dates",
        status: "Status",
      },
      typeRequestedLabel: "Requested",
      hoursSuffix: "hrs",
      submittedPrefix: "Submitted",
      buttons: {
        approve: "Approve",
        deny: "Deny",
        view: "View details",
        hide: "Hide details",
      },
      detailsHeader: "Time off request",
      selectedDayLabel: "Selected day",
      unavailableDayLabel: "Selected day unavailable",
      requestDetailsLabel: "request details",
      otherRequestsTitle: "Other requests on this day",
      moreLabel: (count: number) => `+${count} more`,
      detailsFields: {
        employee: "Employee",
        dates: "Dates",
        hours: "Hours",
        submitted: "Submitted",
        notes: "Notes",
      },
    },
    newRequestModal: {
      title: "Submit time off request",
      description:
        "Provide the request details and we’ll route it for approval.",
      badge: "Self-service",
      close: "Close",
    },
    newRequestCard: {
      title: "Employee self-service",
      subtitle: "Submit requests directly to your manager.",
      signInPrompt: "Sign in with Clerk to submit a time off request.",
      signInButton: "Sign in to request time off",
      successMessage: "Time off request submitted for review.",
      form: {
        type: "Time off type",
        startDate: "Start date",
        endDate: "End date",
        hours: "Estimated hours",
        notes: "Notes for your manager (optional)",
        notesPlaceholder: "Context, coverage plan, or additional info",
        submit: "Submit request",
      },
    },
    highlights: {
      title: "Highlights & alerts",
      items: ["PTO cutoff for Memorial Day weekend is Apr 30"],
    },
    managerNotifications: {
      title: "Manager notifications",
      viewAutomation: "View automation rules",
    },
    requestTypeLabels: {
      PTO: "PTO",
      WFH: "WFH",
      Sick: "Sick",
      Unpaid: "Unpaid",
      Other: "Other",
    },
    managerActivity: {
      initialType: "Approved",
      initialDetail: "Chris Manfredi approved 8 hrs WFH",
      initialMeta: "2h ago",
      submittedType: "Request submitted",
      submittedDetail: (name: string, type: string, dates: string) =>
        `${name} submitted ${type} time off (${dates})`,
      statusTitles: {
        Approved: "Approved",
        Denied: "Denied",
      },
      statusDetails: {
        Approved: (employee: string, type: string, dates: string) =>
          `${employee} approved ${type} (${dates})`,
        Denied: (employee: string, type: string, dates: string) =>
          `${employee} denied ${type} (${dates})`,
      },
      justNow: "Just now",
    },
    highlightsLabel: "Highlights & alerts",
    otherRequestsMore: (count: number) => `+${count} more`,
  },
  es: {
    nav: {
      overview: "Resumen",
      employees: "Empleados",
      timeOff: "Ausencias",
    },
    header: {
      badge: "Panel de ausencias",
      title: "Disponibilidad del equipo y aprobaciones",
      subtitle:
        "Supervisa las solicitudes pendientes, los riesgos de cobertura y las tendencias de ausencias del equipo.",
      activeLabel: "Activo",
    },
    language: {
      label: "Idioma",
      options: {
        en: "English",
        es: "Español",
      },
    },
    searchPlaceholder: "Buscar empleados, solicitudes, equipos",
    quickFiltersLabel: "Filtros rápidos:",
    quickFilters: ["Esta semana", "Este mes", "Trimestre a la fecha"],
    newRequestButton: "Nueva solicitud",
    pendingCopy: {
      zero: "No hay aprobaciones pendientes.",
      one: "1 solicitud necesita atención.",
      many: (count: number) => `${count} solicitudes necesitan atención.`,
    },
    stats: {
      pendingTitle: "Aprobaciones pendientes",
      pendingBadge: "Alerta del gerente",
      approvedHoursTitle: "Horas aprobadas",
      approvedHoursDelta: "+18 % vs septiembre",
      totalRequestsPrefix: "Solicitudes totales en",
      totalRequestsSuffix: "durante el año",
      summaryTitles: {
        Pending: "Pendientes de revisión",
        Approved: "Cobertura aprobada",
        Denied: "Solicitudes rechazadas",
      },
      summarySubtitles: {
        Pending: "a la espera de decisiones",
        Approved: "reservas confirmadas",
        Denied: "requieren seguimiento",
      },
    },
    statusLabels: {
      Pending: "Pendiente",
      Approved: "Aprobada",
      Denied: "Rechazada",
    },
    statusVerbs: {
      Approved: "aprobó",
      Denied: "rechazó",
    },
    managerMessages: {
      requireManager: "Las acciones de aprobación requieren permisos de gerente.",
      signInManager:
        "Inicia sesión como gerente para revisar y aprobar solicitudes.",
      authRequired:
        "Inicia sesión como gerente para tomar acción en las solicitudes.",
      missingPermission: "No tienes permiso para modificar solicitudes.",
      updateFailed: "No se pudo actualizar el estado de la solicitud.",
      requestUpdateError: "No se pudo actualizar esta solicitud.",
      success: (employee, statusLabel, actor) =>
        `${actor} marcó a ${employee} como ${statusLabel.toLowerCase()}.`,
    },
    validation: {
      startDateRequired: "Selecciona una fecha de inicio para tu solicitud.",
      endDateInvalid: "La fecha de fin no puede ser anterior a la fecha de inicio.",
      hoursInvalid: "Las horas deben ser mayores que cero.",
    },
    table: {
      title: "Solicitudes de ausencia",
      subtitle:
        "Prioriza las aprobaciones y resuelve conflictos antes del cierre del periodo de pago.",
      viewHistory: "Ver historial",
      headings: {
        employee: "Empleado",
        type: "Tipo",
        dates: "Fechas",
        status: "Estado",
      },
      typeRequestedLabel: "Solicitada",
      hoursSuffix: "h",
      submittedPrefix: "Enviada",
      buttons: {
        approve: "Aprobar",
        deny: "Rechazar",
        view: "Ver detalles",
        hide: "Ocultar detalles",
      },
      detailsHeader: "Solicitud de ausencia",
      selectedDayLabel: "Día seleccionado",
      unavailableDayLabel: "Día no disponible",
      requestDetailsLabel: "detalles de la solicitud",
      otherRequestsTitle: "Otras solicitudes en este día",
      moreLabel: (count: number) => `+${count} más`,
      detailsFields: {
        employee: "Empleado",
        dates: "Fechas",
        hours: "Horas",
        submitted: "Enviada",
        notes: "Notas",
      },
    },
    newRequestModal: {
      title: "Enviar solicitud de ausencia",
      description:
        "Proporciona los detalles de la solicitud y la enviaremos para su aprobación.",
      badge: "Autoservicio",
      close: "Cerrar",
    },
    newRequestCard: {
      title: "Autoservicio del empleado",
      subtitle: "Envía solicitudes directamente a tu gerente.",
      signInPrompt: "Inicia sesión con Clerk para enviar una solicitud de ausencia.",
      signInButton: "Inicia sesión para solicitar tiempo libre",
      successMessage: "Solicitud de ausencia enviada para revisión.",
      form: {
        type: "Tipo de ausencia",
        startDate: "Fecha de inicio",
        endDate: "Fecha de fin",
        hours: "Horas estimadas",
        notes: "Notas para tu gerente (opcional)",
        notesPlaceholder: "Contexto, plan de cobertura u otra información adicional",
        submit: "Enviar solicitud",
      },
    },
    highlights: {
      title: "Destacados y alertas",
      items: ["La fecha límite de PTO para el fin de semana del Día de los Caídos es el 30 de abril"],
    },
    managerNotifications: {
      title: "Notificaciones del gerente",
      viewAutomation: "Ver reglas de automatización",
    },
    requestTypeLabels: {
      PTO: "PTO",
      WFH: "Trabajo desde casa",
      Sick: "Enfermedad",
      Unpaid: "No remunerado",
      Other: "Otro",
    },
    managerActivity: {
      initialType: "Aprobada",
      initialDetail: "Chris Manfredi aprobó 8 h de trabajo remoto",
      initialMeta: "Hace 2 h",
      submittedType: "Solicitud enviada",
      submittedDetail: (name: string, type: string, dates: string) =>
        `${name} envió ausencia ${type} (${dates})`,
      statusTitles: {
        Approved: "Aprobada",
        Denied: "Rechazada",
      },
      statusDetails: {
        Approved: (employee: string, type: string, dates: string) =>
          `${employee} aprobó ${type} (${dates})`,
        Denied: (employee: string, type: string, dates: string) =>
          `${employee} rechazó ${type} (${dates})`,
      },
      justNow: "Hace un momento",
    },
    highlightsLabel: "Destacados y alertas",
    otherRequestsMore: (count: number) => `+${count} más`,
  },
};

const MANAGER_ROLE_TOKENS = ["manager", "director", "admin", "people ops"] as const;

const APPROVED_REQUESTS_STORAGE_KEY = "trackmytime-approved-requests";

const generateId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const hasManagerAccess = (role: string | null | undefined) => {
  if (!role) {
    return false;
  }
  const normalizedRole = role.toLowerCase();
  return MANAGER_ROLE_TOKENS.some((token) => normalizedRole.includes(token));
};

const initialTimeOffRequests: TimeOffRequest[] = [
  {
    id: "req-kayley",
    employee: "Kayley Manfredi",
    role: "Employee",
    type: "PTO",
    status: "Pending",
    dates: "Nov 11 – Nov 12",
    startDateISO: "2025-11-11",
    endDateISO: "2025-11-12",
    hours: 8,
    submitted: "Oct 23",
  },
];

const statusStyles: Record<RequestStatus, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Approved: "bg-emerald-100 text-emerald-700",
  Denied: "bg-rose-100 text-rose-700",
};

const initialNewRequest: NewRequestFormState = {
  type: "PTO",
  startDate: "",
  endDate: "",
  hours: "8",
  note: "",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const isoDate = (value: string) =>
  value ? new Date(`${value}T00:00:00`) : null;

function formatDateRange(startDate: string, endDate?: string) {
  const start = isoDate(startDate);
  if (!start || Number.isNaN(start.getTime())) {
    return "Dates pending";
  }

  if (!endDate) {
    return dateFormatter.format(start);
  }

  const end = isoDate(endDate);
  if (!end || Number.isNaN(end.getTime()) || end < start) {
    return dateFormatter.format(start);
  }

  return `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`;
}

function formatSubmittedDate() {
  return dateFormatter.format(new Date());
}

export default function Home() {
  const { user, isSignedIn } = useUser();

  const userRoleMetadata =
    (user?.publicMetadata?.role as string | undefined) ?? "";
  const userDisplayName =
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress ??
    "Unknown user";
  const userEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    "—";
  const normalizedDisplayName =
    typeof userDisplayName === "string"
      ? userDisplayName.toLowerCase()
      : "";
  const managerOverrideRole = normalizedDisplayName.includes("chris manfredi")
    ? "Manager"
    : undefined;
  const effectiveRoleMetadata = managerOverrideRole || userRoleMetadata;
  const userRoleLabel = effectiveRoleMetadata || "Team Member";

  const [locale, setLocale] = useState<Locale>("en");
  const copy = translations[locale];

  const [requests, setRequests] =
    useState<TimeOffRequest[]>(initialTimeOffRequests);
  const [newRequest, setNewRequest] =
    useState<NewRequestFormState>(initialNewRequest);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const selfServiceRef = useRef<HTMLDivElement | null>(null);
  const [managerActivity, setManagerActivity] = useState<ManagerActivity[]>(() => [
    {
      id: "act-approved",
      type: translations.en.managerActivity.initialType,
      detail: translations.en.managerActivity.initialDetail,
      meta: translations.en.managerActivity.initialMeta,
    },
  ]);
  const [managerFeedback, setManagerFeedback] = useState<string | null>(null);
  const [actioningRequestId, setActioningRequestId] = useState<string | null>(
    null,
  );
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [openDetailsRequestId, setOpenDetailsRequestId] = useState<string | null>(
    null,
  );

  const navigation = useMemo(
    () => [
      { label: copy.nav.overview, href: "/", active: true },
      { label: copy.nav.employees, href: "/employees", active: false },
      { label: copy.nav.timeOff, href: "/time-off", active: false },
    ],
    [copy],
  );

  const quickFilterLabels = copy.quickFilters;

  const getRequestTypeLabel = (type: string) =>
    copy.requestTypeLabels[
      type as (typeof requestTypes)[number]
    ] ?? type;

  const renderLanguageSelector = (
    labelClassName = "",
    selectClassName = "",
  ) => (
    <label
      className={`flex items-center gap-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-zinc-400 ${labelClassName}`.trim()}
    >
      {copy.language.label}
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className={`rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-indigo-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/60 ${selectClassName}`.trim()}
      >
        <option value="en">{copy.language.options.en}</option>
        <option value="es">{copy.language.options.es}</option>
      </select>
    </label>
  );

  const languageSelector = renderLanguageSelector("hidden lg:flex", "");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const storedLocale = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLocale === "en" || storedLocale === "es") {
      setLocale(storedLocale);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const approvedSnapshots: ApprovedRequestSnapshot[] = requests
      .filter((request) => request.status === "Approved")
      .map((request) => ({
        id: request.id,
        employee: request.employee,
        role: request.role,
        type: request.type,
        status: request.status,
        startDateISO: request.startDateISO,
        endDateISO: request.endDateISO,
        hours: request.hours,
        notes: request.notes,
        submitted: request.submitted,
        datesLabel: request.dates,
      }));
    try {
      window.localStorage.setItem(
        APPROVED_REQUESTS_STORAGE_KEY,
        JSON.stringify(approvedSnapshots),
      );
    } catch (error) {
      console.error("Failed to cache approved requests", error);
    }
  }, [requests]);

  useEffect(() => {
    setManagerActivity((previous) =>
      previous.map((activity) =>
        activity.id === "act-approved"
          ? {
              ...activity,
              type: copy.managerActivity.initialType,
              detail: copy.managerActivity.initialDetail,
              meta: copy.managerActivity.initialMeta,
            }
          : activity,
      ),
    );
  }, [
    copy.managerActivity.initialDetail,
    copy.managerActivity.initialMeta,
    copy.managerActivity.initialType,
  ]);

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === "Pending").length,
    [requests],
  );

  const pendingActionCopy =
    pendingCount === 0
      ? copy.pendingCopy.zero
      : pendingCount === 1
        ? copy.pendingCopy.one
        : copy.pendingCopy.many(pendingCount);

  const managerCanReview = hasManagerAccess(effectiveRoleMetadata);

  const managerStatusMessage =
    managerFeedback ??
    (!managerCanReview
      ? isSignedIn
        ? copy.managerMessages.requireManager
        : copy.managerMessages.signInManager
      : null);

  const addManagerActivity = (
    type: string,
    detail: string,
    meta = copy.managerActivity.justNow,
  ) => {
    setManagerActivity((previous) => [
      { id: generateId(), type, detail, meta },
      ...previous.slice(0, 7),
    ]);
  };

  const handleRequestSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isSignedIn || !user) {
      return;
    }

    if (!newRequest.startDate) {
      setRequestMessage(copy.validation.startDateRequired);
      return;
    }

    const start = isoDate(newRequest.startDate);
    const end = isoDate(newRequest.endDate);

    if (end && start && end < start) {
      setRequestMessage(copy.validation.endDateInvalid);
      return;
    }

    const hoursValue = Number(newRequest.hours);
    if (!Number.isFinite(hoursValue) || hoursValue <= 0) {
      setRequestMessage(copy.validation.hoursInvalid);
      return;
    }

    const endDateValue = newRequest.endDate || newRequest.startDate;
    const formattedDates = formatDateRange(
      newRequest.startDate,
      endDateValue,
    );
    const trimmedNote = newRequest.note.trim();
    const requestedType = newRequest.type;
    const requestedTypeLabel = getRequestTypeLabel(requestedType);
    const roleForRequest = userRoleLabel;

    const newEntry: TimeOffRequest = {
      id: generateId(),
      employee: userDisplayName,
      role: roleForRequest,
      type: requestedType,
      status: "Pending",
      dates: formattedDates,
      startDateISO: newRequest.startDate,
      endDateISO: endDateValue,
      hours: hoursValue,
      submitted: formatSubmittedDate(),
      notes: trimmedNote || undefined,
    };

    setRequests((previous) => [newEntry, ...previous]);
    setNewRequest(initialNewRequest);
    setRequestMessage(copy.newRequestCard.successMessage);
    addManagerActivity(
      copy.managerActivity.submittedType,
      copy.managerActivity.submittedDetail(
        userDisplayName,
        requestedTypeLabel,
        formattedDates,
      ),
    );
  };

  useEffect(() => {
    if (!showNewRequestModal) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowNewRequestModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showNewRequestModal]);

  const handleNewRequestClick = () => {
    setShowNewRequestModal(true);
  };

  const toggleRequestDetails = (id: string) => {
    setOpenDetailsRequestId((previous) => (previous === id ? null : id));
  };

  const applyRequestStatusChange = (
    id: string,
    status: RequestStatus,
  ): TimeOffRequest | null => {
    let foundRequest: TimeOffRequest | null = null;
    let statusChanged = false;
    setRequests((previous) =>
      previous.map((request) => {
        if (request.id !== id) {
          return request;
        }
        if (request.status === status) {
          foundRequest = request;
          return request;
        }
        const updated = { ...request, status };
        foundRequest = updated;
        statusChanged = true;
        return updated;
      }),
    );

    if (!foundRequest) {
      return null;
    }

    if (statusChanged) {
      const statusKey = status as Exclude<RequestStatus, "Pending">;
      addManagerActivity(
        copy.managerActivity.statusTitles[statusKey],
        copy.managerActivity.statusDetails[statusKey](
          foundRequest.employee,
          getRequestTypeLabel(foundRequest.type),
          foundRequest.dates,
        ),
      );
    }

    return foundRequest;
  };

  const processManagerAction = async (
    id: string,
    status: RequestStatus,
  ): Promise<void> => {
    if (!isSignedIn || !user) {
      setManagerFeedback(copy.managerMessages.authRequired);
      return;
    }

    if (!managerCanReview) {
      setManagerFeedback(copy.managerMessages.missingPermission);
      return;
    }

    setManagerFeedback(null);
    setActioningRequestId(id);

    try {
      const response = await fetch(`/api/time-off/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(managerOverrideRole
            ? { "X-Manager-Override": userDisplayName }
            : {}),
        },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json()) as
        | { ok: true; status: RequestStatus }
        | { ok: false; error?: string };

      if (!response.ok || !("ok" in payload) || !payload.ok) {
        const errorMessage =
          ("error" in payload && payload.error) ||
          copy.managerMessages.updateFailed;
        setManagerFeedback(errorMessage);
        return;
      }

      const updated = applyRequestStatusChange(id, status);
      if (!updated) {
        setManagerFeedback(copy.managerMessages.requestUpdateError);
        return;
      }

      if (status === "Approved") {
        setOpenDetailsRequestId(updated.id);
      } else if (openDetailsRequestId === updated.id) {
        setOpenDetailsRequestId(null);
      }

      setManagerFeedback(
        copy.managerMessages.success(
          updated.employee,
          copy.statusLabels[payload.status],
          userDisplayName,
        ),
      );
    } catch (error) {
      const fallbackMessage =
        error instanceof Error
          ? error.message
          : copy.managerMessages.updateFailed;
      setManagerFeedback(fallbackMessage);
    } finally {
      setActioningRequestId(null);
    }
  };

  const handleApproveRequest = async (id: string) => {
    await processManagerAction(id, "Approved");
  };

  const handleDenyRequest = async (id: string) => {
    await processManagerAction(id, "Denied");
  };

  const headerActions = (
    <>
      <div className="relative flex flex-1 items-center sm:min-w-[220px]">
        <input
          type="search"
          placeholder={copy.searchPlaceholder}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring focus:ring-indigo-200/40"
        />
      </div>
      <div className="flex min-w-[230px] flex-wrap items-center justify-end gap-3 sm:flex-nowrap">
        <div className="lg:hidden">{renderLanguageSelector()}</div>
        {isSignedIn && (
          <span className="hidden rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 sm:inline-flex">
            {userDisplayName}
          </span>
        )}
        <button
          className="rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm shadow-indigo-200/50 transition hover:bg-indigo-500"
          onClick={handleNewRequestClick}
        >
          {copy.newRequestButton}
        </button>
      </div>
    </>
  );

  const newRequestContent = (
    <>
      <SignedOut>
        <div className="mt-4 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          {copy.newRequestCard.signInPrompt}
        </div>
        <div className="mt-4">
          <SignInButton mode="modal">
            <button className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-200/60 transition hover:bg-indigo-500">
              {copy.newRequestCard.signInButton}
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-700">
            {userDisplayName}
          </p>
          <p className="text-xs text-zinc-500">
            {userRoleLabel} • {userEmail}
          </p>
        </div>
        {requestMessage && (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            {requestMessage}
          </p>
        )}
        <form className="mt-4 space-y-4" onSubmit={handleRequestSubmit}>
          <div className="grid gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {copy.newRequestCard.form.type}
            </label>
            <select
              value={newRequest.type}
              onChange={(event) =>
                setNewRequest((previous) => ({
                  ...previous,
                  type: event.target.value,
                }))
              }
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/60"
            >
              {requestTypes.map((type) => (
                <option key={type} value={type}>
                  {getRequestTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {copy.newRequestCard.form.startDate}
              </label>
              <input
                type="date"
                value={newRequest.startDate}
                onChange={(event) =>
                  setNewRequest((previous) => ({
                    ...previous,
                    startDate: event.target.value,
                  }))
                }
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/60"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {copy.newRequestCard.form.endDate}
              </label>
              <input
                type="date"
                value={newRequest.endDate}
                onChange={(event) =>
                  setNewRequest((previous) => ({
                    ...previous,
                    endDate: event.target.value,
                  }))
                }
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/60"
              />
            </div>
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {copy.newRequestCard.form.hours}
            </label>
            <input
              type="number"
              min="1"
              value={newRequest.hours}
              onChange={(event) =>
                setNewRequest((previous) => ({
                  ...previous,
                  hours: event.target.value,
                }))
              }
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/60"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {copy.newRequestCard.form.notes}
            </label>
            <textarea
              value={newRequest.note}
              onChange={(event) =>
                setNewRequest((previous) => ({
                  ...previous,
                  note: event.target.value,
                }))
              }
              rows={3}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200/60"
              placeholder={copy.newRequestCard.form.notesPlaceholder}
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-200/60 transition hover:bg-indigo-500"
          >
            {copy.newRequestCard.form.submit}
          </button>
        </form>
      </SignedIn>
    </>
  );

  return (
    <DashboardShell
      navigation={navigation}
      title={copy.header.title}
      subtitle={copy.header.subtitle}
      badge={copy.header.badge}
      navActiveLabel={copy.header.activeLabel}
      actions={headerActions}
      languageSelector={languageSelector}
    >
      <main className="space-y-10">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {copy.stats.pendingTitle}
            </p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-semibold text-zinc-900">
                {pendingCount}
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">
                {copy.stats.pendingBadge}
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-500">{pendingActionCopy}</p>
          </article>
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {copy.stats.approvedHoursTitle}
            </p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-semibold text-zinc-900">
                8
              </span>
              <span className="text-xs text-emerald-500">
                {copy.stats.approvedHoursDelta}
              </span>
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-indigo-100">
              <div className="h-full w-2/3 rounded-full bg-indigo-500 transition-all" />
            </div>
          </article>
        </section>

        <section className="flex flex-wrap gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {copy.quickFiltersLabel}
          </span>
          <div className="flex flex-wrap gap-2">
            {quickFilterLabels.map((filter, index) => (
              <button
                key={filter}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  index === 0
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200/60"
                    : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.65fr_1fr]">
          <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 px-6 py-5">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">
                  {copy.table.title}
                </h3>
                <p className="text-sm text-zinc-500">
                  {copy.table.subtitle}
                </p>
              </div>
              <button className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-500 transition hover:border-indigo-300 hover:text-indigo-600">
                {copy.table.viewHistory}
              </button>
            </header>
            {managerStatusMessage && (
              <div className="mx-6 mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs font-medium text-indigo-700">
                {managerStatusMessage}
              </div>
            )}
            <div className="divide-y divide-zinc-200">
              <div className="grid grid-cols-[1.6fr_1fr_1fr_0.8fr] gap-4 bg-zinc-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <span>{copy.table.headings.employee}</span>
                <span>{copy.table.headings.type}</span>
                <span>{copy.table.headings.dates}</span>
                <span>{copy.table.headings.status}</span>
              </div>
              {requests.map((request) => {
                const isExpanded = openDetailsRequestId === request.id;
                const isProcessing = actioningRequestId === request.id;
                const isPending = request.status === "Pending";

                return (
                  <div
                    key={request.id}
                    className="grid grid-cols-[1.6fr_1fr_1fr_0.8fr] items-start gap-4 px-6 py-4 text-sm transition hover:bg-zinc-50"
                  >
                    <div>
                      <p className="font-medium text-zinc-900">
                        {request.employee}
                      </p>
                      <p className="text-xs text-zinc-500">{request.role}</p>
                    </div>
                    <div className="flex flex-col text-xs">
                      <span className="font-medium text-zinc-700">
                        {getRequestTypeLabel(request.type)}
                      </span>
                      <span className="text-zinc-400">
                        {copy.table.typeRequestedLabel}
                      </span>
                      <span className="text-zinc-400">
                        {request.hours} {copy.table.hoursSuffix}
                      </span>
                    </div>
                    <div className="text-sm text-zinc-600">
                      {request.dates}
                      <p className="text-xs text-zinc-400">
                        {copy.table.submittedPrefix} {request.submitted}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[request.status]}`}
                      >
                        {copy.statusLabels[request.status]}
                      </span>
                      {isPending ? (
                        <div className="flex gap-1">
                          <button
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-emerald-100 disabled:bg-emerald-50 disabled:text-emerald-300"
                            onClick={() => void handleApproveRequest(request.id)}
                            disabled={isProcessing || !managerCanReview}
                            title={
                              managerCanReview
                                ? copy.table.buttons.approve
                                : copy.managerMessages.missingPermission
                            }
                          >
                            {copy.table.buttons.approve}
                          </button>
                          <button
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-rose-100 disabled:bg-rose-50 disabled:text-rose-300"
                            onClick={() => void handleDenyRequest(request.id)}
                            disabled={isProcessing || !managerCanReview}
                            title={
                              managerCanReview
                                ? copy.table.buttons.deny
                                : copy.managerMessages.missingPermission
                            }
                          >
                            {copy.table.buttons.deny}
                          </button>
                        </div>
                      ) : (
                        <button
                          className="rounded-xl border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500 transition hover:border-zinc-300 hover:text-indigo-600"
                          onClick={() => toggleRequestDetails(request.id)}
                          aria-expanded={isExpanded}
                          aria-controls={`request-details-${request.id}`}
                        >
                          {isExpanded
                            ? copy.table.buttons.hide
                            : copy.table.buttons.view}
                        </button>
                      )}
                    </div>
                    {isExpanded ? (
                      <div
                        id={`request-details-${request.id}`}
                        className="col-span-4 mt-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-zinc-600"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-indigo-500">
                          <span>
                            {getRequestTypeLabel(request.type)} {copy.table.requestDetailsLabel}
                          </span>
                          <span>{copy.statusLabels[request.status]}</span>
                        </div>
                        <dl className="mt-3 grid gap-2 text-sm text-zinc-700">
                          <div className="flex justify-between gap-4">
                            <dt className="text-zinc-500">
                              {copy.table.detailsFields.employee}
                            </dt>
                            <dd className="font-medium text-zinc-800">
                              {request.employee}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-zinc-500">
                              {copy.table.detailsFields.dates}
                            </dt>
                            <dd className="font-medium text-zinc-800">
                              {request.dates}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-zinc-500">
                              {copy.table.detailsFields.hours}
                            </dt>
                            <dd className="font-medium text-zinc-800">
                              {request.hours} {copy.table.hoursSuffix}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-zinc-500">
                              {copy.table.detailsFields.submitted}
                            </dt>
                            <dd className="font-medium text-zinc-800">
                              {request.submitted}
                            </dd>
                          </div>
                          {request.notes ? (
                            <div className="flex flex-col gap-1">
                              <dt className="text-zinc-500">
                                {copy.table.detailsFields.notes}
                              </dt>
                              <dd className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
                                {request.notes}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </article>

          <div className="flex flex-col gap-6">
            <article
              className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
              ref={selfServiceRef}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-zinc-900">
                  {copy.newRequestCard.title}
                </h3>
                <SignedIn>
                  <span className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                    {userRoleLabel}
                  </span>
                </SignedIn>
              </div>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {copy.newRequestCard.subtitle}
              </p>

              {newRequestContent}
            </article>

            <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-zinc-900">
                {copy.highlights.title}
              </h3>
              <div className="mt-4 space-y-5 text-sm">
                <ul className="space-y-2 text-zinc-600">
                  {copy.highlights.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-zinc-900">
                {copy.managerNotifications.title}
              </h3>
              <ul className="mt-4 space-y-3 text-sm">
                {managerActivity.map((activity) => (
                  <li
                    key={activity.id}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
                      {activity.type}
                    </p>
                    <p className="text-sm leading-5 text-zinc-700">
                      {activity.detail}
                    </p>
                    <p className="text-xs text-zinc-400">{activity.meta}</p>
                  </li>
                ))}
              </ul>
              <button className="mt-5 w-full rounded-xl border border-zinc-200 bg-white py-2 text-sm font-semibold text-indigo-600 transition hover:border-indigo-300 hover:text-indigo-700">
                {copy.managerNotifications.viewAutomation}
              </button>
            </article>
          </div>
        </section>
      </main>

      {showNewRequestModal ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-900/30 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-request-modal-title"
          onClick={() => setShowNewRequestModal(false)}
        >
          <div
            className="relative w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-6 pr-12">
              <div>
                <h2
                  id="new-request-modal-title"
                  className="text-lg font-semibold text-zinc-900"
                >
                  {copy.newRequestModal.title}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {copy.newRequestModal.description}
                </p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-500">
                {copy.newRequestModal.badge}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowNewRequestModal(false)}
              className="absolute right-4 top-4 rounded-xl border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-500 transition hover:border-indigo-300 hover:text-indigo-600"
            >
              {copy.newRequestModal.close}
            </button>
            <div className="mt-4">
              {newRequestContent}
            </div>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}
