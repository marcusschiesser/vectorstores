/**
 * This example demonstrates setting up vector stores with a unified multimodal
 * embedFunc using @huggingface/transformers and CLIP.
 */

import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
} from "@huggingface/transformers";
import type { ImageType, VectorStoreByType } from "@vectorstores/core";
import { ModalityType, SimpleVectorStore } from "@vectorstores/core";
import { path } from "@vectorstores/env";

const MODEL_ID = "Xenova/clip-vit-base-patch32";

// Lazy-loaded models
let visionModel: CLIPVisionModelWithProjection | null = null;
let textModel: CLIPTextModelWithProjection | null = null;
let processor: Awaited<
  ReturnType<typeof AutoProcessor.from_pretrained>
> | null = null;
let tokenizer: Awaited<
  ReturnType<typeof AutoTokenizer.from_pretrained>
> | null = null;

async function getVisionModel() {
  if (!visionModel) {
    visionModel = await CLIPVisionModelWithProjection.from_pretrained(
      MODEL_ID,
      { dtype: "q8" },
    );
  }
  return visionModel;
}

async function getTextModel() {
  if (!textModel) {
    textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, {
      dtype: "q8",
    });
  }
  return textModel;
}

async function getProcessor() {
  if (!processor) {
    // @ts-expect-error - AutoProcessor types require 2 arguments
    processor = await AutoProcessor.from_pretrained(MODEL_ID);
  }
  return processor;
}

async function getTokenizer() {
  if (!tokenizer) {
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
  }
  return tokenizer;
}

/**
 * Batch embed multiple texts using CLIP text model
 */
export async function getTextEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = await getTextModel();
  const tok = await getTokenizer();

  const textInputs = await tok(texts, { padding: true, truncation: true });
  const { text_embeds } = await model(textInputs);

  // text_embeds.dims = [batch_size, embedding_dim]
  const embeddingDim = text_embeds.dims[1];
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    const start = i * embeddingDim;
    results.push(
      Array.from(text_embeds.data.slice(start, start + embeddingDim)),
    );
  }
  return results;
}

/**
 * Batch embed multiple images using CLIP vision model
 */
export async function getImageEmbeddings(
  imageUrls: ImageType[],
): Promise<number[][]> {
  if (imageUrls.length === 0) return [];

  const model = await getVisionModel();
  const proc = await getProcessor();

  // Process images in parallel
  const images = await Promise.all(
    imageUrls.map((url) => {
      if (url instanceof Blob) return RawImage.fromBlob(url);
      return RawImage.fromURL(url);
    }),
  );
  const imageInputs = await proc(images);
  const { image_embeds } = await model(imageInputs);

  // image_embeds.dims = [batch_size, embedding_dim]
  const embeddingDim = image_embeds.dims[1];
  const results: number[][] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const start = i * embeddingDim;
    results.push(
      Array.from(image_embeds.data.slice(start, start + embeddingDim)),
    );
  }
  return results;
}

export async function getVectorStores(): Promise<VectorStoreByType> {
  return {
    [ModalityType.TEXT]: await SimpleVectorStore.fromPersistDir("storage"),
    [ModalityType.IMAGE]: await SimpleVectorStore.fromPersistDir(
      path.join("storage", "images"),
    ),
  };
}

export function getEmbeddings() {
  return {
    [ModalityType.TEXT]: getTextEmbeddings,
    [ModalityType.IMAGE]: getImageEmbeddings,
  };
}
