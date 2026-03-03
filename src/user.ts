import { Role } from "./roles";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export function createUser(id: number, name: string, email: string, role: Role): User {
  return { id, name, email, role };
}

export function isAdministrator(user: User): boolean {
  return user.role === Role.Administrator;
}

export function isDriver(user: User): boolean {
  return user.role === Role.Driver;
}
