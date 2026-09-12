import { Router, Request, Response } from 'express';
import { ShopifyService } from '../services/shopifyService';
import { ProductTransformer } from '../services/productTransformer';
import { AmazonPublishService } from '../services/amazonPublishService';
import { AmazonProductListing, AmazonAttributes } from '../types';

const router = Router();
const shopify = new ShopifyService();
const transformer = new ProductTransformer();
const amazon = new AmazonPublishService();

// Buscar producto por SKU (preview con búsqueda en Amazon)
router.get('/sku/:sku', async (req: Request, res: Response) => {
  try {
    const product = await shopify.getProductBySku(req.params.sku);
    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado en Shopify' });
      return;
    }
    
    const variant = product.variants[0];
    const externalId = variant?.externalId || variant?.barcode;
    
    // Extraer datos de Shopify
    const extractedData = transformer.extractAllData(product);
    
    // Buscar en Amazon por título
    console.log(`[Publish] Buscando en Amazon por título: "${product.title}"...`);
    const searchResults = await amazon.searchExistingProducts(product.title);
    
    // Buscar coincidencia por marca
    const brandMatch = searchResults.find((item: any) => 
      item.summaries?.[0]?.brand?.toLowerCase() === (product.vendor || '').toLowerCase()
    );
    
    // Buscar coincidencia por GTIN/EAN
    let gtinMatch = null;
    if (externalId) {
      gtinMatch = searchResults.find((item: any) => {
        const identifiers = item.identifiers?.[0]?.identifiers || [];
        return identifiers.some((id: any) => 
          id.identifier?.replace(/\D/g, '') === externalId.replace(/\D/g, '')
        );
      });
    }
    
    // Si no hay coincidencia por título, buscar por GTIN directamente
    let gtinSearchResults: any[] = [];
    if (!gtinMatch && externalId) {
      console.log(`[Publish] Buscando en Amazon por GTIN: ${externalId}...`);
      gtinSearchResults = await amazon.searchExistingProducts(externalId);
    }
    
    // Usar la mejor coincidencia
    const existingProduct = gtinMatch || brandMatch || gtinSearchResults[0];
    const existingAsin = existingProduct?.asin;
    const existingExternalId = existingProduct?.identifiers?.[0]?.identifiers?.[0]?.identifier;
    
    // Transformar para preview
    const listing = transformer.transform(
      product, 
      existingAsin,
      existingExternalId
    );
    
    res.json({
      shopify: {
        id: product.id,
        title: product.title,
        description: product.description,
        sku: variant?.sku,
        price: variant?.price,
        barcode: variant?.barcode,
        externalId: variant?.externalId,
        images: product.images.map(img => img.src),
      },
      extracted: extractedData,
      amazon: {
        ...listing,
        existingAsin: existingAsin || null,
        existingTitle: existingProduct?.summaries?.[0]?.itemName || null,
        existingBrand: existingProduct?.summaries?.[0]?.brand || null,
        searchResultsCount: searchResults.length + gtinSearchResults.length,
        matchType: gtinMatch ? 'GTIN/EAN' : (brandMatch ? 'BRAND+TITLE' : (gtinSearchResults[0] ? 'GTIN_SEARCH' : 'NONE')),
        canPublish: true,
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Publicar producto en Amazon
router.post('/sku/:sku', async (req: Request, res: Response) => {
  try {
    const product = await shopify.getProductBySku(req.params.sku);
    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado en Shopify' });
      return;
    }
    
    const variant = product.variants[0];
    const externalId = variant?.externalId || variant?.barcode;
    
    // Extraer TODOS los datos de Shopify
    const extractedData = transformer.extractAllData(product);
    
    // Aplicar overrides del panel si existen
    if (req.body.title) extractedData.title = req.body.title;
    if (req.body.description) extractedData.description = req.body.description;
    if (req.body.bullets) extractedData.bullets = req.body.bullets;
    if (req.body.color) extractedData.color = req.body.color;
    if (req.body.material) extractedData.material = req.body.material;
    if (req.body.modelNumber) extractedData.modelNumber = req.body.modelNumber;
    
    // === PASO 1: Buscar en Amazon por título ===
    console.log(`[Publish] === Publicando SKU: ${req.params.sku} ===`);
    console.log(`[Publish] Paso 1: Buscando en Amazon por título...`);
    const searchResults = await amazon.searchExistingProducts(product.title);
    
    // Buscar coincidencia por GTIN/EAN en resultados de título
    let gtinMatch = null;
    if (externalId) {
      gtinMatch = searchResults.find((item: any) => {
        const identifiers = item.identifiers?.[0]?.identifiers || [];
        return identifiers.some((id: any) => 
          id.identifier?.replace(/\D/g, '') === externalId.replace(/\D/g, '')
        );
      });
    }
    
    // Buscar coincidencia por marca
    const brandMatch = searchResults.find((item: any) => 
      item.summaries?.[0]?.brand?.toLowerCase() === (product.vendor || '').toLowerCase()
    );
    
    // === PASO 2: Si no hay coincidencia, buscar por GTIN directamente ===
    let gtinSearchResults: any[] = [];
    if (!gtinMatch && !brandMatch && externalId) {
      console.log(`[Publish] Paso 2: Buscando en Amazon por GTIN/EAN: ${externalId}...`);
      gtinSearchResults = await amazon.searchExistingProducts(externalId);
    }
    
    // === PASO 3: Determinar ASIN ===
    const existingProduct = gtinMatch || brandMatch || gtinSearchResults[0];
    const existingAsin = existingProduct?.asin;
    const existingExternalId = existingProduct?.identifiers?.[0]?.identifiers?.[0]?.identifier;
    
    if (existingAsin) {
      console.log(`[Publish] ✅ Producto encontrado en Amazon: ASIN ${existingAsin}`);
      console.log(`[Publish] Tipo de coincidencia: ${gtinMatch ? 'GTIN/EAN' : (brandMatch ? 'BRAND+TITLE' : 'GTIN_SEARCH')}`);
    } else {
      console.log(`[Publish] ⚠️ Producto NO encontrado en Amazon. Se creará listing nuevo con GTIN: ${externalId || 'NO DISPONIBLE'}`);
    }
    
    // === PASO 4: Transformar y publicar ===
    const listing = transformer.transform(
      product,
      existingAsin,
      existingExternalId
    );
    
    // Aplicar product type override si viene del panel
    if (req.body.productType) {
      listing.productType = req.body.productType;
    }
    
    // Forzar stock si el usuario lo pidió
    if (req.body.stock !== undefined) {
      listing.quantity = req.body.stock;
    }
    
    // Si hay overrides de contenido, actualizar atributos
    if (req.body.title || req.body.description || req.body.bullets) {
      if (!listing.attributes) {
        listing.attributes = {
          itemName: req.body.title || product.title,
          brand: product.vendor || 'Generic',
          conditionType: 'new_new',
        };
      }
      if (req.body.title) listing.attributes.itemName = req.body.title;
      if (req.body.description) listing.attributes.productDescription = req.body.description;
      if (req.body.bullets) listing.attributes.bulletPoint = req.body.bullets;
      if (req.body.color) listing.attributes.color = req.body.color;
      if (req.body.material) listing.attributes.material = req.body.material;
    }
    
    // Publicar en Amazon (con datos extraídos para listings nuevos)
    const result = await amazon.createListing(listing, extractedData);
    
    res.json({
      success: result.success,
      sku: req.params.sku,
      amazonSku: result.amazonSku,
      asin: existingAsin || null,
      matchType: gtinMatch ? 'GTIN/EAN' : (brandMatch ? 'BRAND+TITLE' : (gtinSearchResults[0] ? 'GTIN_SEARCH' : 'NONE')),
      message: result.message,
      errors: result.errors,
      timestamp: result.timestamp,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
