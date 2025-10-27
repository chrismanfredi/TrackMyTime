import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { syncEmployeeForUser } from "@/lib/users";

export async function POST(request: NextRequest) {
  const { userId } = getAuth(request);
  if (!userId) {
    return NextResponse.json(
      { status: "error", message: "Not authenticated." },
      { status: 401 },
    );
  }

  const result = await syncEmployeeForUser(userId);
  return NextResponse.json(result);
}
