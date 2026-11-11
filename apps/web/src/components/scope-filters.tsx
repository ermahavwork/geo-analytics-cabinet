"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type Branch, type Company, type Paged, query } from "@/lib/api";
import { useUser } from "@/lib/session";
import { useFilters } from "@/lib/use-filters";
import { Select } from "./ui";

/** Выбранные компания и филиал из адресной строки (клиенту компания задана учётной записью). */
export function useScope() {
  const user = useUser();
  const { params } = useFilters();
  const companyId =
    user.role === "admin" ? params.get("company") : user.company!.id;
  // Филиал выбирается внутри компании: без неё параметр из адреса не учитывается.
  return { companyId, branchId: companyId ? params.get("branch") : null };
}

/** Список филиалов выбранной компании — для выпадающего списка и подписей. */
export function useBranches(companyId: string | null) {
  return useQuery({
    queryKey: ["branches", companyId],
    queryFn: () =>
      api<Paged<Branch>>(`/branches?${query({ companyId, limit: 200 })}`),
    enabled: Boolean(companyId),
  });
}

export function ScopeFilters() {
  const user = useUser();
  const { set } = useFilters();
  const { companyId, branchId } = useScope();

  const companies = useQuery({
    queryKey: ["companies"],
    queryFn: () => api<Company[]>("/companies"),
    enabled: user.role === "admin",
  });
  const branches = useBranches(companyId);

  return (
    <>
      {user.role === "admin" && (
        <Select
          label="Компания"
          value={companyId ?? ""}
          onChange={(event) =>
            set({
              company: event.target.value || null,
              branch: null,
              page: null,
            })
          }
        >
          <option value="">Все компании</option>
          {companies.data?.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </Select>
      )}
      <Select
        label="Филиал"
        value={branchId ?? ""}
        disabled={!companyId}
        title={companyId ? undefined : "Сначала выберите компанию"}
        onChange={(event) =>
          set({ branch: event.target.value || null, page: null })
        }
      >
        <option value="">
          {companyId ? "Все филиалы" : "Сначала выберите компанию"}
        </option>
        {branches.data?.items.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </Select>
    </>
  );
}
