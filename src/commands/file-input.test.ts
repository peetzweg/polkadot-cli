import { describe, expect, test } from "bun:test";
import { runCli } from "./__fixtures__/run-cli.ts";

// ---------------------------------------------------------------------------
// tx via file
// ---------------------------------------------------------------------------

describe("file input: tx", () => {
  test("--encode System.remark from JSON file", async () => {
    const { stdout, exitCode, stderr } = await runCli(["{{HOME}}/remark.json", "--encode"], {
      files: {
        "remark.json": JSON.stringify({
          tx: { System: { remark: ["0xdeadbeef"] } },
        }),
      },
    });
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("--encode System.remark from YAML file", async () => {
    const yaml = `
tx:
  System:
    remark:
      - "0xdeadbeef"
`;
    const { stdout, exitCode, stderr } = await runCli(["{{HOME}}/remark.yaml", "--encode"], {
      files: { "remark.yaml": yaml },
    });
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("--encode System.remark from .yml file", async () => {
    const yaml = `tx:\n  System:\n    remark:\n      - "0xcafe"\n`;
    const { stdout, exitCode, stderr } = await runCli(["{{HOME}}/remark.yml", "--encode"], {
      files: { "remark.yml": yaml },
    });
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("JSON and YAML produce the same encoded hex for same call", async () => {
    const jsonFile = JSON.stringify({
      tx: { System: { remark: ["0xdeadbeef"] } },
    });
    const yamlFile = `tx:\n  System:\n    remark:\n      - "0xdeadbeef"\n`;

    const [jsonResult, yamlResult] = await Promise.all([
      runCli(["{{HOME}}/remark.json", "--encode"], { files: { "remark.json": jsonFile } }),
      runCli(["{{HOME}}/remark.yaml", "--encode"], { files: { "remark.yaml": yamlFile } }),
    ]);

    expect(jsonResult.exitCode).toBe(0);
    expect(yamlResult.exitCode).toBe(0);
    expect(jsonResult.stdout).toBe(yamlResult.stdout);
  });

  test("--encode Balances.transfer_keep_alive from YAML with named args", async () => {
    const yaml = `
tx:
  Balances:
    transfer_keep_alive:
      dest: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
      value: 1000000000000
`;
    const { stdout, exitCode, stderr } = await runCli(["{{HOME}}/transfer.yaml", "--encode"], {
      files: { "transfer.yaml": yaml },
    });
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("--encode XcmPallet.teleport_assets with complex nested types", async () => {
    const yaml = `
tx:
  XcmPallet:
    teleport_assets:
      dest:
        type: V5
        value:
          parents: 0
          interior:
            type: X1
            value:
              - type: Parachain
                value: 1000
      beneficiary:
        type: V5
        value:
          parents: 0
          interior:
            type: X1
            value:
              - type: AccountId32
                value:
                  network: null
                  id: "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d"
      assets:
        type: V5
        value:
          - id:
              parents: 0
              interior:
                type: Here
            fun:
              type: Fungible
              value: 1000000000000
      fee_asset_item: 0
`;
    const { stdout, exitCode, stderr } = await runCli(["{{HOME}}/xcm.yaml", "--encode"], {
      files: { "xcm.yaml": yaml },
    });
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("chain field is used from file", async () => {
    const yaml = `
chain: polkadot
tx:
  System:
    remark:
      - "0xaa"
`;
    const { stdout, exitCode, stderr } = await runCli(["{{HOME}}/with-chain.yaml", "--encode"], {
      files: { "with-chain.yaml": yaml },
    });
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("--chain flag overrides file chain", async () => {
    const yaml = `
chain: nonexistent-chain
tx:
  System:
    remark:
      - "0xaa"
`;
    // Use --chain polkadot to override the invalid chain in the file
    const { stdout, exitCode, stderr } = await runCli(
      ["{{HOME}}/override.yaml", "--chain", "polkadot", "--encode"],
      { files: { "override.yaml": yaml } },
    );
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });
});

// ---------------------------------------------------------------------------
// Variable substitution
// ---------------------------------------------------------------------------

describe("file input: variables", () => {
  test("--var substitutes in file values", async () => {
    const yaml = `
tx:
  System:
    remark:
      - "\${DATA}"
`;
    const { stdout, exitCode, stderr } = await runCli(
      ["{{HOME}}/var.yaml", "--var", "DATA=0xbeef", "--encode"],
      { files: { "var.yaml": yaml } },
    );
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("vars section provides defaults", async () => {
    const yaml = `
vars:
  DATA: "0xcafe"
tx:
  System:
    remark:
      - "\${DATA}"
`;
    const { stdout, exitCode, stderr } = await runCli(["{{HOME}}/varsdefault.yaml", "--encode"], {
      files: { "varsdefault.yaml": yaml },
    });
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("--var overrides vars section", async () => {
    const yaml = `
vars:
  DATA: "0xbeef"
tx:
  System:
    remark:
      - "\${DATA}"
`;
    // Both should produce valid hex, but with different data
    const [withDefault, withOverride] = await Promise.all([
      runCli(["{{HOME}}/d1.yaml", "--encode"], { files: { "d1.yaml": yaml } }),
      runCli(["{{HOME}}/d2.yaml", "--var", "DATA=0xcafe", "--encode"], {
        files: { "d2.yaml": yaml },
      }),
    ]);
    expect(withDefault.exitCode).toBe(0);
    expect(withOverride.exitCode).toBe(0);
    // Different data should produce different hex
    expect(withDefault.stdout).not.toBe(withOverride.stdout);
  });

  test("${VAR:-default} syntax works", async () => {
    const yaml = `
tx:
  System:
    remark:
      - "\${DATA:-0xdead}"
`;
    const { stdout, exitCode, stderr } = await runCli(["{{HOME}}/default.yaml", "--encode"], {
      files: { "default.yaml": yaml },
    });
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("environment variables are used as fallback", async () => {
    const yaml = `
tx:
  System:
    remark:
      - "\${TEST_FILE_INPUT_DATA}"
`;
    const { stdout, exitCode, stderr } = await runCli(["{{HOME}}/env.yaml", "--encode"], {
      files: { "env.yaml": yaml },
      env: { TEST_FILE_INPUT_DATA: "0xabcd" },
    });
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });

  test("multiple --var flags work", async () => {
    const yaml = `
chain: \${CHAIN:-polkadot}
tx:
  System:
    remark:
      - "\${DATA}"
`;
    const { stdout, exitCode, stderr } = await runCli(
      ["{{HOME}}/multi.yaml", "--var", "DATA=0xaa", "--var", "CHAIN=polkadot", "--encode"],
      { files: { "multi.yaml": yaml } },
    );
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe("file input: errors", () => {
  test("error on file not found", async () => {
    const { stderr, exitCode } = await runCli(["{{HOME}}/nonexistent.yaml"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("File not found");
  });

  test("error on missing category key", async () => {
    const { stderr, exitCode } = await runCli(["{{HOME}}/bad.yaml"], {
      files: { "bad.yaml": "chain: polkadot\n" },
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("category key");
  });

  test("error on undefined variable", async () => {
    const yaml = `
tx:
  System:
    remark:
      - "\${UNDEFINED_VAR}"
`;
    const { stderr, exitCode } = await runCli(["{{HOME}}/undef.yaml", "--encode"], {
      files: { "undef.yaml": yaml },
    });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Undefined variable");
  });

  test("error on invalid YAML", async () => {
    const { exitCode } = await runCli(["{{HOME}}/bad.yaml"], {
      files: { "bad.yaml": "tx:\n  System:\n    remark:\n  - bad indent" },
    });
    expect(exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Existing dot-path commands still work
// ---------------------------------------------------------------------------

describe("file input: does not break dot-path", () => {
  test("regular dot-path tx still works", async () => {
    const { stdout, exitCode } = await runCli(["tx.System.remark", "0xdeadbeef", "--encode"]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^0x[0-9a-f]+$/);
  });
});
