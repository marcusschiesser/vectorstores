import type { NodeWithScore, TextNode } from "@vectorstores/core";
import { ImageNode, MetadataMode } from "@vectorstores/core";

export interface FormatOptions {
  /** Max width for the text content column (default: 80) */
  maxTextWidth?: number;
  /** Whether to show the node ID (default: false) */
  showId?: boolean;
  /** Whether to show metadata (default: false) */
  showMetadata?: boolean;
}

/**
 * Truncates text to a maximum length, adding ellipsis if needed
 */
function truncate(text: string, maxLength: number): string {
  const sanitized = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  if (sanitized.length <= maxLength) return sanitized;
  return sanitized.slice(0, maxLength - 3) + "...";
}

/**
 * Formats a score as a percentage or dash if undefined
 */
function formatScore(score: number | undefined): string {
  if (score === undefined) return "-";
  return `${(score * 100).toFixed(2)}%`;
}

/**
 * Formats an array of NodeWithScore objects as a nicely formatted console table
 */
export function formatRetrieverResponse(
  results: NodeWithScore[],
  options: FormatOptions = {},
): string {
  const { maxTextWidth = 80, showId = false, showMetadata = false } = options;

  if (results.length === 0) {
    return "No results found.";
  }

  const rows = results.map((result, index) => {
    const node = result.node;
    const isImageNode = node instanceof ImageNode;

    const row: Record<string, string | number> = {
      "#": index + 1,
      Type: isImageNode ? "Image" : "Text",
      Score: formatScore(result.score),
    };

    if (isImageNode) {
      const imageNode = node as ImageNode;
      const imageUrl = imageNode.getUrl().toString();
      row["Content"] = imageUrl;
    } else {
      const textNode = node as TextNode;
      const text =
        textNode.text ?? textNode.getContent?.(MetadataMode.NONE) ?? "";
      row["Content"] = truncate(text, maxTextWidth);
    }

    if (showId) {
      row["ID"] = truncate(node.id_, 20);
    }

    if (showMetadata && Object.keys(node.metadata).length > 0) {
      row["Metadata"] = truncate(JSON.stringify(node.metadata), 40);
    }

    return row;
  });

  // Build the table manually for consistent formatting
  const firstRow = rows[0];
  if (!firstRow) {
    return "No results found.";
  }

  const columns = Object.keys(firstRow);
  const colWidths: Record<string, number> = {};

  // Calculate column widths
  for (const col of columns) {
    const headerWidth = col.length;
    const maxDataWidth = Math.max(...rows.map((r) => String(r[col]).length));
    colWidths[col] = Math.max(headerWidth, maxDataWidth);
  }

  // Build separator line
  const separator =
    "+" +
    columns.map((col) => "-".repeat((colWidths[col] ?? 0) + 2)).join("+") +
    "+";

  // Build header
  const header =
    "|" +
    columns.map((col) => ` ${col.padEnd(colWidths[col] ?? 0)} `).join("|") +
    "|";

  // Build rows
  const tableRows = rows.map(
    (row) =>
      "|" +
      columns
        .map((col) => ` ${String(row[col]).padEnd(colWidths[col] ?? 0)} `)
        .join("|") +
      "|",
  );

  return [
    "",
    `Found ${results.length} result${results.length > 1 ? "s" : ""}:`,
    "",
    separator,
    header,
    separator,
    ...tableRows,
    separator,
    "",
  ].join("\n");
}
