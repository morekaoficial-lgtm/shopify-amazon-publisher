#!/bin/bash
set -e

echo "🚀 Deploy de Shopify Amazon Publisher en DigitalOcean"
echo "======================================================"

# Verificar si se ejecuta como root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Ejecutar como root: sudo bash deploy.sh"
    exit 1
fi

# Variables
APP_DIR="/opt/shopify-amazon-publisher"
REPO_URL="https://github.com/morekaoficial-lgtm/bsale-amazon-sync.git"
PORT=3007

echo "📦 Instalando dependencias..."
apt update -qq
apt install -y -qq git curl nginx

# Node.js 20
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" != "20" ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y -qq nodejs
fi

# PM2
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

echo "📥 Clonando repositorio..."
if [ -d "$APP_DIR" ]; then
    rm -rf "$APP_DIR"
fi

git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR/projects/shopify-amazon-publisher"

echo "⚙️  Configurando variables de entorno..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Edita el archivo .env con tus credenciales:"
    echo "   nano $APP_DIR/projects/shopify-amazon-publisher/.env"
    echo ""
    echo "   Variables requeridas:"
    echo "   - SHOPIFY_STORE_DOMAIN"
    echo "   - SHOPIFY_ACCESS_TOKEN"
    echo "   - AMAZON_REFRESH_TOKEN"
    echo "   - AMAZON_LWA_CLIENT_ID"
    echo "   - AMAZON_LWA_CLIENT_SECRET"
    echo "   - AMAZON_SELLER_ID"
    echo ""
    read -p "Presiona ENTER cuando hayas configurado el archivo .env..."
fi

echo "🔧 Instalando dependencias..."
npm install

echo "🏗️  Compilando..."
npm run build

echo "🚀 Iniciando con PM2..."
pm2 delete shopify-amazon-publisher 2>/dev/null || true
pm2 start dist/app.js --name "shopify-amazon-publisher" -- --port $PORT
pm2 save
pm2 startup systemd -u root --hp /root

echo "🔥 Configurando firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow $PORT/tcp
ufw --force enable

echo ""
echo "✅ Deploy completado!"
echo ""
echo "📊 Estado: pm2 status"
echo "📝 Logs:   pm2 logs shopify-amazon-publisher"
echo "🌐 Panel:  http://$(curl -s ifconfig.me):$PORT"
echo ""
echo "🚀 Para actualizar en el futuro:"
echo "   cd $APP_DIR/projects/shopify-amazon-publisher"
echo "   git pull"
echo "   npm install"
echo "   npm run build"
echo "   pm2 restart shopify-amazon-publisher"
