import {
  type BaseNode,
  type BaseReader,
  type Document,
  type Metadata,
  type ModalityType,
  splitNodesByType,
  type TransformComponent,
} from "../schema/index.js";
import type {
  BaseVectorStore,
  VectorStoreByType,
} from "../vector-store/index.js";
import { getTransformationHash, IngestionCache } from "./IngestionCache.js";
import {
  createDocStoreStrategy,
  DocStoreStrategy,
} from "./strategies/index.js";

type TransformRunArgs = {
  inPlace?: boolean;
  cache?: IngestionCache;
};

export async function runTransformations(
  nodesToRun: BaseNode<Metadata>[],
  transformations: TransformComponent[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformOptions: any = {},
  { inPlace = true, cache }: TransformRunArgs = {},
): Promise<BaseNode[]> {
  let nodes = nodesToRun;
  if (!inPlace) {
    nodes = [...nodesToRun];
  }
  for (const transform of transformations) {
    if (cache) {
      const hash = getTransformationHash(nodes, transform);
      const cachedNodes = await cache.get(hash);
      if (cachedNodes) {
        nodes = cachedNodes;
      } else {
        nodes = await transform(nodes, transformOptions);
        await cache.put(hash, nodes);
      }
    } else {
      nodes = await transform(nodes, transformOptions);
    }
  }
  return nodes;
}

export class IngestionPipeline {
  transformations: TransformComponent[] = [];
  documents?: Document[] | undefined;
  reader?: BaseReader | undefined;
  vectorStore?: BaseVectorStore | undefined;
  vectorStores?: VectorStoreByType | undefined;
  docStoreStrategy: DocStoreStrategy = DocStoreStrategy.UPSERTS;
  cache?: IngestionCache | undefined;
  disableCache: boolean = false;

  constructor(init?: Partial<IngestionPipeline>) {
    Object.assign(this, init);
    this.vectorStores =
      this.vectorStores ??
      (this.vectorStore ? { text: this.vectorStore } : undefined);
    if (!this.disableCache) {
      this.cache = new IngestionCache();
    }
  }

  async prepareInput(
    documents?: Document[],
    nodes?: BaseNode[],
  ): Promise<BaseNode[]> {
    const inputNodes: BaseNode[][] = [];
    if (documents) {
      inputNodes.push(documents);
    }
    if (nodes) {
      inputNodes.push(nodes);
    }
    if (this.documents) {
      inputNodes.push(this.documents);
    }
    if (this.reader) {
      // fixme: empty parameter might cause error
      inputNodes.push(await this.reader.loadData());
    }
    return inputNodes.flat();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async run(args: any = {}, transformOptions?: any): Promise<BaseNode[]> {
    args.cache = args.cache ?? this.cache;
    const inputNodes = await this.prepareInput(args.documents, args.nodes);
    const nodes = await runTransformations(
      inputNodes,
      this.transformations,
      transformOptions,
      { cache: args.cache },
    );
    if (this.vectorStores) {
      const nodesToAdd = nodes.filter((node) => node.embedding);
      await addNodesToVectorStores(
        nodesToAdd,
        this.vectorStores,
        this.docStoreStrategy,
      );
    }
    return nodes;
  }
}

/**
 * Add nodes to vector stores, with optional per-store deduplication.
 * Nodes are split by modality type and each type's nodes are deduplicated
 * against their respective vector store before being added.
 */
export async function addNodesToVectorStores(
  nodes: BaseNode<Metadata>[],
  vectorStores: VectorStoreByType,
  docStoreStrategy: DocStoreStrategy = DocStoreStrategy.NONE,
) {
  const nodeMap = splitNodesByType(nodes);

  for (const type in nodeMap) {
    let typeNodes = nodeMap[type as ModalityType];
    if (!typeNodes || typeNodes.length === 0) continue;

    const vectorStore = vectorStores[type as ModalityType];
    if (!vectorStore) {
      throw new Error(
        `Cannot insert nodes of type ${type} without assigned vector store`,
      );
    }

    // Apply deduplication strategy per store
    if (docStoreStrategy !== DocStoreStrategy.NONE) {
      const strategy = createDocStoreStrategy(docStoreStrategy, vectorStore);
      typeNodes = await strategy(typeNodes);
    }

    if (typeNodes.length > 0) {
      await vectorStore.add(typeNodes);
    }
  }
}
