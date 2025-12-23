/**
 * This example demonstrates setting up vector stores with custom embeddings
 * using @huggingface/transformers and Settings.embedFunc.
 */

import {
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
} from "@huggingface/transformers";
import type { VectorStoreByType } from "@vectorstores/core";
import {
  BaseEmbedding,
  ModalityType,
  SimpleVectorStore,
} from "@vectorstores/core";
import { path } from "@vectorstores/env";

// Model ID for CLIP
const MODEL_ID = "Xenova/clip-vit-base-patch32";

// Initialize models lazily
let visionModel: CLIPVisionModelWithProjection | null = null;
let processor: Awaited<
  ReturnType<typeof AutoProcessor.from_pretrained>
> | null = null;

async function getVisionModel() {
  if (!visionModel) {
    visionModel = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID);
  }
  return visionModel;
}

async function getProcessor() {
  if (!processor) {
    // @ts-expect-error - AutoProcessor types require 2 arguments
    processor = await AutoProcessor.from_pretrained(MODEL_ID);
  }
  return processor;
}

// Create a custom embedding class for CLIP image embeddings
class ClipImageEmbedding extends BaseEmbedding {
  async getImageEmbedding(imageUrl: string | URL): Promise<number[]> {
    const model = await getVisionModel();
    const proc = await getProcessor();

    const image = await RawImage.fromURL(imageUrl.toString());
    const imageInputs = await proc(image);
    const { image_embeds } = await model(imageInputs);

    return Array.from(image_embeds.data as Float32Array);
  }
}

// set up vector stores, one for text, the other for images
export async function getVectorStores(): Promise<VectorStoreByType> {
  return {
    [ModalityType.TEXT]: await SimpleVectorStore.fromPersistDir("storage"),
    [ModalityType.IMAGE]: await SimpleVectorStore.fromPersistDir(
      path.join("storage", "images"),
      new ClipImageEmbedding(),
    ),
  };
}
