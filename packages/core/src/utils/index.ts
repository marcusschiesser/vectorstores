import type { JSONValue } from "../global";
import type { NodeWithScore } from "../schema";
import { MetadataMode } from "../schema";

export const isPromise = <T>(obj: unknown): obj is Promise<T> => {
  return obj != null && typeof obj === "object" && "then" in obj;
};

export const isAsyncIterable = (
  obj: unknown,
): obj is AsyncIterable<unknown> => {
  return obj != null && typeof obj === "object" && Symbol.asyncIterator in obj;
};

export const isIterable = (obj: unknown): obj is Iterable<unknown> => {
  return obj != null && typeof obj === "object" && Symbol.iterator in obj;
};

export async function* streamCallbacks<S>(
  stream: AsyncIterable<S>,
  callbacks: {
    finished?: (value?: S) => void;
  },
): AsyncIterable<S> {
  let value: S | undefined;
  for await (value of stream) {
    yield value;
  }
  if (callbacks.finished) {
    callbacks.finished(value);
  }
}

export async function* streamReducer<S, D>(params: {
  stream: AsyncIterable<S>;
  reducer: (previousValue: D, currentValue: S) => D;
  initialValue: D;
  finished?: (value: D) => void;
}): AsyncIterable<S> {
  let value = params.initialValue;
  for await (const data of params.stream) {
    value = params.reducer(value, data);
    yield data;
  }
  if (params.finished) {
    params.finished(value);
  }
}

/**
 * Prettify an error for AI to read
 */
export function prettifyError(error: unknown): string {
  if (error instanceof Error) {
    return `Error(${error.name}): ${error.message}`;
  } else {
    return `${error}`;
  }
}

/**
 * Returns a stringfied JSON with double quotes removed.
 *
 * @param value - The JSON value to stringify
 * @returns The stringified JSON with no double quotes
 */
export function stringifyJSONToMessageContent(value: JSONValue): string {
  return JSON.stringify(value, null, 2).replace(/"([^"]*)"/g, "$1");
}

export function assertIsJSONValue(value: unknown): asserts value is JSONValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      assertIsJSONValue(item);
    }
    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const [key, val] of Object.entries(value)) {
      if (typeof key !== "string") {
        throw new Error(`Invalid object key: ${key}`);
      }
      assertIsJSONValue(val);
    }
    return;
  }

  throw new Error(`Value is not a valid JSONValue: ${String(value)}`);
}

/**
 * Formats an array of NodeWithScore objects into a string suitable for LLM consumption.
 * Extracts content from each node using MetadataMode.LLM and joins them with newlines.
 *
 * @param nodes - Array of nodes with scores from a retriever
 * @returns Joined content string, or empty string if no nodes
 */
export function formatLLM(nodes: NodeWithScore[]): string {
  if (nodes.length === 0) {
    return "";
  }
  return nodes
    .map((result) => result.node.getContent(MetadataMode.LLM))
    .join("\n");
}

export {
  extractDataUrlComponents,
  extractImage,
  extractSingleText,
  extractText,
} from "./llms";
export { objectEntries } from "./object-entries";
export * from "./stream";
