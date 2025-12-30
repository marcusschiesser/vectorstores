import type { ImageType } from "../schema/node.js";

export type MessageContentTextDetail = {
  type: "text";
  text: string;
};

export type MessageContentImageDetail = {
  type: "image_url";
  image_url: { url: string };
  detail?: "high" | "low" | "auto";
};

/**
 * Image content using ImageType (string | Blob | URL)
 * Convenient for embedding functions that accept various image formats
 */
export type MessageContentImageTypeDetail = {
  type: "image_type";
  image: ImageType;
};

export type MessageContentAudioDetail = {
  type: "audio";
  // this is a base64 encoded string
  data: string;
  mimeType: string;
};

export type MessageContentVideoDetail = {
  type: "video";
  // this is a base64 encoded string
  data: string;
  mimeType: string;
};

export type MessageContentImageDataDetail = {
  type: "image";
  // this is a base64 encoded string
  data: string;
  mimeType: string;
};

export type MessageContentFileDetail = {
  type: "file";
  // this is a base64 encoded string
  data: string;
  mimeType: string;
};

export type MessageContentDetail =
  | MessageContentTextDetail
  | MessageContentImageDetail
  | MessageContentImageTypeDetail
  | MessageContentAudioDetail
  | MessageContentVideoDetail
  | MessageContentImageDataDetail
  | MessageContentFileDetail;

/**
 * Extended type for the content of a message that allows for multi-modal messages.
 */
export type MessageContent = string | MessageContentDetail[];
