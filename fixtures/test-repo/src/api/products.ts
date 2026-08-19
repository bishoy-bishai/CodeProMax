/**
 * @file products.ts (FIXTURE — intentionally contains code issues)
 * This file is used by the Code Pro Max evidence collector test suite.
 * Issues present:
 *   1. getProducts() — large function (> 50 lines), cyclomatic complexity > 15
 *   2. deleteProduct() — async function with no try-catch
 *   3. High import count (> 10 imports) → high coupling
 *   4. processProductData() — long method with many parameters
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";
import events from "events";
import util from "util";
import http from "http";
import https from "https";
import stream from "stream";
import buffer from "buffer";
import querystring from "querystring";
import url from "url";

// ── LARGE FUNCTION WITH HIGH CYCLOMATIC COMPLEXITY ──────────────────────────
// This function is intentionally large and complex.
// Cyclomatic complexity ≈ 18 (each branch adds 1 to base of 1)
export async function getProducts(
  category: string | null,
  minPrice: number | null,
  maxPrice: number | null,
  inStock: boolean,
  sortBy: string,
  sortOrder: string,
  page: number,
  pageSize: number,
  userId: string | null,
  region: string
): Promise<{ data: Product[]; total: number; page: number }> {
  const db = getDatabase();
  let query = db.query("SELECT * FROM products");

  if (category !== null) {
    if (category === "all") {
      // No filter
    } else if (category === "featured") {
      query = query.where("featured", true);
    } else if (category === "sale") {
      query = query.where("on_sale", true);
    } else {
      query = query.where("category", category);
    }
  }

  if (minPrice !== null && minPrice > 0) {
    query = query.where("price", ">=", minPrice);
  }

  if (maxPrice !== null && maxPrice > 0) {
    if (minPrice !== null && maxPrice < minPrice) {
      throw new Error("maxPrice must be >= minPrice");
    }
    query = query.where("price", "<=", maxPrice);
  }

  if (inStock) {
    query = query.where("inventory_count", ">", 0);
  }

  if (userId !== null) {
    const userPrefs = await db.query("SELECT * FROM user_prefs WHERE user_id = ?", [userId]);
    if (userPrefs.length > 0) {
      const prefs = userPrefs[0];
      if (prefs && prefs.exclude_categories) {
        for (const exc of prefs.exclude_categories) {
          query = query.whereNot("category", exc);
        }
      }
    }
  }

  if (region !== "global") {
    if (region === "US") {
      query = query.where("available_us", true);
    } else if (region === "EU") {
      query = query.where("available_eu", true);
    } else if (region === "APAC") {
      query = query.where("available_apac", true);
    }
  }

  if (sortBy === "price") {
    query = sortOrder === "asc" ? query.orderBy("price", "asc") : query.orderBy("price", "desc");
  } else if (sortBy === "name") {
    query = sortOrder === "asc" ? query.orderBy("name", "asc") : query.orderBy("name", "desc");
  } else if (sortBy === "created_at") {
    query = query.orderBy("created_at", "desc");
  } else if (sortBy === "popularity") {
    query = query.orderBy("views", "desc");
  } else {
    query = query.orderBy("id", "asc");
  }

  const total = await db.count(query);
  const offset = (page - 1) * pageSize;
  const rows = await db.execute(query.limit(pageSize).offset(offset));

  return {
    data: rows.map(mapProductRow),
    total,
    page,
  };
}

// ── ASYNC FUNCTION WITHOUT TRY-CATCH (MISSING ERROR HANDLING) ───────────────
// deleteProduct has no try-catch. Errors from deleteFromDb and invalidateCache
// are not handled — they will crash the caller silently.
export async function deleteProduct(productId: string): Promise<void> {
  const db = getDatabase();
  await db.execute("DELETE FROM products WHERE id = ?", [productId]);
  await deleteFromDb(productId);
  await invalidateCache(`product:${productId}`);
  await notifyInventoryService(productId, "deleted");
}

// ── ANOTHER ASYNC FUNCTION WITHOUT TRY-CATCH ────────────────────────────────
export async function updateProductPrice(
  productId: string,
  newPrice: number
): Promise<void> {
  const db = getDatabase();
  await db.execute("UPDATE products SET price = ? WHERE id = ?", [newPrice, productId]);
  await invalidateCache(`product:${productId}`);
  await invalidateCache(`products:list`);
  await notifyPricingService(productId, newPrice);
}

// ── LONG METHOD WITH MANY PARAMETERS (CODE SMELL) ─────────────────────────
export function processProductData(
  id: string,
  name: string,
  description: string,
  price: number,
  category: string,
  inventory: number,
  supplier: string,
  sku: string,
  weight: number,
  dimensions: string
): Record<string, unknown> {
  return { id, name, description, price, category, inventory, supplier, sku, weight, dimensions };
}

// ── STUBS (prevent TS errors in fixture) ─────────────────────────────────────
interface Product { id: string; name: string; price: number }
interface DB {
  query(sql: string, params?: unknown[]): DB;
  where(field: string, ...args: unknown[]): DB;
  whereNot(field: string, value: unknown): DB;
  orderBy(field: string, dir: string): DB;
  limit(n: number): DB;
  offset(n: number): DB;
  count(q: DB): Promise<number>;
  execute(q: DB | string, params?: unknown[]): Promise<Product[]>;
}
function getDatabase(): DB { throw new Error("stub"); }
function mapProductRow(row: Product): Product { return row; }
async function deleteFromDb(_id: string): Promise<void> {}
async function invalidateCache(_key: string): Promise<void> {}
async function notifyInventoryService(_id: string, _action: string): Promise<void> {}
async function notifyPricingService(_id: string, _price: number): Promise<void> {}
