#!/bin/bash

# Update system
apt update && apt upgrade -y

# Setup SSL
certbot --nginx -d api.deiex.com --non-interactive --agree-tos -m your-email@example.com

# Copy Nginx configuration
cp /root/deiex-api/nginx/deiex-api.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/deiex-api.conf /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# Setup application
mkdir -p /root/deiex-api
cd /root/deiex-api

# Create .env file
cat > .env << EOF
# Database Configuration
DATABASE_URL="postgresql://deiexuser:${DB_PASSWORD}@localhost:5432/deiex"

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=1d

# Server Configuration
PORT=3000
NODE_ENV=production
EOF

# Install dependencies and build
npm install
npx prisma generate
npx prisma migrate deploy
npm run build

# Start application with PM2
pm2 start dist/main.js --name deiex-api
pm2 save
pm2 startup
