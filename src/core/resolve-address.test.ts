import { describe, expect, test } from "bun:test";
import { resolveAccountAddress } from "./resolve-address.ts";

describe("resolveAccountAddress", () => {
  test("resolves dev account name", async () => {
    const addr = await resolveAccountAddress("alice");
    expect(addr).toBe("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY");
  });

  test("is case-insensitive for dev accounts", async () => {
    const addr = await resolveAccountAddress("Alice");
    expect(addr).toBe("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY");
  });

  test("passes through valid SS58 address", async () => {
    const addr = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";
    expect(await resolveAccountAddress(addr)).toBe(addr);
  });

  test("passes through valid hex public key", async () => {
    const hex = "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d";
    expect(await resolveAccountAddress(hex)).toBe(hex);
  });

  test("throws for unknown name", async () => {
    await expect(resolveAccountAddress("nonexistent_xyz_42")).rejects.toThrow(
      /Unknown account or address/,
    );
  });

  test("throws for garbage input", async () => {
    await expect(resolveAccountAddress("!!!garbage!!!")).rejects.toThrow(
      /Unknown account or address/,
    );
  });
});
