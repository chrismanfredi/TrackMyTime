"use server";

import { NextResponse } from "next/server";

import { syncCurrentUser } from "@/lib/users";

export async function POST() {
  const result = await syncCurrentUser();
  return NextResponse.json(result);
}
