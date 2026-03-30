ALTER TABLE "User"
ADD COLUMN "fullName" TEXT NOT NULL DEFAULT '';

CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Topic"
ADD COLUMN "userId" TEXT;

WITH existing_topics AS (
    SELECT COUNT(*)::int AS count FROM "Topic"
),
legacy_user AS (
    INSERT INTO "User" ("id", "fullName", "email", "createdAt", "updatedAt")
    SELECT 'legacy-user', 'Legacy User', 'legacy@ilearn.local', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM existing_topics
    WHERE count > 0
    ON CONFLICT ("email") DO NOTHING
    RETURNING "id"
)
UPDATE "Topic"
SET "userId" = 'legacy-user'
WHERE "userId" IS NULL;

ALTER TABLE "Topic"
ALTER COLUMN "userId" SET NOT NULL;

CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
CREATE INDEX "VerificationCode_userId_createdAt_idx" ON "VerificationCode"("userId", "createdAt");
CREATE INDEX "VerificationCode_expiresAt_idx" ON "VerificationCode"("expiresAt");
CREATE INDEX "Topic_userId_createdAt_idx" ON "Topic"("userId", "createdAt");

ALTER TABLE "Topic"
ADD CONSTRAINT "Topic_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthSession"
ADD CONSTRAINT "AuthSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VerificationCode"
ADD CONSTRAINT "VerificationCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User"
ALTER COLUMN "fullName" DROP DEFAULT;
