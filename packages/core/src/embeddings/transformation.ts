import {
  MetadataMode,
  ModalityType,
  splitNodesByType,
} from "../schema/index.js";
import type { BaseNode, ImageNode, ImageType } from "../schema/node";
import { TransformComponent } from "../schema/type.js";
import {
  batchEmbeddings,
  type EmbeddingsByType,
  type ImageEmbedFunc,
  type TextEmbedFunc,
} from "./base.js";

/**
 * Creates a transformation that adds embeddings to nodes based on their modality type.
 *
 * @param embeddingFuncs - Map of modality type to embedding function
 * @returns A transformation component that adds embeddings to nodes
 *
 * @example
 * ```typescript
 * const pipeline = new IngestionPipeline({
 *   transformations: [
 *     new SentenceSplitter({ chunkSize: 1024 }),
 *     embeddings({
 *       [ModalityType.TEXT]: getOpenAIEmbedding("text-embedding-3-small"),
 *     }),
 *   ],
 * });
 * ```
 */
export function embeddings(
  embeddingFuncs: EmbeddingsByType,
): TransformComponent<Promise<BaseNode[]>> {
  return new TransformComponent(async (nodes: BaseNode[]) => {
    const nodeMap = splitNodesByType(nodes);

    for (const type in nodeMap) {
      const modalityType = type as ModalityType;
      const typeNodes = nodeMap[modalityType];
      if (!typeNodes || typeNodes.length === 0) continue;

      const embedFunc = embeddingFuncs[modalityType];
      if (!embedFunc) {
        throw new Error(
          `No embedding function provided for modality ${modalityType}. Pass embeddings with all required modalities.`,
        );
      }

      if (modalityType === ModalityType.TEXT) {
        const texts = typeNodes.map((n) => n.getContent(MetadataMode.EMBED));
        const embeddingResults = await batchEmbeddings(
          texts,
          embedFunc as TextEmbedFunc,
          10,
        );
        for (let i = 0; i < typeNodes.length; i++) {
          typeNodes[i]!.embedding = embeddingResults[i];
        }
      } else if (modalityType === ModalityType.IMAGE) {
        const images = typeNodes.map(
          (n) => (n as ImageNode).image as ImageType,
        );
        const embeddingResults = await batchEmbeddings(
          images,
          embedFunc as ImageEmbedFunc,
          10,
        );
        for (let i = 0; i < typeNodes.length; i++) {
          typeNodes[i]!.embedding = embeddingResults[i];
        }
      }
    }

    return nodes;
  });
}
