-- Additive only: katalog AI global, otak kantor, setting sistem, provider global.
ALTER TABLE "ai_provider" ALTER COLUMN "companyId" DROP NOT NULL;
ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "templateId" TEXT;
CREATE TABLE "agent_template" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL DEFAULT '',
    "tagline" TEXT NOT NULL DEFAULT '',
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "appearance" JSONB NOT NULL DEFAULT '{}',
    "providerId" TEXT,
    "model" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brain_entry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'note',
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brain_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_setting" (
    "key" TEXT NOT NULL,
    "valueEnc" TEXT NOT NULL DEFAULT '',
    "hint" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_template_key_key" ON "agent_template"("key");

-- CreateIndex
CREATE INDEX "agent_template_isActive_sortOrder_idx" ON "agent_template"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "brain_entry_companyId_createdAt_idx" ON "brain_entry"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "brain_entry_companyId_pinned_idx" ON "brain_entry"("companyId", "pinned");

-- AddForeignKey
ALTER TABLE "agent_template" ADD CONSTRAINT "agent_template_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ai_provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_entry" ADD CONSTRAINT "brain_entry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_entry" ADD CONSTRAINT "brain_entry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "agent_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
