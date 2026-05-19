-- CreateEnum
CREATE TYPE "BiblicalTestament" AS ENUM ('OLD', 'NEW');

-- CreateEnum
CREATE TYPE "ExplanationLevel" AS ENUM ('SIMPLE', 'STUDENT', 'ACADEMIC');

-- CreateEnum
CREATE TYPE "ResourceKind" AS ENUM ('ARTICLE', 'SERMON', 'BOOK', 'VIDEO', 'COMMENTARY', 'LINK');

-- CreateEnum
CREATE TYPE "SourceLanguage" AS ENUM ('HEBREW', 'ARAMAIC', 'GREEK', 'LATIN', 'SPANISH', 'ENGLISH');

-- CreateEnum
CREATE TYPE "SourceScope" AS ENUM ('OLD_TESTAMENT', 'NEW_TESTAMENT', 'WHOLE_BIBLE', 'LEXICON_HEBREW', 'LEXICON_GREEK');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('PUBLIC_DOMAIN', 'COPYRIGHTED', 'OPEN_ACCESS', 'LICENSE_REQUIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'student',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiblicalBook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "testament" "BiblicalTestament" NOT NULL,
    "order" INTEGER NOT NULL,
    "genre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiblicalBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passage" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterStart" INTEGER NOT NULL,
    "verseStart" INTEGER NOT NULL,
    "chapterEnd" INTEGER,
    "verseEnd" INTEGER,
    "summary" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "genreNote" TEXT NOT NULL,
    "structure" TEXT[],
    "commonMistakes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Passage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChronologicalEvent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "guideQuestion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChronologicalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPassage" (
    "eventId" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "EventPassage_pkey" PRIMARY KEY ("eventId","passageId")
);

-- CreateTable
CREATE TABLE "ExegesisStudy" (
    "id" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "level" "ExplanationLevel" NOT NULL,
    "originalContext" TEXT NOT NULL,
    "literaryGenre" TEXT NOT NULL,
    "structureExplanation" TEXT NOT NULL,
    "textualCriticismNote" TEXT,
    "linguisticNotes" JSONB NOT NULL,
    "restrictedIntertext" JSONB NOT NULL,
    "exegeticalSynthesis" TEXT NOT NULL,
    "tensions" TEXT[],
    "simpleSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExegesisStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlossaryTerm" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "simpleDefinition" TEXT NOT NULL,
    "deeperDefinition" TEXT,
    "example" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlossaryTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassageGlossaryTerm" (
    "passageId" TEXT NOT NULL,
    "glossaryTermId" TEXT NOT NULL,

    CONSTRAINT "PassageGlossaryTerm_pkey" PRIMARY KEY ("passageId","glossaryTermId")
);

-- CreateTable
CREATE TABLE "PassageResource" (
    "id" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "ResourceKind" NOT NULL,
    "url" TEXT,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassageResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiblicalTextSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "language" "SourceLanguage" NOT NULL,
    "scope" "SourceScope" NOT NULL,
    "tradition" TEXT NOT NULL,
    "baseText" TEXT NOT NULL,
    "century" TEXT NOT NULL,
    "reliability" TEXT NOT NULL,
    "licenseStatus" "LicenseStatus" NOT NULL,
    "licenseNote" TEXT NOT NULL,
    "useInApp" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiblicalTextSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LexiconSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "language" "SourceLanguage" NOT NULL,
    "scope" "SourceScope" NOT NULL,
    "century" TEXT NOT NULL,
    "reliability" TEXT NOT NULL,
    "licenseStatus" "LicenseStatus" NOT NULL,
    "licenseNote" TEXT NOT NULL,
    "useInApp" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LexiconSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassageConnection" (
    "id" TEXT NOT NULL,
    "fromReference" TEXT NOT NULL,
    "toReference" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "connectionType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassageConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passageId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BiblicalBook_abbreviation_key" ON "BiblicalBook"("abbreviation");

-- CreateIndex
CREATE UNIQUE INDEX "BiblicalBook_testament_order_key" ON "BiblicalBook"("testament", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Passage_reference_key" ON "Passage"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "ChronologicalEvent_slug_key" ON "ChronologicalEvent"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ChronologicalEvent_order_key" ON "ChronologicalEvent"("order");

-- CreateIndex
CREATE UNIQUE INDEX "EventPassage_eventId_order_key" ON "EventPassage"("eventId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "GlossaryTerm_term_key" ON "GlossaryTerm"("term");

-- CreateIndex
CREATE UNIQUE INDEX "BiblicalTextSource_abbreviation_key" ON "BiblicalTextSource"("abbreviation");

-- CreateIndex
CREATE UNIQUE INDEX "LexiconSource_abbreviation_key" ON "LexiconSource"("abbreviation");

-- CreateIndex
CREATE INDEX "PassageConnection_fromReference_idx" ON "PassageConnection"("fromReference");

-- CreateIndex
CREATE INDEX "PassageConnection_toReference_idx" ON "PassageConnection"("toReference");

-- AddForeignKey
ALTER TABLE "Passage" ADD CONSTRAINT "Passage_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "BiblicalBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPassage" ADD CONSTRAINT "EventPassage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ChronologicalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPassage" ADD CONSTRAINT "EventPassage_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExegesisStudy" ADD CONSTRAINT "ExegesisStudy_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassageGlossaryTerm" ADD CONSTRAINT "PassageGlossaryTerm_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassageGlossaryTerm" ADD CONSTRAINT "PassageGlossaryTerm_glossaryTermId_fkey" FOREIGN KEY ("glossaryTermId") REFERENCES "GlossaryTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassageResource" ADD CONSTRAINT "PassageResource_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
