/**
 * Memory file system, used by edge runtime, worker runtime which doesn't have access to the file system.
 *
 * @module
 */
import { MemoryFsPromises } from "./memory-impl.js";

export function createWriteStream() {
  throw new Error("Not supported in this environment.");
}
export const fs = new MemoryFsPromises();
