-- CreateTable
CREATE TABLE "EmailAttachments" (
    "uuid" UUID NOT NULL,
    "fileKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "emailUuid" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "EmailAttachments_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE INDEX "EmailAttachments_claimedAt_createdAt_idx" ON "EmailAttachments"("claimedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "EmailAttachments" ADD CONSTRAINT "EmailAttachments_emailUuid_fkey" FOREIGN KEY ("emailUuid") REFERENCES "EmailTemplates"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
