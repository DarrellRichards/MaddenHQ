-- CreateTable
CREATE TABLE "PendingEaConnect" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingEaConnect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingEaConnect_userId_leagueId_idx" ON "PendingEaConnect"("userId", "leagueId");

-- CreateIndex
CREATE INDEX "PendingEaConnect_expiresAt_idx" ON "PendingEaConnect"("expiresAt");
