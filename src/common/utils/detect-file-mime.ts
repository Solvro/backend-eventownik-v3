import { BadRequestException } from "@nestjs/common";

type FileTypeResult = { ext: string; mime: string } | undefined;

interface FileTypeModule {
  fileTypeFromBuffer: (
    buffer: Uint8Array | ArrayBuffer,
  ) => Promise<FileTypeResult>;
}

/**
 * Detect MIME type from magic bytes via the ESM-only `file-type` package.
 * Dynamic Function import avoids TypeScript rewriting `import()` to `require()`
 * under `"module": "commonjs"`.
 */
export async function detectFileMime(
  buffer: Buffer,
): Promise<string | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const dynamicImport = new Function(
    'return import("file-type")',
  ) as () => Promise<unknown>;
  const { fileTypeFromBuffer } = (await dynamicImport()) as FileTypeModule;

  const detected = await fileTypeFromBuffer(buffer);
  return detected?.mime;
}

export async function assertAllowedMimeWithMagicBytes(
  file: Express.Multer.File,
  allowedMimes: string[],
): Promise<string> {
  if (!allowedMimes.includes(file.mimetype)) {
    throw new BadRequestException(
      `File type not allowed. Allowed types: ${allowedMimes.join(", ")}`,
    );
  }

  const detectedMime = await detectFileMime(file.buffer);
  if (detectedMime == null) {
    throw new BadRequestException(
      "Could not determine file type from content (magic bytes). File may be empty or unrecognized.",
    );
  }

  if (!allowedMimes.includes(detectedMime)) {
    throw new BadRequestException(
      `Detected file type ${detectedMime} is not allowed. Allowed types: ${allowedMimes.join(", ")}`,
    );
  }

  if (detectedMime !== file.mimetype) {
    throw new BadRequestException(
      `Declared MIME type ${file.mimetype} does not match file content (${detectedMime})`,
    );
  }

  return detectedMime;
}
