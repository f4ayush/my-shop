-- CreateTable
CREATE TABLE "InventoryImport" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "fullSnapshot" BOOLEAN NOT NULL DEFAULT false,
    "summary" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryImport_createdAt_idx" ON "InventoryImport"("createdAt");
