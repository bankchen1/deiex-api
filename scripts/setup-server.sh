#!/bin/bash

# Update system
apt update && apt upgrade -y

# Install Node.js and npm if not installed
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# Install certbot if not installed
if ! command -v certbot &> /dev/null; then
    apt install -y certbot python3-certbot-nginx
fi

# Setup SSL
certbot --nginx -d api.deiex.com --non-interactive --agree-tos -m your-email@example.com

# Copy Nginx configuration
cp /root/deiex-api/nginx/deiex-api.conf /etc/nginx/sites-available/
ln -sf /etc/nginx/sites-available/deiex-api.conf /etc/nginx/sites-enabled/
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
npm ci --production
npx prisma generate
npx prisma migrate deploy
npm run build

# Start application with PM2
pm2 delete deiex-api || true  # Delete existing process if it exists
pm2 start dist/main.js --name deiex-api
pm2 save
pm2 startup

# Setup log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Print status
echo "Deployment completed successfully!"
pm2 list
nginx -t
