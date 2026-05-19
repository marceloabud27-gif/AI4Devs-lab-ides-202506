-- AlterTable
ALTER TABLE "GlossaryTerm" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "BibleVerse" (
    "id" TEXT NOT NULL,
    "passageId" TEXT,
    "reference" TEXT NOT NULL,
    "book" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "verse" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "testament" "BiblicalTestament" NOT NULL,
    "keywords" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BibleVerse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BibleVerse_reference_key" ON "BibleVerse"("reference");

-- CreateIndex
CREATE INDEX "BibleVerse_book_idx" ON "BibleVerse"("book");

-- CreateIndex
CREATE INDEX "BibleVerse_version_idx" ON "BibleVerse"("version");

-- AddForeignKey
ALTER TABLE "BibleVerse" ADD CONSTRAINT "BibleVerse_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
