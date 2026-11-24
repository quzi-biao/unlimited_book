-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "monthlyAllowance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "monthlyAllowance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "readerProfileId" TEXT;

-- CreateTable
CREATE TABLE "reader_profiles" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "username" TEXT,
    "passwordHash" TEXT,
    "displayName" TEXT NOT NULL DEFAULT '探索者',
    "ageBand" TEXT NOT NULL DEFAULT 'unknown',
    "mode" TEXT NOT NULL DEFAULT 'infinite',
    "selectedTreeId" TEXT,
    "guardianId" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "settingsRevision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reader_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_trees" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "grade" TEXT NOT NULL DEFAULT '',
    "curriculum" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_trees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_nodes" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "parentId" TEXT,
    "assetKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'related',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_assets" (
    "key" TEXT NOT NULL,
    "parentKey" TEXT,
    "action" TEXT NOT NULL,
    "identity" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT '综合',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "explanations" JSONB NOT NULL DEFAULT '{}',
    "audio" JSONB NOT NULL DEFAULT '{}',
    "anchors" JSONB NOT NULL DEFAULT '[]',
    "language" TEXT NOT NULL DEFAULT 'zh',
    "modality" TEXT NOT NULL DEFAULT 'image',
    "state" TEXT NOT NULL DEFAULT 'pending',
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "reviewedBy" TEXT,
    "authorProfileId" TEXT,
    "leaseId" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "reservedProfileId" TEXT,
    "reservedPeriod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_assets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "reader_nodes" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "assetKey" TEXT NOT NULL,
    "parentId" TEXT,
    "globalNodeId" TEXT,
    "treeId" TEXT,
    "openedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "visits" INTEGER NOT NULL DEFAULT 0,
    "dwellSeconds" INTEGER NOT NULL DEFAULT 0,
    "mastery" INTEGER NOT NULL DEFAULT 0,
    "reviewStep" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reader_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_events" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_events_pkey" PRIMARY KEY ("profileId","id")
);

-- CreateTable
CREATE TABLE "knowledge_corrections" (
    "id" TEXT NOT NULL,
    "assetKey" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "resolution" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_invites" (
    "tokenHash" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "guardian_invites_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "reader_entitlements" (
    "profileId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "allowance" INTEGER NOT NULL DEFAULT 0,
    "consumed" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reader_entitlements_pkey" PRIMARY KEY ("profileId","period")
);

-- CreateTable
CREATE TABLE "prompt_releases" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "base" TEXT NOT NULL,
    "safety" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "rollout" INTEGER NOT NULL DEFAULT 0,
    "evals" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assembly_logs" (
    "id" TEXT NOT NULL,
    "assetKey" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "layers" JSONB NOT NULL,
    "conflicts" JSONB NOT NULL,
    "verdict" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assembly_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_import_owners" (
    "deviceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,

    CONSTRAINT "legacy_import_owners_pkey" PRIMARY KEY ("deviceId")
);

-- CreateTable
CREATE TABLE "knowledge_audio_jobs" (
    "key" TEXT NOT NULL,
    "url" TEXT,
    "leaseId" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "reservedProfileId" TEXT,
    "reservedPeriod" TEXT,

    CONSTRAINT "knowledge_audio_jobs_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "reader_profiles_deviceId_key" ON "reader_profiles"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "reader_profiles_username_key" ON "reader_profiles"("username");

-- CreateIndex
CREATE INDEX "reader_profiles_guardianId_idx" ON "reader_profiles"("guardianId");

-- CreateIndex
CREATE INDEX "knowledge_nodes_treeId_parentId_idx" ON "knowledge_nodes"("treeId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_nodes_treeId_assetKey_key" ON "knowledge_nodes"("treeId", "assetKey");

-- CreateIndex
CREATE INDEX "knowledge_assets_reviewStatus_state_idx" ON "knowledge_assets"("reviewStatus", "state");

-- CreateIndex
CREATE INDEX "reader_nodes_profileId_nextReviewAt_idx" ON "reader_nodes"("profileId", "nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "reader_nodes_profileId_assetKey_key" ON "reader_nodes"("profileId", "assetKey");

-- CreateIndex
CREATE INDEX "learning_events_profileId_occurredAt_idx" ON "learning_events"("profileId", "occurredAt");

-- CreateIndex
CREATE INDEX "knowledge_corrections_profileId_idx" ON "knowledge_corrections"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_releases_version_key" ON "prompt_releases"("version");

-- CreateIndex
CREATE INDEX "assembly_logs_assetKey_idx" ON "assembly_logs"("assetKey");

-- AddForeignKey
ALTER TABLE "knowledge_nodes" ADD CONSTRAINT "knowledge_nodes_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "knowledge_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_nodes" ADD CONSTRAINT "knowledge_nodes_assetKey_fkey" FOREIGN KEY ("assetKey") REFERENCES "knowledge_assets"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_nodes" ADD CONSTRAINT "reader_nodes_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "reader_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader_nodes" ADD CONSTRAINT "reader_nodes_assetKey_fkey" FOREIGN KEY ("assetKey") REFERENCES "knowledge_assets"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "reader_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

