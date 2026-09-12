import { Router, Request, Response } from 'express';
import { ShopifyService } from '../services/shopifyService';
import { ProductTransformer } from '../services/productTransformer';
import { AmazonPublishService } from '../services/amazonPublishService';
import { AmazonProductListing, AmazonAttributes } from '../types';

const router = Router();
const shopify = new ShopifyService();
const transformer = new ProductTransformer();
const amazon = new AmazonPublishService();

// Buscar producto por SKU (preview)
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
    
    // SIEMPRE crear listing nuevo - NO buscar ASIN
    const listing = transformer.transform(product);
    
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
        existingAsin: null,
        existingTitle: null,
        existingBrand: null,
        searchResultsCount: 0,
        matchType: 'NONE',
        canPublish: true,
        message: 'Se creará listing nuevo con GTIN: ' + (externalId || 'NO DISPONIBLE'),
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Publicar producto en Amazon - SIEMPRE crear listing nuevo con GTIN
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
    
    console.log(`[Publish] === Publicando SKU: ${req.params.sku} ===`);
    console.log(`[Publish] Modo: LISTING NUEVO con GTIN`);
    console.log(`[Publish] GTIN: ${externalId || 'NO DISPONIBLE'}`);
    
    // SIEMPRE crear listing nuevo - NUNCA usar ASIN existente
    const listing: AmazonProductListing = {
      shopifyProductId: product.id,
      sellerSku: variant?.sku || product.id,
      productType: req.body.productType || transformer.detectProductType(product),
      requirements: 'LISTING',
      externalId: externalId,
      externalIdType: transformer.detectIdType(externalId),
      quantity: req.body.stock !== undefined ? req.body.stock : (variant?.inventoryQuantity || 1),
    };
    
    // Aplicar overrides de contenido si vienen del panel
    if (req.body.title || req.body.description || req.body.bullets) {
      listing.attributes = {
        itemName: req.body.title || product.title,
        brand: product.vendor || 'Generic',
        conditionType: 'new_new',
      };
      if (req.body.description) listing.attributes.productDescription = req.body.description;
      if (req.body.bullets) listing.attributes.bulletPoint = req.body.bullets;
      if (req.body.color) listing.attributes.color = req.body.color;
      if (req.body.material) listing.attributes.material = req.body.material;
    }
    
    // Publicar en Amazon (siempre como listing nuevo)
    const result = await amazon.createListing(listing, extractedData);
    
    res.json({
      success: result.success,
      sku: req.params.sku,
      amazonSku: result.amazonSku,
      asin: null,
      matchType: 'NONE',
      message: result.message,
      errors: result.errors,
      timestamp: result.timestamp,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
