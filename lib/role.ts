// Single source of truth for "what role is making this request" — for now backed by a
// client-sent header instead of a real session. Swapping in real auth later means
// changing getRoleFromHeaders' implementation (e.g. read a verified session/JWT instead
// of this header) — every call site and every permission check stays the same.

export type Role = "content_writer" | "manager";

export const ROLES: Role[] = ["content_writer", "manager"];

export const ROLE_HEADER = "x-koya-role";

export const DEFAULT_ROLE: Role = "content_writer";

export const ROLE_LABEL: Record<Role, string> = {
  content_writer: "Content Writer",
  manager: "Manager",
};

export function isRole(value: unknown): value is Role {
  return value === "content_writer" || value === "manager";
}

export function getRoleFromHeaders(headers: Headers): Role {
  const value = headers.get(ROLE_HEADER);
  return isRole(value) ? value : DEFAULT_ROLE;
}
