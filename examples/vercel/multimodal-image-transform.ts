/**
 * This example demonstrates using a multi-modal retriever to find images
 * based on user queries, then transforming those images to different styles
 * using AI image generation.
 *
 * Flow:
 * 1. User asks about paintings (e.g., "show me starry night style paintings")
 * 2. Multi-modal retriever finds relevant van Gogh images
 * 3. Images are transformed to a different style using AI image generation
 *
 * Prerequisites:
 * 1. Run the load script first: npx tsx examples/retrieval/multimodal/load.ts
 * 2. Set OPENAI_API_KEY in your environment
 */

import { openai } from "@ai-sdk/openai";
import type { ImageType } from "@vectorstores/core";
import { VectorStoreIndex } from "@vectorstores/core";
import { generateImage, streamText, tool } from "ai";
import { z } from "zod";
import { getEmbeddings } from "../retrieval/multimodal/embeddings";

async function main() {
  console.log("Loading multi-modal vector store index...");

  // Load the pre-existing vector store with van Gogh paintings
  const index = await VectorStoreIndex.init({
    persistDir: "storage",
    embeddings: getEmbeddings(),
  });

  console.log("Successfully loaded index with van Gogh paintings");

  // Create a retriever that returns both text and images
  const retriever = index.asRetriever({
    topK: { text: 1, image: 2 },
  });

  // Example queries demonstrating image retrieval and transformation
  const queries = [
    "Show me Vincent van Gogh's famous paintings and transform them to cyberpunk style",
    "Find starry night paintings and make them look like watercolor",
  ];

  for (const userMessage of queries) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`User: ${userMessage}`);
    console.log(`${"=".repeat(80)}\n`);

    const result = streamText({
      model: openai("gpt-4o"),
      system: `You are an art assistant that can retrieve paintings and transform them into different artistic styles.
When the user asks about paintings:
1. First use the retrieveArtwork tool to find relevant images
2. Then use the transformImage tool to transform each retrieved image to the requested style
3. Describe what you found and what transformations you're applying`,
      prompt: userMessage,
      tools: {
        retrieveArtwork: tool({
          description:
            "Retrieve relevant artwork images based on a text query about paintings, artists, or art styles",
          inputSchema: z.object({
            query: z
              .string()
              .describe(
                "The search query to find relevant artwork (e.g., 'starry night', 'van gogh paintings')",
              ),
          }),
          execute: async ({ query }) => {
            console.log(`\n🔍 Searching for artwork: "${query}"`);

            const results = await retriever.retrieve(query);

            // Extract image nodes
            const imageNodes = results.filter(
              (result) => result.node.type === "IMAGE",
            );

            if (imageNodes.length === 0) {
              return {
                message: "No images found for this query",
                images: [],
              };
            }

            // Get image URLs/paths from metadata
            const images = imageNodes.map((node) => {
              const imagePath = node.node.metadata?.file_path as string;
              return {
                path: imagePath,
                score: node.score,
              };
            });

            console.log(`✅ Found ${images.length} relevant images`);

            return {
              message: `Found ${images.length} relevant artwork images`,
              images,
            };
          },
        }),
        transformImage: tool({
          description:
            "Transform an image to a different artistic style using AI image generation. Provide a detailed description of the original image and the desired style.",
          inputSchema: z.object({
            imageDescription: z
              .string()
              .describe(
                "Detailed description of the original image content (e.g., 'a starry night sky with swirling clouds over a village')",
              ),
            targetStyle: z
              .string()
              .describe(
                "The artistic style to transform the image to (e.g., 'cyberpunk', 'watercolor', 'oil painting', 'pixel art')",
              ),
          }),
          execute: async ({ imageDescription, targetStyle }) => {
            console.log(
              `\n🎨 Transforming image to ${targetStyle} style...`,
            );
            console.log(`   Original: ${imageDescription}`);

            try {
              // Generate a new image in the requested style
              const { image } = await generateImage({
                model: openai.image("dall-e-3"),
                prompt: `Create an image in ${targetStyle} style: ${imageDescription}. Make it highly detailed and artistic.`,
                size: "1024x1024",
              });

              // Convert image to base64 for display
              const base64Image = image.base64;

              console.log(
                `✅ Successfully generated ${targetStyle} style image`,
              );

              return {
                success: true,
                message: `Generated image in ${targetStyle} style based on: ${imageDescription}`,
                imageBase64: base64Image,
                style: targetStyle,
              };
            } catch (error) {
              console.error(
                `❌ Error generating image: ${error instanceof Error ? error.message : "Unknown error"}`,
              );
              return {
                success: false,
                message: `Failed to generate image: ${error instanceof Error ? error.message : "Unknown error"}`,
              };
            }
          },
        }),
      },
      maxSteps: 10,
    });

    // Stream the text response
    for await (const textPart of result.textStream) {
      process.stdout.write(textPart);
    }

    console.log("\n");
  }
}

main().catch(console.error);
