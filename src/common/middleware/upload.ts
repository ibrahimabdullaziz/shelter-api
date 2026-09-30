import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import ApiError from "../utils/ApiError";

const storage = multer.memoryStorage();

const imageSignatures = {
  "image/jpeg": (buffer: Buffer) =>
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff,
  "image/png": (buffer: Buffer) =>
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (buffer: Buffer) =>
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP",
} as const;

export function hasValidImageSignature(buffer: Buffer, mimetype: string) {
  const signature = imageSignatures[mimetype as keyof typeof imageSignatures];
  return signature ? signature(buffer) : false;
}

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/webp"
  ) {
    cb(null, true);
  } else {
    cb(new ApiError(400, "Only .jpeg, .webp and .png formats are allowed!"));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 10,
    parts: 11,
  },
  fileFilter,
});

export default upload;
