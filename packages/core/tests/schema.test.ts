import { describe, expect, test } from "vitest";
// Note: Settings import must come first to ensure correct module initialization order
import "@vectorstores/core";
import {
  Document,
  ImageDocument,
  ImageNode,
  type ImageType,
  jsonToNode,
  ObjectType,
} from "@vectorstores/core";

describe("Document", () => {
  test("initializes", () => {
    const doc = new Document({ text: "text", id_: "docId" });
    expect(doc).toBeDefined();
  });

  test("should generate different hash for different image contents", () => {
    const imageNode1 = new ImageDocument({
      id_: "image",
      image: "data:image/png;base64,sample_image_content1",
    });
    const imageNode2 = new ImageDocument({
      id_: "image",
      image: "data:image/png;base64,sample_image_content2",
    });
    expect(imageNode1.hash).not.toBe(imageNode2.hash);
  });
});

describe("ImageNode deserialization", () => {
  test("should reconstruct image URL when deserialized with empty object", () => {
    // Simulate what happens when a Blob is serialized to JSON and becomes {}
    const imageNode = new ImageNode({
      id_: "path/to/image.jpg",
      image: {} as unknown as ImageType, // Empty object from JSON serialization
      text: "An image",
    });

    expect(imageNode.image).toBeInstanceOf(URL);
    expect(imageNode.image.toString()).toContain("file://");
    expect(imageNode.image.toString()).toContain("image.jpg");
  });

  test("should reconstruct image URL when image is missing", () => {
    const imageNode = new ImageNode({
      id_: "path/to/photo.png",
      image: undefined as unknown as ImageType,
      text: "A photo",
    });

    expect(imageNode.image).toBeInstanceOf(URL);
    expect(imageNode.image.toString()).toContain("file://");
    expect(imageNode.image.toString()).toContain("photo.png");
  });

  test("should preserve valid image string", () => {
    const imageUrl = "data:image/png;base64,validcontent";
    const imageNode = new ImageNode({
      id_: "path/to/image.jpg",
      image: imageUrl,
      text: "An image",
    });

    expect(imageNode.image).toBe(imageUrl);
  });

  test("should preserve valid URL instance", () => {
    const imageUrl = new URL("https://example.com/image.jpg");
    const imageNode = new ImageNode({
      id_: "path/to/image.jpg",
      image: imageUrl,
      text: "An image",
    });

    expect(imageNode.image).toBe(imageUrl);
  });

  test("should preserve valid Blob instance", () => {
    const blob = new Blob(["test"], { type: "image/png" });
    const imageNode = new ImageNode({
      id_: "path/to/image.jpg",
      image: blob,
      text: "An image",
    });

    expect(imageNode.image).toBe(blob);
  });

  test("jsonToNode should reconstruct ImageNode with empty object", () => {
    const json = {
      type: ObjectType.IMAGE,
      id_: "path/to/image.jpg",
      image: {}, // Empty object from serialization
      text: "Test image",
      metadata: {},
      excludedEmbedMetadataKeys: [],
      excludedLlmMetadataKeys: [],
      relationships: {},
    };

    const node = jsonToNode(json);
    expect(node).toBeInstanceOf(ImageNode);
    expect((node as ImageNode).image).toBeInstanceOf(URL);
    expect((node as ImageNode).image.toString()).toContain("file://");
  });

  test("jsonToNode should reconstruct ImageDocument with empty object", () => {
    const json = {
      type: ObjectType.IMAGE_DOCUMENT,
      id_: "path/to/document.jpg",
      image: {}, // Empty object from serialization
      text: "Test document",
      metadata: {},
      excludedEmbedMetadataKeys: [],
      excludedLlmMetadataKeys: [],
      relationships: {},
    };

    const node = jsonToNode(json);
    expect(node).toBeInstanceOf(ImageDocument);
    expect((node as ImageDocument).image).toBeInstanceOf(URL);
    expect((node as ImageDocument).image.toString()).toContain("file://");
  });

  test("should handle serialization round-trip", () => {
    const originalNode = new ImageNode({
      id_: "path/to/image.jpg",
      image: new Blob(["test"], { type: "image/png" }),
      text: "Original image",
      metadata: { source: "test" },
    });

    // Serialize to JSON (Blob becomes {})
    const json = JSON.parse(JSON.stringify(originalNode.toJSON()));

    // Deserialize back
    const restoredNode = jsonToNode(json);

    expect(restoredNode).toBeInstanceOf(ImageNode);
    expect((restoredNode as ImageNode).id_).toBe(originalNode.id_);
    expect((restoredNode as ImageNode).text).toBe(originalNode.text);
    expect((restoredNode as ImageNode).image).toBeInstanceOf(URL);
    expect((restoredNode as ImageNode).metadata).toEqual(originalNode.metadata);
  });

  test("generateHash should not throw for deserialized ImageNode", () => {
    const imageNode = new ImageNode({
      id_: "path/to/image.jpg",
      image: {} as unknown as ImageType, // Empty object from JSON serialization
      text: "An image",
    });

    // Should not throw
    expect(() => imageNode.generateHash()).not.toThrow();
    expect(imageNode.hash).toBeDefined();
    expect(typeof imageNode.hash).toBe("string");
  });
});
