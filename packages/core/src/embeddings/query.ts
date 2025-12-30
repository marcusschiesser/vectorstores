import type {
  MessageContentDetail,
  MessageContentImageDataDetail,
  MessageContentImageTypeDetail,
  MessageContentTextDetail,
} from "../llms/type.js";
import type { EmbeddingsByType } from "./base.js";

/**
 * Calculates query embeddings based on the content detail and available embedding functions.
 *
 * @param item - The message content detail (text or image)
 * @param embeddings - Map of modality type to embedding function
 * @returns The query embedding as a number array, or null if no embedding could be calculated
 *
 * @example
 * ```typescript
 * const textItem: MessageContentTextDetail = {
 *   type: "text",
 *   text: "What did the author do in college?"
 * };
 *
 * const embeddings = {
 *   text: getOpenAIEmbedding("text-embedding-3-small"),
 * };
 *
 * const queryEmbedding = await calculateQueryEmbedding(textItem, embeddings);
 * ```
 */
export async function calculateQueryEmbedding(
  item: MessageContentDetail,
  embeddings: EmbeddingsByType,
): Promise<number[] | null> {
  // Handle text queries - always use TEXT embedFunc (required for CLIP multimodal search)
  if (item.type === "text" && "text" in item) {
    const textItem = item as MessageContentTextDetail;
    const textEmbedFunc = embeddings.text;
    if (!textEmbedFunc) {
      throw new Error(
        "No TEXT embedding function provided. Pass embeddings option to VectorStoreIndex.",
      );
    }
    const embeddingResults = await textEmbedFunc([textItem.text]);
    return embeddingResults[0] ?? null;
  }

  // Handle image_url queries
  if (item.type === "image_url" && "image_url" in item) {
    const imageEmbedFunc = embeddings.image;
    if (!imageEmbedFunc) {
      throw new Error(
        "No IMAGE embedding function provided. Pass embeddings option to VectorStoreIndex.",
      );
    }
    const embeddingResults = await imageEmbedFunc([item.image_url.url]);
    return embeddingResults[0] ?? null;
  }

  // Handle image_type queries
  if (item.type === "image_type" && "image" in item) {
    const imageTypeItem = item as MessageContentImageTypeDetail;
    const imageEmbedFunc = embeddings.image;
    if (!imageEmbedFunc) {
      throw new Error(
        "No IMAGE embedding function provided. Pass embeddings option to VectorStoreIndex.",
      );
    }
    const embeddingResults = await imageEmbedFunc([imageTypeItem.image]);
    return embeddingResults[0] ?? null;
  }

  // Handle image (base64 encoded) queries
  if (item.type === "image" && "data" in item) {
    const imageDataItem = item as MessageContentImageDataDetail;
    const imageEmbedFunc = embeddings.image;
    if (!imageEmbedFunc) {
      throw new Error(
        "No IMAGE embedding function provided. Pass embeddings option to VectorStoreIndex.",
      );
    }
    const embeddingResults = await imageEmbedFunc([imageDataItem.data]);
    return embeddingResults[0] ?? null;
  }

  return null;
}
