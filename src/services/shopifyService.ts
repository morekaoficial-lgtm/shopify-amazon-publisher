import axios from 'axios';
import { config } from '../config';
import { ShopifyProduct } from '../types';

export class ShopifyService {
  private client = axios.create({
    baseURL: `https://${config.shopify.storeDomain}/admin/api/${config.shopify.apiVersion}`,
    headers: {
      'X-Shopify-Access-Token': config.shopify.accessToken,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });

  async getAllProducts(limit: number = 250): Promise<ShopifyProduct[]> {
    const products: ShopifyProduct[] = [];
    let url: string | null = `/products.json?limit=${Math.min(limit, 50)}`;
    
    while (url && products.length < limit) {
      console.log(`[Shopify] Obteniendo productos...`);
      const response = await this.client.get(url);
      const items = response.data.products || [];
      
      products.push(...items);
      console.log(`[Shopify] Obtenidos ${items.length} productos (total: ${products.length})`);
      
      // Paginación via link header
      const linkHeader = response.headers.link;
      url = this.extractNextUrl(linkHeader);
    }
    
    return products;
  }

  async getProduct(productId: string): Promise<ShopifyProduct | null> {
    try {
      const response = await this.client.get(`/products/${productId}.json`);
      return response.data.product || null;
    } catch (error) {
      console.error(`[Shopify] Error obteniendo producto ${productId}:`, error);
      return null;
    }
  }

  async getProductBySku(sku: string): Promise<ShopifyProduct | null> {
    try {
      // Buscar en TODAS las páginas de productos (la tienda tiene 1000+ productos)
      let url: string | null = `/products.json?limit=250`;
      let page = 1;
      
      while (url && page <= 10) {
        console.log(`[Shopify] Buscando SKU ${sku} - página ${page}...`);
        const response = await this.client.get(url);
        const products = response.data.products || [];
        
        // Encontrar producto que tenga la variante con el SKU buscado
        const foundProduct = products.find((p: any) => 
          p.variants?.some((v: any) => v.sku === sku)
        );
        
        if (foundProduct) {
          console.log(`[Shopify] ✅ SKU ${sku} encontrado en página ${page}: "${foundProduct.title}"`);
          return await this.getProductWithMetafields(foundProduct.id);
        }
        
        // Paginación via link header
        const linkHeader = response.headers.link;
        url = this.extractNextUrl(linkHeader);
        page++;
      }
      
      console.log(`[Shopify] ❌ SKU ${sku} no encontrado en ${page-1} páginas`);
      return null;
    } catch (error) {
      console.error(`[Shopify] Error buscando SKU ${sku}:`, error);
      return null;
    }
  }

  async getProductWithMetafields(productId: string): Promise<ShopifyProduct | null> {
    try {
      // Obtener producto con metafields (donde puede estar el GTIN/EAN/UPC)
      const response = await this.client.get(`/products/${productId}.json`);
      const product = response.data.product;
      
      if (!product) return null;
      
      // Esperar para respetar rate limit de Shopify (2 calls/segundo)
      await this.delay(500);
      
      // Obtener metafields del producto
      try {
        const metaResponse = await this.client.get(`/products/${productId}/metafields.json`);
        product.metafields = metaResponse.data.metafields || [];
      } catch (e) {
        product.metafields = [];
      }
      
      // Obtener metafields de cada variante (donde suele estar el barcode/GTIN)
      for (const variant of product.variants || []) {
        await this.delay(500); // Rate limit
        try {
          const variantMeta = await this.client.get(`/products/${productId}/variants/${variant.id}/metafields.json`);
          variant.metafields = variantMeta.data.metafields || [];
        } catch (e) {
          variant.metafields = [];
        }
        
        // El barcode en Shopify suele ser el GTIN/EAN/UPC
        if (variant.barcode && !variant.barcode.startsWith('shopify_')) {
          variant.externalId = variant.barcode;
          variant.externalIdType = this.detectIdType(variant.barcode);
        }
      }
      
      return product;
    } catch (error) {
      console.error(`[Shopify] Error obteniendo producto ${productId}:`, error);
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private detectIdType(barcode: string): string {
    const clean = barcode.replace(/\D/g, '');
    if (clean.length === 12) return 'upc';
    if (clean.length === 13) return 'ean';
    if (clean.length === 14) return 'gtin';
    return 'ean';
  }

  async getProductCount(): Promise<number> {
    try {
      const response = await this.client.get('/products/count.json');
      return response.data.count || 0;
    } catch (error) {
      console.error('[Shopify] Error obteniendo conteo:', error);
      return 0;
    }
  }

  private extractNextUrl(linkHeader: string | undefined): string | null {
    if (!linkHeader) return null;
    const match = linkHeader.match(/<([^>]+)>\s*;\s*rel="next"/);
    return match ? match[1] : null;
  }
}
