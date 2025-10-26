import { cookies, headers } from "next/headers";
import { getAuth } from "@clerk/nextjs/server";

export function buildClerkRequestLike(): Parameters<typeof getAuth>[0] {
  const headerList = headers();
  const cookieStore = cookies();

  return {
    headers: headerList,
    cookies: {
      get(name: string) {
        const cookie = cookieStore.get(name);
        return cookie ? { value: cookie.value } : undefined;
      },
    },
  };
}
