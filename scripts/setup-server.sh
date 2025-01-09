#!/bin/bash

# Update system
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2
npm install pm2 -g

# Install Nginx
apt install nginx -y

# Install Certbot for SSL
apt install certbot python3-certbot-nginx -y

# Install Redis
apt install redis-server -y

# Configure Redis
sed -i 's/supervised no/supervised systemd/' /etc/redis/redis.conf
sed -i 's/# requirepass foobared/requirepass $REDIS_PASSWORD/' /etc/redis/redis.conf
systemctl restart redis.service

# Install PostgreSQL
apt install postgresql postgresql-contrib -y

# Configure PostgreSQL
sudo -u postgres psql -c "CREATE DATABASE deiex;"
sudo -u postgres psql -c "CREATE USER deiex WITH ENCRYPTED PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE deiex TO deiex;"

# Setup SSL
certbot --nginx -d api.deiex.com --non-interactive --agree-tos -m your-email@example.com

# Copy Nginx configuration
cp /root/deiex-api/nginx/deiex-api.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/deiex-api.conf /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# Setup application
mkdir -p /root/deiex-api
cd /root/deiex-api
npm install
npm run build

# Start application with PM2
pm2 start dist/main.js --name deiex-api
pm2 save
pm2 startup
