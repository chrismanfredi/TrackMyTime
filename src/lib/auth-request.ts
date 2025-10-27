import { cookies, headers } from "next/headers";
import type { RequestLike } from "@clerk/nextjs/dist/types/server/types";

export function buildClerkRequestLike(): RequestLike {
  const headerList = headers();
  const cookieStore = cookies();

  const headerMap = new Map<string, string[]>();
  headerList.forEach((value, key) => {
    headerMap.set(key, [value]);
  });

  return {
    headers: Object.fromEntries(headerMap),
    cookies: cookieStore,
  } as RequestLike;
}
