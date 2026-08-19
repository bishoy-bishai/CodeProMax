/**
 * @file mcp-tools.test.ts
 * @description Validates the zod input schemas for each MCP tool: accepts
 * well-formed input, applies defaults, and rejects out-of-range/malformed
 * values the way the real CommandHandler would.
 */

import { describe, it, expect } from "vitest";
import {
  BuildInitiativeInputSchema,
  FindInitiativesInputSchema,
  GetStatusInputSchema,
  ReAnalyzeInputSchema,
  ReviewInitiativesInputSchema,
  TOOL_DESCRIPTIONS,
  UpdateInitiativeInputSchema,
} from "../mcp-tools.ts";

describe("FindInitiativesInputSchema", () => {
  it("accepts a minimal input and defaults num_initiatives to 5", () => {
    const result = FindInitiativesInputSchema.parse({});
    expect(result.num_initiatives).toBe(5);
    expect(result.repository_path).toBeUndefined();
  });

  it("accepts an explicit repository_path and num_initiatives", () => {
    const result = FindInitiativesInputSchema.parse({ repository_path: "/repo", num_initiatives: 3 });
    expect(result).toEqual({ repository_path: "/repo", num_initiatives: 3 });
  });

  it("rejects num_initiatives outside 1-10", () => {
    expect(() => FindInitiativesInputSchema.parse({ num_initiatives: 0 })).toThrow();
    expect(() => FindInitiativesInputSchema.parse({ num_initiatives: 11 })).toThrow();
  });

  it("rejects a non-integer num_initiatives", () => {
    expect(() => FindInitiativesInputSchema.parse({ num_initiatives: 2.5 })).toThrow();
  });

  it("does not expose analysis_depth, include_runtime_signals, or include_git_history", () => {
    expect(FindInitiativesInputSchema.shape).not.toHaveProperty("analysis_depth");
    expect(FindInitiativesInputSchema.shape).not.toHaveProperty("include_runtime_signals");
    expect(FindInitiativesInputSchema.shape).not.toHaveProperty("include_git_history");
  });
});

describe("BuildInitiativeInputSchema", () => {
  it("accepts a valid INIT-NNN id", () => {
    expect(BuildInitiativeInputSchema.parse({ initiative_id: "INIT-001" })).toEqual({ initiative_id: "INIT-001" });
  });

  it("rejects a malformed id", () => {
    expect(() => BuildInitiativeInputSchema.parse({ initiative_id: "not-an-id" })).toThrow();
  });

  it("rejects a missing id", () => {
    expect(() => BuildInitiativeInputSchema.parse({})).toThrow();
  });

  it("does not expose export_format", () => {
    expect(BuildInitiativeInputSchema.shape).not.toHaveProperty("export_format");
  });
});

describe("ReviewInitiativesInputSchema", () => {
  it("accepts an empty object and exposes no check_* toggles", () => {
    expect(ReviewInitiativesInputSchema.parse({})).toEqual({});
    expect(Object.keys(ReviewInitiativesInputSchema.shape)).toEqual([]);
  });
});

describe("ReAnalyzeInputSchema", () => {
  it("accepts an optional repository_path and no compare_to_previous flag", () => {
    expect(ReAnalyzeInputSchema.parse({})).toEqual({});
    expect(ReAnalyzeInputSchema.parse({ repository_path: "/repo" })).toEqual({ repository_path: "/repo" });
    expect(ReAnalyzeInputSchema.shape).not.toHaveProperty("compare_to_previous");
  });
});

describe("UpdateInitiativeInputSchema", () => {
  it("requires a valid initiative_id and accepts an optional repository_path", () => {
    expect(UpdateInitiativeInputSchema.parse({ initiative_id: "INIT-002" })).toEqual({ initiative_id: "INIT-002" });
    expect(() => UpdateInitiativeInputSchema.parse({})).toThrow();
  });

  it("does not expose recalculate_score", () => {
    expect(UpdateInitiativeInputSchema.shape).not.toHaveProperty("recalculate_score");
  });
});

describe("GetStatusInputSchema", () => {
  it("takes no parameters", () => {
    expect(GetStatusInputSchema.parse({})).toEqual({});
    expect(Object.keys(GetStatusInputSchema.shape)).toEqual([]);
  });
});

describe("TOOL_DESCRIPTIONS", () => {
  it("has one description per registered tool", () => {
    expect(Object.keys(TOOL_DESCRIPTIONS).sort()).toEqual(
      ["find_initiatives", "build_initiative", "review_initiatives", "re_analyze", "update_initiative", "get_status"].sort()
    );
  });

  it("every description is non-empty", () => {
    for (const desc of Object.values(TOOL_DESCRIPTIONS)) {
      expect(desc.length).toBeGreaterThan(20);
    }
  });
});
