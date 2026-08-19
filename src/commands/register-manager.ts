/**
 * @file register-manager.ts
 * @description Persists and loads the InitiativeRegister.
 *
 * The register.json file is the single source of truth — it round-trips
 * losslessly through parseInitiativeRegister/serializeInitiativeRegister
 * (src/schemas/validators.ts). initiative-register.md is a generated,
 * human-readable summary regenerated on every save; it is never parsed back,
 * so Markdown formatting choices can never cause data loss.
 */

import type { Initiative, InitiativeId, InitiativeRegister } from "../schemas/types.ts";
import { ValidationError } from "../schemas/types.ts";
import {
  deserializeInitiativeRegister,
  filterInitiatives,
  recomputeStats,
  serializeInitiativeRegister,
} from "../schemas/validators.ts";
import type { FileManager } from "./file-manager.ts";
import { registerJsonPath, registerMarkdownPath } from "./paths.ts";

function emptyRegister(): InitiativeRegister {
  return {
    initiatives: [],
    stats: recomputeStats([]),
    lastUpdated: new Date().toISOString(),
  };
}

function renderRegisterMarkdown(register: InitiativeRegister): string {
  const rows = filterInitiatives(register, {}, "finalScore", "desc");
  const header = ["| ID | Name | Status | Score | Confidence | Owner |", "|---|---|---|---|---|---|"];
  const body = rows.map(
    (i) =>
      `| ${i.id} | ${i.name} | ${i.status} | ${i.scoring.finalScore}/100 | ${i.scoring.scoreConfidence} | ${i.owner} |`
  );
  const statusLines = Object.entries(register.stats.byStatus).map(([status, count]) => `- ${status}: ${count}`);

  return [
    "# Initiative Register",
    "",
    `_Last updated: ${register.lastUpdated}_`,
    "",
    `**Total initiatives:** ${register.stats.total}`,
    "",
    ...statusLines,
    "",
    ...header,
    ...body,
    "",
  ].join("\n");
}

export class RegisterManager {
  constructor(
    private readonly fileManager: FileManager,
    private readonly baseDir: string
  ) {}

  /** Build and persist a fresh register from a set of initiatives. */
  async create(initiatives: Initiative[]): Promise<InitiativeRegister> {
    const register: InitiativeRegister = {
      initiatives,
      stats: recomputeStats(initiatives),
      lastUpdated: new Date().toISOString(),
    };
    await this.save(register);
    return register;
  }

  /** Persist a register, writing both the JSON source of truth and the Markdown summary. */
  async save(register: InitiativeRegister): Promise<void> {
    const json = JSON.stringify(serializeInitiativeRegister(register), null, 2);
    await this.fileManager.write(registerJsonPath(this.baseDir), json);
    await this.fileManager.write(registerMarkdownPath(this.baseDir), renderRegisterMarkdown(register));
  }

  /** Load the register. Returns an empty register (never null) if none has been created yet. */
  async load(): Promise<InitiativeRegister> {
    const raw = await this.fileManager.read(registerJsonPath(this.baseDir));
    if (raw === null) return emptyRegister();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new ValidationError(`register.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`, [
        { field: "(root)", expected: "valid JSON", received: raw.slice(0, 200), suggestion: null },
      ]);
    }
    return deserializeInitiativeRegister(parsed);
  }

  /** Fetch a single initiative by ID, or null if not found. */
  async get(id: InitiativeId): Promise<Initiative | null> {
    const register = await this.load();
    return register.initiatives.find((i) => i.id === id) ?? null;
  }

  /** Load every initiative in the register. */
  async loadAll(): Promise<Initiative[]> {
    const register = await this.load();
    return register.initiatives;
  }

  /**
   * Replace (or append) a single initiative and persist the updated register.
   * Stats are recomputed automatically.
   */
  async update(initiative: Initiative): Promise<void> {
    const register = await this.load();
    const idx = register.initiatives.findIndex((i) => i.id === initiative.id);
    const initiatives =
      idx === -1
        ? [...register.initiatives, initiative]
        : register.initiatives.map((i, j) => (j === idx ? initiative : i));

    await this.save({
      initiatives,
      stats: recomputeStats(initiatives),
      lastUpdated: new Date().toISOString(),
    });
  }
}
