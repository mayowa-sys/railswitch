#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

LOGDIR="/tmp/railswitch-logs"
mkdir -p "$LOGDIR"

# Clear old logs
rm -f "$LOGDIR"/*.log

cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  kill $ENGINE_PID $GATEWAY_PID $DASHBOARD_PID $PORTAL_PID $STOREFRONT_PID 2>/dev/null
  wait 2>/dev/null
  echo -e "${GREEN}All services stopped.${NC}"
}
trap cleanup EXIT INT TERM

echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  RailSwitch — Full Stack Dev Mode            ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# 0. Kill stale processes
echo -e "${YELLOW}[0/5] Cleaning up stale processes...${NC}"
lsof -ti :3001 | xargs kill -9 2>/dev/null; true
lsof -ti :8000 | xargs kill -9 2>/dev/null; true
lsof -ti :3000 | xargs kill -9 2>/dev/null; true
lsof -ti :3100 | xargs kill -9 2>/dev/null; true
lsof -ti :3200 | xargs kill -9 2>/dev/null; true
sleep 1
echo -e "  ${GREEN}✓${NC} Ports cleared"

# 1. Infrastructure
echo -e "${YELLOW}[1/5] Starting PostgreSQL + Redis...${NC}"
docker compose -f infra/docker-compose.yml up -d postgres redis 2>&1 | tail -1
sleep 2
echo -e "  ${GREEN}✓${NC} PostgreSQL: $(docker exec infra-postgres-1 pg_isready -U railswitch 2>&1)"
echo -e "  ${GREEN}✓${NC} Redis: $(docker exec infra-redis-1 redis-cli ping 2>&1)"

# 2. Engine
echo -e "${YELLOW}[2/5] Starting Engine (Node.js)...${NC}"
cd "$ROOT/services/engine"
npx tsx src/index.ts > "$LOGDIR/engine.log" 2>&1 &
ENGINE_PID=$!
sleep 6
if kill -0 $ENGINE_PID 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Engine → http://localhost:3001"
else
  echo -e "  ${RED}✗ Engine failed to start:${NC}"
  tail -20 "$LOGDIR/engine.log"
  exit 1
fi

# 3. Gateway
echo -e "${YELLOW}[3/5] Starting Gateway (FastAPI)...${NC}"
cd "$ROOT/services/gateway"
source .venv/bin/activate 2>/dev/null
uvicorn app.main:app --reload --port 8000 > "$LOGDIR/gateway.log" 2>&1 &
GATEWAY_PID=$!
sleep 4
if kill -0 $GATEWAY_PID 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Gateway → http://localhost:8000"
else
  echo -e "  ${RED}✗ Gateway failed to start:${NC}"
  tail -20 "$LOGDIR/gateway.log"
  exit 1
fi

# 4. Dashboard
echo -e "${YELLOW}[4/5] Starting Dashboard...${NC}"
cd "$ROOT/apps/dashboard"
npm run dev -- -p 3000 > "$LOGDIR/dashboard.log" 2>&1 &
DASHBOARD_PID=$!
sleep 3
echo -e "  ${GREEN}✓${NC} Dashboard → http://localhost:3000"

# 5. Portal + Storefront
echo -e "${YELLOW}[5/5] Starting Portal + Storefront...${NC}"
cd "$ROOT/apps/portal"
npm run dev -- -p 3100 > "$LOGDIR/portal.log" 2>&1 &
PORTAL_PID=$!
sleep 3
echo -e "  ${GREEN}✓${NC} Portal → http://localhost:3100"

cd "$ROOT/apps/storefront"
npm run dev -- -p 3200 > "$LOGDIR/storefront.log" 2>&1 &
STOREFRONT_PID=$!
sleep 2
echo -e "  ${GREEN}✓${NC} Storefront → http://localhost:3200"

echo ""
echo -e "${CYAN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  All services running. Press Ctrl+C to stop.${NC}"
echo -e "${CYAN}════════════════════════════════════════════════${NC}"
echo ""
echo "  Dashboard  → http://localhost:3000/dashboard"
echo "  Portal     → http://localhost:3100/portal"
echo "  Storefront → http://localhost:3200"
echo "  API        → http://localhost:8000"
echo "  Engine     → http://localhost:3001/health"
echo ""

# Open log viewer in a new Terminal window
osascript -e "tell application \"Terminal\" to do script \"tail -f $LOGDIR/*.log | grep -i --color 'error\|fail\|exception\|traceback\|INFO\|WARN' --line-buffered\"" 2>/dev/null && echo -e "  ${GREEN}✓${NC} Log viewer opened in new Terminal" || echo -e "  ${YELLOW}⚠ Could not open log viewer${NC}"

echo ""

# Keep running until Ctrl+C
wait
