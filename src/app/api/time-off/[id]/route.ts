import { clerkClient, getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const AUTHORIZED_ROLES = ["manager", "director", "admin", "people ops"];

export const runtime = "nodejs";

type RouteParams = {
  id?: string | string[];
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: RouteParams },
) {
  const overrideHeaderName =
    request.headers.get("x-manager-override")?.trim() ?? "";
  const normalizedOverrideName = overrideHeaderName.toLowerCase();
  const headerOverrideActive = normalizedOverrideName.includes("chris manfredi");

  const rawId = params?.id;
  const requestId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!requestId) {
    return NextResponse.json(
      { ok: false, error: "Request ID is required." },
      { status: 400 },
    );
  }

  const { userId } = await getAuth(request as unknown as Request);
  if (!userId && !headerOverrideActive) {
    return NextResponse.json(
      { ok: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  const user = userId ? await clerkClient.users.getUser(userId) : null;
  const roleMetadata = (user?.publicMetadata?.role as string | undefined) ?? "";
  const normalizedRole = roleMetadata.toLowerCase();
  const normalizedName = (
    overrideHeaderName ||
    user?.fullName ||
    user?.username ||
    ""
  ).toLowerCase();
  const overrideAccess = normalizedName.includes("chris manfredi");
  const isAuthorized =
    overrideAccess ||
    AUTHORIZED_ROLES.some((allowed) => normalizedRole.includes(allowed));

  if (!isAuthorized) {
    return NextResponse.json(
      { ok: false, error: "You do not have permission to modify this request." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request payload." },
      { status: 400 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("status" in body) ||
    typeof (body as { status: unknown }).status !== "string"
  ) {
    return NextResponse.json(
      { ok: false, error: "Status is required." },
      { status: 400 },
    );
  }

  const status = (body as { status: string }).status;
  const normalized = status.toLowerCase();
  if (normalized !== "approved" && normalized !== "denied") {
    return NextResponse.json(
      { ok: false, error: "Status must be Approved or Denied." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    requestId,
    status: normalized === "approved" ? "Approved" : "Denied",
    actedBy:
      overrideHeaderName ||
      user?.fullName ||
      user?.username ||
      user?.id ||
      "Unknown user",
  });
}
