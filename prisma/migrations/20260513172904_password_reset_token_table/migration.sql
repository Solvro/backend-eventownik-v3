-- CreateTable
CREATE TABLE "PasswordResetTokens" (
    "uuid" UUID NOT NULL,
    "adminUuid" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetTokens_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetTokens_token_key" ON "PasswordResetTokens"("token");

-- AddForeignKey
ALTER TABLE "PasswordResetTokens" ADD CONSTRAINT "PasswordResetTokens_adminUuid_fkey" FOREIGN KEY ("adminUuid") REFERENCES "Admins"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
