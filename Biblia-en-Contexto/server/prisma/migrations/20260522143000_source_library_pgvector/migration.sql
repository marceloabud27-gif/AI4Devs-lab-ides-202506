CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "SourceBook" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "author" TEXT,
  "licenseStatus" "LicenseStatus" NOT NULL DEFAULT 'COPYRIGHTED',
  "licenseNote" TEXT,
  "contentHash" TEXT NOT NULL,
  "totalCharacters" INTEGER NOT NULL DEFAULT 0,
  "totalChunks" INTEGER NOT NULL DEFAULT 0,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SourceBook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SourceChunk" (
  "id" TEXT NOT NULL,
  "sourceBookId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "contentText" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "tokenEstimate" INTEGER NOT NULL,
  "embedding" vector(1536),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SourceChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SourceBook_contentHash_key" ON "SourceBook"("contentHash");
CREATE INDEX "SourceBook_title_idx" ON "SourceBook"("title");
CREATE INDEX "SourceBook_author_idx" ON "SourceBook"("author");

CREATE UNIQUE INDEX "SourceChunk_contentHash_key" ON "SourceChunk"("contentHash");
CREATE UNIQUE INDEX "SourceChunk_sourceBookId_chunkIndex_key" ON "SourceChunk"("sourceBookId", "chunkIndex");
CREATE INDEX "SourceChunk_sourceBookId_idx" ON "SourceChunk"("sourceBookId");
CREATE INDEX "SourceChunk_contentText_fts_idx" ON "SourceChunk" USING GIN (to_tsvector('spanish', "contentText"));
CREATE INDEX "SourceChunk_embedding_idx" ON "SourceChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

ALTER TABLE "SourceChunk"
ADD CONSTRAINT "SourceChunk_sourceBookId_fkey"
FOREIGN KEY ("sourceBookId") REFERENCES "SourceBook"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
