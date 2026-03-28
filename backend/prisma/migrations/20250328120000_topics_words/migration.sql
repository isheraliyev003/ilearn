-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordEntry" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "englishTerm" TEXT NOT NULL,
    "uzbekTranslation" TEXT NOT NULL,
    "englishDefinition" TEXT NOT NULL,
    "exampleSentence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WordEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Topic_createdAt_idx" ON "Topic"("createdAt");

-- CreateIndex
CREATE INDEX "WordEntry_topicId_idx" ON "WordEntry"("topicId");

-- CreateIndex
CREATE INDEX "WordEntry_topicId_createdAt_idx" ON "WordEntry"("topicId", "createdAt");

-- AddForeignKey
ALTER TABLE "WordEntry" ADD CONSTRAINT "WordEntry_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
