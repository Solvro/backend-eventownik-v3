-- CreateTable
CREATE TABLE "UploadedFiles" (
    "uuid" UUID NOT NULL,
    "fileKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "formUuid" UUID NOT NULL,
    "sourceIp" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "UploadedFiles_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE INDEX "UploadedFiles_claimedAt_createdAt_idx" ON "UploadedFiles"("claimedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "UploadedFiles" ADD CONSTRAINT "UploadedFiles_formUuid_fkey" FOREIGN KEY ("formUuid") REFERENCES "Forms"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
