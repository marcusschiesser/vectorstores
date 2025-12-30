import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmbeddingsByType } from "../src/embeddings/base.js";
import { calculateQueryEmbedding } from "../src/embeddings/query.js";
import type {
  MessageContentDetail,
  MessageContentImageDataDetail,
  MessageContentImageDetail,
  MessageContentImageTypeDetail,
  MessageContentTextDetail,
} from "../src/llms/type.js";

describe("calculateQueryEmbedding", () => {
  const mockTextEmbedding = [0.1, 0.2, 0.3];
  const mockImageEmbedding = [0.4, 0.5, 0.6];

  let textEmbedFunc: ReturnType<typeof vi.fn>;
  let imageEmbedFunc: ReturnType<typeof vi.fn>;
  let embeddings: EmbeddingsByType;

  beforeEach(() => {
    textEmbedFunc = vi.fn().mockResolvedValue([mockTextEmbedding]);
    imageEmbedFunc = vi.fn().mockResolvedValue([mockImageEmbedding]);
    embeddings = {
      text: textEmbedFunc,
      image: imageEmbedFunc,
    };
  });

  describe("text queries", () => {
    it("should calculate embedding for text content", async () => {
      const item: MessageContentTextDetail = {
        type: "text",
        text: "What did the author do in college?",
      };

      const result = await calculateQueryEmbedding(item, embeddings);

      expect(result).toEqual(mockTextEmbedding);
      expect(textEmbedFunc).toHaveBeenCalledWith([item.text]);
    });

    it("should throw error if TEXT embedding function is not provided", async () => {
      const item: MessageContentTextDetail = {
        type: "text",
        text: "What did the author do in college?",
      };
      const embeddingsWithoutText: EmbeddingsByType = {
        image: imageEmbedFunc,
      };

      await expect(
        calculateQueryEmbedding(item, embeddingsWithoutText),
      ).rejects.toThrow("No TEXT embedding function provided");
    });

    it("should return null if embedding function returns empty array", async () => {
      const item: MessageContentTextDetail = {
        type: "text",
        text: "test",
      };
      textEmbedFunc.mockResolvedValue([]);

      const result = await calculateQueryEmbedding(item, embeddings);

      expect(result).toBeNull();
    });
  });

  describe("image_url queries", () => {
    it("should calculate embedding for image_url content", async () => {
      const item: MessageContentImageDetail = {
        type: "image_url",
        image_url: { url: "https://example.com/image.jpg" },
      };

      const result = await calculateQueryEmbedding(item, embeddings);

      expect(result).toEqual(mockImageEmbedding);
      expect(imageEmbedFunc).toHaveBeenCalledWith([item.image_url.url]);
    });

    it("should throw error if IMAGE embedding function is not provided", async () => {
      const item: MessageContentImageDetail = {
        type: "image_url",
        image_url: { url: "https://example.com/image.jpg" },
      };
      const embeddingsWithoutImage: EmbeddingsByType = {
        text: textEmbedFunc,
      };

      await expect(
        calculateQueryEmbedding(item, embeddingsWithoutImage),
      ).rejects.toThrow("No IMAGE embedding function provided");
    });

    it("should return null if embedding function returns empty array", async () => {
      const item: MessageContentImageDetail = {
        type: "image_url",
        image_url: { url: "https://example.com/image.jpg" },
      };
      imageEmbedFunc.mockResolvedValue([]);

      const result = await calculateQueryEmbedding(item, embeddings);

      expect(result).toBeNull();
    });
  });

  describe("image_type queries", () => {
    it("should calculate embedding for image_type content with string URL", async () => {
      const item: MessageContentImageTypeDetail = {
        type: "image_type",
        image: "https://example.com/image.jpg",
      };

      const result = await calculateQueryEmbedding(item, embeddings);

      expect(result).toEqual(mockImageEmbedding);
      expect(imageEmbedFunc).toHaveBeenCalledWith([item.image]);
    });

    it("should calculate embedding for image_type content with Blob", async () => {
      const blob = new Blob(["image data"], { type: "image/jpeg" });
      const item: MessageContentImageTypeDetail = {
        type: "image_type",
        image: blob,
      };

      const result = await calculateQueryEmbedding(item, embeddings);

      expect(result).toEqual(mockImageEmbedding);
      expect(imageEmbedFunc).toHaveBeenCalledWith([blob]);
    });

    it("should calculate embedding for image_type content with URL object", async () => {
      const url = new URL("https://example.com/image.jpg");
      const item: MessageContentImageTypeDetail = {
        type: "image_type",
        image: url,
      };

      const result = await calculateQueryEmbedding(item, embeddings);

      expect(result).toEqual(mockImageEmbedding);
      expect(imageEmbedFunc).toHaveBeenCalledWith([url]);
    });

    it("should throw error if IMAGE embedding function is not provided", async () => {
      const item: MessageContentImageTypeDetail = {
        type: "image_type",
        image: "https://example.com/image.jpg",
      };
      const embeddingsWithoutImage: EmbeddingsByType = {
        text: textEmbedFunc,
      };

      await expect(
        calculateQueryEmbedding(item, embeddingsWithoutImage),
      ).rejects.toThrow("No IMAGE embedding function provided");
    });

    it("should return null if embedding function returns empty array", async () => {
      const item: MessageContentImageTypeDetail = {
        type: "image_type",
        image: "https://example.com/image.jpg",
      };
      imageEmbedFunc.mockResolvedValue([]);

      const result = await calculateQueryEmbedding(item, embeddings);

      expect(result).toBeNull();
    });
  });

  describe("image (base64) queries", () => {
    it("should calculate embedding for base64 image content", async () => {
      const item: MessageContentImageDataDetail = {
        type: "image",
        data: "data:image/jpeg;base64,/9j/4AAQSkZJRgABA...",
        mimeType: "image/jpeg",
      };

      const result = await calculateQueryEmbedding(item, embeddings);

      expect(result).toEqual(mockImageEmbedding);
      expect(imageEmbedFunc).toHaveBeenCalledWith([item.data]);
    });

    it("should throw error if IMAGE embedding function is not provided", async () => {
      const item: MessageContentImageDataDetail = {
        type: "image",
        data: "data:image/jpeg;base64,/9j/4AAQSkZJRgABA...",
        mimeType: "image/jpeg",
      };
      const embeddingsWithoutImage: EmbeddingsByType = {
        text: textEmbedFunc,
      };

      await expect(
        calculateQueryEmbedding(item, embeddingsWithoutImage),
      ).rejects.toThrow("No IMAGE embedding function provided");
    });

    it("should return null if embedding function returns empty array", async () => {
      const item: MessageContentImageDataDetail = {
        type: "image",
        data: "data:image/jpeg;base64,/9j/4AAQSkZJRgABA...",
        mimeType: "image/jpeg",
      };
      imageEmbedFunc.mockResolvedValue([]);

      const result = await calculateQueryEmbedding(item, embeddings);

      expect(result).toBeNull();
    });
  });

  describe("unsupported content types", () => {
    it("should return null for audio content", async () => {
      const item: MessageContentDetail & { type: "audio" } = {
        type: "audio",
        data: "base64encodedaudio",
        mimeType: "audio/mp3",
      };

      const result = await calculateQueryEmbedding(
        item as MessageContentDetail,
        embeddings,
      );

      expect(result).toBeNull();
      expect(imageEmbedFunc).not.toHaveBeenCalled();
      expect(textEmbedFunc).not.toHaveBeenCalled();
    });

    it("should return null for video content", async () => {
      const item: MessageContentDetail & { type: "video" } = {
        type: "video",
        data: "base64encodedvideo",
        mimeType: "video/mp4",
      };

      const result = await calculateQueryEmbedding(
        item as MessageContentDetail,
        embeddings,
      );

      expect(result).toBeNull();
      expect(imageEmbedFunc).not.toHaveBeenCalled();
      expect(textEmbedFunc).not.toHaveBeenCalled();
    });

    it("should return null for file content", async () => {
      const item: MessageContentDetail & { type: "file" } = {
        type: "file",
        data: "base64encodedfile",
        mimeType: "application/pdf",
      };

      const result = await calculateQueryEmbedding(
        item as MessageContentDetail,
        embeddings,
      );

      expect(result).toBeNull();
      expect(imageEmbedFunc).not.toHaveBeenCalled();
      expect(textEmbedFunc).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle multiple embeddings when embedding function returns multiple results", async () => {
      const item: MessageContentTextDetail = {
        type: "text",
        text: "test",
      };
      const multipleEmbeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ];
      textEmbedFunc.mockResolvedValue(multipleEmbeddings);

      const result = await calculateQueryEmbedding(item, embeddings);

      // Should return the first embedding
      expect(result).toEqual(multipleEmbeddings[0]);
    });

    it("should handle empty embeddings map", async () => {
      const item: MessageContentTextDetail = {
        type: "text",
        text: "test",
      };

      await expect(calculateQueryEmbedding(item, {})).rejects.toThrow(
        "No TEXT embedding function provided",
      );
    });
  });
});
