#!/bin/bash
LOGDIR="/tmp/railswitch-logs"

if [ "$1" = "errors" ]; then
  tail -f "$LOGDIR"/*.log | grep -i --color "error\|fail\|exception\|traceback" --line-buffered
elif [ "$1" = "engine" ]; then
  tail -f "$LOGDIR/engine.log"
elif [ "$1" = "gateway" ]; then
  tail -f "$LOGDIR/gateway.log"
elif [ "$1" = "dashboard" ]; then
  tail -f "$LOGDIR/dashboard.log"
elif [ "$1" = "all" ] || [ -z "$1" ]; then
  tail -f "$LOGDIR"/*.log
else
  echo "Usage: bash scripts/logs.sh [all|errors|engine|gateway|dashboard]"
fi
