import { type NextRequest, NextResponse } from "next/server";

/**
 * Быстрая проверка до отрисовки: без cookie сессии в кабинет не пускаем.
 * Это удобство, а не защита — права проверяет API на каждом запросе.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("cabinet_session")) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!api|login|_next|icon.svg).*)"],
};
