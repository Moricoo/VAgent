#!/bin/bash

# VAgent 一键启动脚本

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

BACKEND_PORT=3001
FRONTEND_PORT=5173
BACKEND_PID_FILE=".backend.pid"
FRONTEND_PID_FILE=".frontend.pid"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_banner() {
  echo -e "${CYAN}"
  echo "  ╦  ╦╔═╗╔═╗╔═╗╔╗╔╔╦╗"
  echo "  ╚╗╔╝╠═╣║ ╦║╣ ║║║ ║ "
  echo "   ╚╝ ╩ ╩╚═╝╚═╝╝╚╝ ╩ "
  echo -e "${RESET}${BOLD}  AI 智能视频剪辑平台${RESET}"
  echo ""
}

check_node() {
  if ! command -v node &>/dev/null; then
    echo -e "${RED}✗ 未检测到 Node.js，请先安装 Node.js (https://nodejs.org)${RESET}"
    exit 1
  fi
  local version
  version=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$version" -lt 16 ]; then
    echo -e "${RED}✗ Node.js 版本过低 (当前: $(node -v))，需要 v16 或更高版本${RESET}"
    exit 1
  fi
  echo -e "${GREEN}✓ Node.js $(node -v)${RESET}"
}

check_port() {
  lsof -i :"$1" -sTCP:LISTEN -t &>/dev/null
}

kill_port() {
  local pid
  pid=$(lsof -i :"$1" -sTCP:LISTEN -t 2>/dev/null)
  if [ -n "$pid" ]; then
    kill "$pid" 2>/dev/null
    sleep 1
  fi
}

install_deps() {
  local dir="$1"
  local name="$2"
  if [ ! -d "$dir/node_modules" ]; then
    echo -e "${YELLOW}  → 正在安装 ${name} 依赖...${RESET}"
    (cd "$dir" && npm install --silent 2>&1)
    echo -e "${GREEN}  ✓ ${name} 依赖安装完成${RESET}"
  fi
}

stop_services() {
  echo -e "\n${YELLOW}正在停止服务...${RESET}"
  if [ -f "$ROOT_DIR/$BACKEND_PID_FILE" ]; then
    kill "$(cat "$ROOT_DIR/$BACKEND_PID_FILE")" 2>/dev/null
    rm -f "$ROOT_DIR/$BACKEND_PID_FILE"
  fi
  if [ -f "$ROOT_DIR/$FRONTEND_PID_FILE" ]; then
    kill "$(cat "$ROOT_DIR/$FRONTEND_PID_FILE")" 2>/dev/null
    rm -f "$ROOT_DIR/$FRONTEND_PID_FILE"
  fi
  kill_port $BACKEND_PORT
  kill_port $FRONTEND_PORT
  echo -e "${GREEN}✓ 服务已停止${RESET}"
  exit 0
}

trap stop_services INT TERM

# ── 主流程 ──────────────────────────────────────────────

clear
print_banner

echo -e "${BOLD}[ 1/4 ] 环境检查${RESET}"
check_node

# 端口冲突处理
if check_port $BACKEND_PORT; then
  echo -e "${YELLOW}  ⚠ 端口 ${BACKEND_PORT} 已被占用，正在释放...${RESET}"
  kill_port $BACKEND_PORT
fi
if check_port $FRONTEND_PORT; then
  echo -e "${YELLOW}  ⚠ 端口 ${FRONTEND_PORT} 已被占用，正在释放...${RESET}"
  kill_port $FRONTEND_PORT
fi
echo -e "${GREEN}✓ 端口检查完成${RESET}"
echo ""

echo -e "${BOLD}[ 2/4 ] 安装依赖${RESET}"
install_deps "$ROOT_DIR/backend"  "后端"
install_deps "$ROOT_DIR/frontend" "前端"
echo ""

echo -e "${BOLD}[ 3/4 ] 启动后端服务 (端口 ${BACKEND_PORT})${RESET}"
mkdir -p "$ROOT_DIR/backend/uploads"
(cd "$ROOT_DIR/backend" && node -r ts-node/register/transpile-only src/index.ts > "$ROOT_DIR/backend.log" 2>&1) &
BACKEND_PID=$!
echo $BACKEND_PID > "$ROOT_DIR/$BACKEND_PID_FILE"

# 等待后端就绪（健康检查：登录接口）
for i in {1..20}; do
  sleep 1
  if lsof -i :"${BACKEND_PORT}" -sTCP:LISTEN -t &>/dev/null; then
    echo -e "${GREEN}✓ 后端服务启动成功 → http://localhost:${BACKEND_PORT}${RESET}"
    break
  fi
  if [ $i -eq 20 ]; then
    echo -e "${RED}✗ 后端启动超时，请检查 backend.log${RESET}"
    tail -10 "$ROOT_DIR/backend.log"
    stop_services
  fi
  printf "  等待后端就绪... %ds\r" $i
done
echo ""

echo -e "${BOLD}[ 4/4 ] 启动前端服务 (端口 ${FRONTEND_PORT})${RESET}"
(cd "$ROOT_DIR/frontend" && npm run dev > "$ROOT_DIR/frontend.log" 2>&1) &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$ROOT_DIR/$FRONTEND_PID_FILE"

for i in {1..20}; do
  sleep 1
  if curl -s "http://localhost:${FRONTEND_PORT}" &>/dev/null; then
    echo -e "${GREEN}✓ 前端服务启动成功 → http://localhost:${FRONTEND_PORT}${RESET}"
    break
  fi
  if [ $i -eq 20 ]; then
    echo -e "${RED}✗ 前端启动超时，请检查 frontend.log${RESET}"
    stop_services
  fi
  printf "  等待前端就绪... %ds\r" $i
done

# ── 启动成功 ─────────────────────────────────────────────

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}${GREEN}  🚀 VAgent 启动成功！${RESET}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  ${BOLD}访问地址：${RESET}  http://localhost:${FRONTEND_PORT}"
echo -e "  ${BOLD}后端接口：${RESET}  http://localhost:${BACKEND_PORT}"
echo ""
echo -e "  ${BOLD}演示账号：${RESET}"
echo -e "    用户名: ${CYAN}admin${RESET}  密码: ${CYAN}admin123${RESET}"
echo -e "    用户名: ${CYAN}demo${RESET}   密码: ${CYAN}demo123${RESET}"
echo ""
echo -e "  ${BOLD}日志文件：${RESET}"
echo -e "    后端日志: ${YELLOW}backend.log${RESET}"
echo -e "    前端日志: ${YELLOW}frontend.log${RESET}"
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  按 ${BOLD}Ctrl+C${RESET} 停止所有服务"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# 自动在浏览器中打开
if command -v open &>/dev/null; then
  sleep 1 && open "http://localhost:${FRONTEND_PORT}" &
fi

# 保持脚本运行，监控子进程
wait $BACKEND_PID $FRONTEND_PID
