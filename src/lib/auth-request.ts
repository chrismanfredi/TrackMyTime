import { cookies, headers } from "next/headers";

export function buildClerkRequestLike() {
  const headerList = headers();
  const cookieStore = cookies();

  const headerMap = new Map<string, string[]>();
  const entries = headerList.entries();
  for (const [key, value] of entries) {
    headerMap.set(key, [value]);
  }

  return {
    headers: Object.fromEntries(headerMap),
    cookies: cookieStore,
  };
}
