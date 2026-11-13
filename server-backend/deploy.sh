#!/bin/bash
# InfiNet VPS Deploy Script
# Installs Node.js, PM2 process manager, sets up firewall & launches secure backend

echo "=== InfiNet Server Backend Deployment ==="

# 1. Update packages
apt-get update -y && apt-get install -y curl ufw

# 2. Install Node.js (v20 LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. Install PM2 daemon manager
npm install -g pm2

# 4. Navigate to backend directory & install dependencies
cd /root/infinet-backend || mkdir -p /root/infinet-backend && cd /root/infinet-backend
npm install

# 5. Open API port in firewall (port 4000)
ufw allow 4000/tcp
ufw reload

# 6. Start API with PM2 autostart
pm2 delete infinet-api 2>/dev/null || true
pm2 start server.js --name "infinet-api"
pm2 save
pm2 startup

echo "=== InfiNet Secure API deployed and running on port 4000! ==="
