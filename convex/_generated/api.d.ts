/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as charts from "../charts.js";
import type * as dev from "../dev.js";
import type * as documents from "../documents.js";
import type * as expenses from "../expenses.js";
import type * as fileAccess from "../fileAccess.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as ocr from "../ocr.js";
import type * as optimizer from "../optimizer.js";
import type * as reimbursements from "../reimbursements.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  charts: typeof charts;
  dev: typeof dev;
  documents: typeof documents;
  expenses: typeof expenses;
  fileAccess: typeof fileAccess;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  ocr: typeof ocr;
  optimizer: typeof optimizer;
  reimbursements: typeof reimbursements;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
