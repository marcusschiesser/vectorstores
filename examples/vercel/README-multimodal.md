# Multi-modal Image Retrieval and Transformation

This example demonstrates how to use a multi-modal retriever to find images based on text queries and transform them into different artistic styles using AI image generation.

## Overview

The example combines:
- **Multi-modal retrieval** using CLIP embeddings to search for images using text queries
- **Vercel AI SDK** for agentic workflow with tools
- **Image generation** using DALL-E 3 to transform retrieved images into different styles

## Flow

1. User asks about paintings (e.g., "show me starry night style paintings in cyberpunk style")
2. The `retrieveArtwork` tool uses a multi-modal retriever to find relevant van Gogh images
3. The `transformImage` tool generates new images in the requested style using DALL-E 3

## Prerequisites

1. Set up your OpenAI API key:
   ```bash
   export OPENAI_API_KEY=your_api_key_here
   ```

2. Load the van Gogh dataset into the vector store (only needs to be done once):
   ```bash
   npx tsx examples/retrieval/multimodal/load.ts
   ```

   This will:
   - Load van Gogh paintings from `examples/shared/data/multimodal/`
   - Generate CLIP embeddings for images and text
   - Store them in the `storage/` directory

## Running the Example

```bash
npx tsx examples/vercel/multimodal-image-transform.ts
```

## How It Works

### 1. Multi-modal Embeddings

The example uses CLIP (Contrastive Language-Image Pre-training) to create embeddings that work for both text and images:

```typescript
const embeddings = getEmbeddings(); // Returns { text, image } embedding functions
const index = await VectorStoreIndex.init({
  persistDir: "storage",
  embeddings,
});
```

### 2. Retriever Configuration

The retriever is configured to return both text and image results:

```typescript
const retriever = index.asRetriever({
  topK: { text: 1, image: 2 }, // Return top 1 text node and top 2 image nodes
});
```

### 3. Agent Tools

Two tools are provided to the AI agent:

- **retrieveArtwork**: Searches the vector store for relevant images based on text queries
- **transformImage**: Generates new images in a specified artistic style using DALL-E 3

### 4. Agentic Workflow

The AI agent automatically:
1. Understands the user's query
2. Retrieves relevant artwork using the multi-modal retriever
3. Transforms the images to the requested style
4. Describes the results to the user

## Example Queries

- "Show me Vincent van Gogh's famous paintings and transform them to cyberpunk style"
- "Find starry night paintings and make them look like watercolor"
- "Get van Gogh's sunflower paintings and convert them to pixel art style"
- "Show me post-impressionist paintings and render them as anime style"

## Customization

### Change the Image Model

You can use different OpenAI image models:

```typescript
generateImage({
  model: openai.image("dall-e-2"), // or "dall-e-3"
  // ...
});
```

### Adjust Retrieval Parameters

Modify the retriever to return more or fewer results:

```typescript
const retriever = index.asRetriever({
  topK: { text: 2, image: 5 }, // Return more images
});
```

### Add Your Own Images

1. Add your images to `examples/shared/data/multimodal/`
2. Re-run the load script: `npx tsx examples/retrieval/multimodal/load.ts`

## Architecture

```
User Query
    ↓
AI Agent (GPT-4)
    ↓
[retrieveArtwork Tool]
    ↓
Multi-modal Retriever (CLIP)
    ↓
Retrieved Images
    ↓
[transformImage Tool]
    ↓
DALL-E 3 Image Generation
    ↓
Transformed Images (base64)
```

## Dependencies

- `@ai-sdk/openai` - Vercel AI SDK for OpenAI
- `ai` - Vercel AI SDK core
- `@vectorstores/core` - Vector store and retrieval
- `@huggingface/transformers` - CLIP embeddings
- `zod` - Schema validation

## Notes

- The CLIP model downloads automatically on first run (~200MB)
- Generated images are returned as base64 strings
- Image generation costs apply per DALL-E API call
- The retriever works with any combination of text and image queries
