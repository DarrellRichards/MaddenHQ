-- CreateIndex
CREATE UNIQUE INDEX "Game_weekId_homeTeamId_awayTeamId_key" ON "Game"("weekId", "homeTeamId", "awayTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_leagueId_firstName_lastName_position_key" ON "Player"("leagueId", "firstName", "lastName", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Player_leagueId_rosterId_key" ON "Player"("leagueId", "rosterId");
