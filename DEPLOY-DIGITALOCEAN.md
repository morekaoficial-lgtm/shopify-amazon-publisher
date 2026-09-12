# Deploy en DigitalOcean

## 1. Conectar al Droplet

```bash
ssh root@TU_IP_DIGITALOCEAN
```

## 2. Instalar dependencias

```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Instalar PM2 globalmente
npm install -g pm2

# Instalar Git
apt install -y git
```

## 3. Clonar el repositorio

```bash
cd /opt
git clone https://github.com/morekaoficial-lgtm/bsale-amazon-sync.git shopify-amazon-publisher
cd shopify-amazon-publisher/projects/shopify-amazon-publisher
```

## 4. Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Editar el archivo `.env` con tus credenciales:

```env
# Shopify
SHOPIFY_STORE_DOMAIN=tu-tienda.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxx

# Amazon SP-API
AMAZON_REFRESH_TOKEN=Atzr|xxxxxxxx
AMAZON_LWA_CLIENT_ID=amzn1.application-oa2-client.xxxxxxxx
AMAZON_LWA_CLIENT_SECRET=xxxxxxxx
AMAZON_SELLER_ID=Axxxxxxxxxxxxx
AMAZON_MARKETPLACE_ID=A1AM78C64UM0Y8

# Servidor
NODE_ENV=production
LOG_LEVEL=info
```

## 5. Instalar dependencias y compilar

```bash
npm install
npm run build
```

## 6. Iniciar con PM2

```bash
pm2 start dist/app.js --name "shopify-amazon-publisher" -- --port 3007

# Guardar configuración
pm2 save

# Configurar inicio automático
pm2 startup systemd
```

## 7. Configurar Nginx (opcional, para dominio)

```bash
apt install -y nginx
```

Crear configuración:

```bash
nano /etc/nginx/sites-available/shopify-amazon
```

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3007;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activar:

```bash
ln -s /etc/nginx/sites-available/shopify-amazon /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## 8. Verificar estado

```bash
# Ver logs
pm2 logs shopify-amazon-publisher

# Ver estado
pm2 status

# Probar API
curl http://localhost:3007/api/products
```

## 9. Comandos útiles

```bash
# Reiniciar
pm2 restart shopify-amazon-publisher

# Detener
pm2 stop shopify-amazon-publisher

# Eliminar
pm2 delete shopify-amazon-publisher

# Ver logs en tiempo real
pm2 logs shopify-amazon-publisher --lines 100

# Monitoreo
pm2 monit
```

## Puerto

- **Local**: 3008
- **Producción**: 3007

## Panel Web

Acceder a: `http://TU_IP:3007/` o `http://tu-dominio.com/`
