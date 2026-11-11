import type { NextRequest } from "next/server";

/**
 * Прокси браузер → API. Браузер ходит только на свой origin: cookie сессии
 * остаётся HttpOnly + SameSite, CORS не нужен, а адрес API читается из окружения
 * при каждом запросе — один образ работает в любом окружении.
 */
const FORWARDED_HEADERS = ["cookie", "content-type", "idempotency-key"];
const MAX_BODY_BYTES = 100_000;

async function forward(
  request: NextRequest,
  context: RouteContext<"/api/[...path]">,
) {
  const { path } = await context.params;
  const target = `${process.env.API_URL ?? "http://localhost:4000"}/api/${path
    .map(encodeURIComponent)
    .join("/")}${request.nextUrl.search}`;

  // Тело читается в память, поэтому большие запросы отсекаются до чтения.
  const bodyLength = Number(request.headers.get("content-length") ?? 0);
  if (bodyLength > MAX_BODY_BYTES) {
    return Response.json(
      { statusCode: 413, message: "Слишком большой запрос." },
      { status: 413 },
    );
  }

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: bodyLength > 0 ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return Response.json(
      {
        statusCode: 502,
        message: "Сервер данных недоступен. Повторите попытку позже.",
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers({
    "content-type": upstream.headers.get("content-type") ?? "application/json",
    "cache-control": "no-store",
  });
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", cookie);
  }
  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export { forward as GET, forward as PATCH, forward as POST };
