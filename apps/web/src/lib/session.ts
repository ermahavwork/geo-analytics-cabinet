"use client";

import { createContext, useContext } from "react";
import type { User } from "./api";

export const SessionContext = createContext<User | null>(null);

/** Текущий пользователь. Доступен на всех страницах кабинета. */
export function useUser(): User {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useUser вызван вне кабинета");
  return user;
}
