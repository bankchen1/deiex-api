#!/bin/bash

# Update system
apt-get update
apt-get upgrade -y

# Install required packages
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common \
    nginx \
    git \
    nodejs \
    npm

# Install PostgreSQL client
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt-get update
apt-get install -y postgresql-client-16

# Configure environment variables
cat << EOF > /etc/environment
DB_HOST=${db_host}
DB_PORT=${db_port}
DB_NAME=${db_name}
DB_USER=${db_user}
DB_PASSWORD=${db_password}
REDIS_HOST=${redis_host}
REDIS_PORT=${redis_port}
REDIS_PASSWORD=${redis_password}
NODE_ENV=${environment}
EOF

# Configure Nginx
cat << EOF > /etc/nginx/sites-available/default
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:1212;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Restart Nginx
systemctl restart nginx

# Clone application repository
git clone https://github.com/yourusername/exchange.git /opt/exchange

# Install application dependencies
cd /opt/exchange
npm install

# Build application
npm run build

# Create systemd service
cat << EOF > /etc/systemd/system/exchange.service
[Unit]
Description=DEiEX Exchange API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/exchange
EnvironmentFile=/etc/environment
ExecStart=/usr/bin/npm run start:prod
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Start and enable service
systemctl enable exchange
systemctl start exchange
