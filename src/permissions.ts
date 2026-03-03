import { Role } from "./roles";
import { User } from "./user";

const permissions: Record<Role, string[]> = {
  [Role.User]: ["view_schedule"],
  [Role.Administrator]: ["view_schedule", "manage_users", "manage_transfers", "manage_drivers"],
  [Role.Driver]: ["view_schedule", "update_transfer_status", "view_assigned_transfers"],
};

export function hasPermission(user: User, permission: string): boolean {
  return permissions[user.role].includes(permission);
}

export function getPermissions(user: User): string[] {
  return permissions[user.role];
}
