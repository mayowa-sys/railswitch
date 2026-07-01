#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

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

# 1. Infrastructure
echo -e "${YELLOW}[1/5] Starting PostgreSQL + Redis...${NC}"
docker compose -f infra/docker-compose.yml up -d postgres redis 2>&1 | tail -1
sleep 2
echo -e "  ${GREEN}✓${NC} PostgreSQL: $(docker exec infra-postgres-1 pg_isready -U railswitch 2>&1)"
echo -e "  ${GREEN}✓${NC} Redis: $(docker exec infra-redis-1 redis-cli ping 2>&1)"

# 2. Engine
echo -e "${YELLOW}[2/5] Starting Engine (Node.js)...${NC}"
cd "$ROOT/services/engine"
npx tsx src/index.ts > /tmp/railswitch-engine.log 2>&1 &
ENGINE_PID=$!
sleep 3
if kill -0 $ENGINE_PID 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Engine → http://localhost:3001"
else
  echo -e "  ${RED}✗ Engine failed to start${NC}"
  exit 1
fi

# 3. Gateway
echo -e "${YELLOW}[3/5] Starting Gateway (FastAPI)...${NC}"
cd "$ROOT/services/gateway"
source .venv/bin/activate 2>/dev/null
uvicorn app.main:app --reload --port 8000 > /tmp/railswitch-gateway.log 2>&1 &
GATEWAY_PID=$!
sleep 3
if kill -0 $GATEWAY_PID 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Gateway → http://localhost:8000"
else
  echo -e "  ${RED}✗ Gateway failed to start${NC}"
  exit 1
fi

# 4. Dashboard
echo -e "${YELLOW}[4/5] Starting Dashboard...${NC}"
cd "$ROOT/apps/dashboard"
npm run dev -- -p 3000 > /tmp/railswitch-dashboard.log 2>&1 &
DASHBOARD_PID=$!
sleep 3
echo -e "  ${GREEN}✓${NC} Dashboard → http://localhost:3000"

# 5. Portal
echo -e "${YELLOW}[5/5] Starting Portal...${NC}"
cd "$ROOT/apps/portal"
npm run dev -- -p 3100 > /tmp/railswitch-portal.log 2>&1 &
PORTAL_PID=$!
sleep 3
echo -e "  ${GREEN}✓${NC} Portal → http://localhost:3100"

# Storefront (optional, different port)
cd "$ROOT/apps/storefront"
npm run dev -- -p 3200 > /tmp/railswitch-storefront.log 2>&1 &
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
echo "  Integration test: bash test_integration.sh"
echo ""

# Keep running until Ctrl+C
wait
