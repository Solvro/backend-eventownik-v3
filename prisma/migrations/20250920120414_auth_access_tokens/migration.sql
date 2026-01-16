-- CreateTable
CREATE TABLE "public"."AuthAcessToken" (
    "id" SERIAL NOT NULL,
    "tokenableId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "hash" TEXT NOT NULL,
    "abilities" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthAcessToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthAcessToken_tokenableId_key" ON "public"."AuthAcessToken"("tokenableId");

-- AddForeignKey
ALTER TABLE "public"."AuthAcessToken" ADD CONSTRAINT "AuthAcessToken_tokenableId_fkey" FOREIGN KEY ("tokenableId") REFERENCES "public"."Admin"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
