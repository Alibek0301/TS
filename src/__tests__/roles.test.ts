import { Role } from "../roles";
import { createUser, isAdministrator, isDriver } from "../user";
import { hasPermission, getPermissions } from "../permissions";

describe("Roles", () => {
  it("should have User, Administrator, and Driver roles", () => {
    expect(Role.User).toBe("user");
    expect(Role.Administrator).toBe("administrator");
    expect(Role.Driver).toBe("driver");
  });
});

describe("User", () => {
  it("should identify an administrator", () => {
    const admin = createUser(1, "Алибек", "admin@example.com", Role.Administrator);
    expect(isAdministrator(admin)).toBe(true);
    expect(isDriver(admin)).toBe(false);
  });

  it("should identify a driver", () => {
    const driver = createUser(2, "Иван", "driver@example.com", Role.Driver);
    expect(isDriver(driver)).toBe(true);
    expect(isAdministrator(driver)).toBe(false);
  });

  it("should identify a regular user", () => {
    const user = createUser(3, "Мария", "user@example.com", Role.User);
    expect(isAdministrator(user)).toBe(false);
    expect(isDriver(user)).toBe(false);
  });
});

describe("Permissions", () => {
  it("administrator has all permissions", () => {
    const admin = createUser(1, "Алибек", "admin@example.com", Role.Administrator);
    expect(hasPermission(admin, "manage_users")).toBe(true);
    expect(hasPermission(admin, "manage_transfers")).toBe(true);
    expect(hasPermission(admin, "manage_drivers")).toBe(true);
    expect(hasPermission(admin, "view_schedule")).toBe(true);
  });

  it("driver has driver-specific permissions", () => {
    const driver = createUser(2, "Иван", "driver@example.com", Role.Driver);
    expect(hasPermission(driver, "view_schedule")).toBe(true);
    expect(hasPermission(driver, "update_transfer_status")).toBe(true);
    expect(hasPermission(driver, "view_assigned_transfers")).toBe(true);
    expect(hasPermission(driver, "manage_users")).toBe(false);
  });

  it("regular user can only view schedule", () => {
    const user = createUser(3, "Мария", "user@example.com", Role.User);
    expect(hasPermission(user, "view_schedule")).toBe(true);
    expect(hasPermission(user, "manage_users")).toBe(false);
    expect(hasPermission(user, "update_transfer_status")).toBe(false);
  });

  it("getPermissions returns correct list for each role", () => {
    const admin = createUser(1, "Алибек", "admin@example.com", Role.Administrator);
    const driver = createUser(2, "Иван", "driver@example.com", Role.Driver);
    const user = createUser(3, "Мария", "user@example.com", Role.User);

    expect(getPermissions(admin)).toContain("manage_drivers");
    expect(getPermissions(driver)).toContain("update_transfer_status");
    expect(getPermissions(user)).toEqual(["view_schedule"]);
  });
});
