import { cookies, headers } from "next/headers";

export function buildClerkRequest(): Request {
  const headerList = headers();
  const cookieStore = cookies();

  const requestHeaders = new Headers(headerList as unknown as HeadersInit);

  const cookieEntries =
    typeof (cookieStore as { getAll?: unknown }).getAll === "function"
      ? ((cookieStore as unknown as { getAll: () => { name: string; value: string }[] }).getAll())
      : Array.from(cookieStore.entries()).map(([name, value]) => ({
          name,
          value: Array.isArray(value) ? value.join("") : value,
        }));

  const cookieString = cookieEntries
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  if (cookieString.length > 0) {
    requestHeaders.set("cookie", cookieString);
  }

  return new Request("https://clerk.request.local/", {
    headers: requestHeaders,
  });
}
