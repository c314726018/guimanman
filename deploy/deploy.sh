#!/usr/bin/env bash
# 柜满满 一键部署到腾讯云服务器
# 用法: ./deploy.sh user@服务器IP
# 前提: 本机 ~/.ssh/id_ed25519 公钥已加入服务器 authorized_keys
set -euo pipefail

DEST="${1:?用法: ./deploy.sh user@服务器IP}"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_DIR="/var/www/guimanman"

echo "==> 同步静态文件到 $DEST:$REMOTE_DIR"
ssh "$DEST" "sudo mkdir -p $REMOTE_DIR && sudo chown \$(whoami) $REMOTE_DIR"
rsync -avz --delete \
  --exclude 'node_modules/' \
  --exclude 'test_pack.js' \
  --exclude 'test_e2e.js' \
  --exclude 'e2e_*.png' \
  --exclude 'deploy/' \
  --exclude '.git/' \
  "$LOCAL_DIR/" "$DEST:$REMOTE_DIR/"

echo "==> 安装 nginx 配置"
cat "$LOCAL_DIR/deploy/nginx-guimanman.conf" | ssh "$DEST" "sudo tee /etc/nginx/sites-available/guimanman.conf >/dev/null"
ssh "$DEST" "sudo ln -sf /etc/nginx/sites-available/guimanman.conf /etc/nginx/sites-enabled/guimanman.conf && sudo nginx -t && sudo systemctl reload nginx"

echo "✅ 部署完成: http://服务器IP/  （域名解析生效 + 备案通过后即可用 https://guimanman.com）"
echo "提示: HTTPS 证书等域名解析生效后运行: sudo certbot --nginx -d guimanman.com -d www.guimanman.com"
