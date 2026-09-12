import axios from 'axios';
import { config } from '../config';
import { AmazonProductListing, PublishResult } from '../types';
import { AmazonFieldGenerator } from './amazonFieldGenerator';
import { ExtractedProductData } from './productTransformer';

export class AmazonPublishService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private fieldGenerator = new AmazonFieldGenerator();
  
  private readonly spApiEndpoint = 'https://sellingpartnerapi-na.amazon.com';
  private readonly tokenEndpoint = 'https://api.amazon.com/auth/o2/token';

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }
    
    try {
      const refreshToken = process.env.AMAZON_REFRESH_TOKEN || config.amazon.refreshToken;
      const clientId = process.env.AMAZON_LWA_CLIENT_ID || config.amazon.lwaClientId;
      const clientSecret = process.env.AMAZON_LWA_CLIENT_SECRET || config.amazon.lwaClientSecret;
      
      console.log('[Amazon] Solicitando token...');
      
      const response = await axios.post(this.tokenEndpoint, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });
      
      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);
      
      console.log('[Amazon] ✅ Token obtenido');
      return this.accessToken!;
    } catch (error: any) {
      console.error('[Amazon] ❌ Error obteniendo token:', JSON.stringify(error.response?.data, null, 2));
      throw error;
    }
  }

  async createListing(listing: AmazonProductListing, extractedData?: ExtractedProductData): Promise<PublishResult> {
    try {
      const token = await this.getAccessToken();
      const sellerId = config.amazon.sellerId;
      const marketplaceId = config.amazon.marketplaceId;
      
      let payload: any;
      
      // ========== MODO 1: OFERTA EN LISTING EXISTENTE (con ASIN) ==========
      if (listing.asin) {
        console.log(`[Amazon] 📤 Modo OFERTA - ASIN: ${listing.asin}`);
        
        const attributes: any = {
          condition_type: [{
            value: 'new_new',
            marketplace_id: marketplaceId
          }],
          fulfillment_availability: [{
            quantity: listing.quantity || 1,
            fulfillment_channel_code: 'DEFAULT',
            marketplace_id: marketplaceId
          }]
        };
        
        // ASIN sugerido
        attributes.merchant_suggested_asin = [{
          value: listing.asin,
          marketplace_id: marketplaceId
        }];
        
        // NOTA: Cuando tenemos ASIN, no necesitamos enviar externalId
        // El ASIN es suficiente para crear la oferta
        
        payload = {
          productType: listing.productType,
          requirements: 'LISTING_OFFER_ONLY',
          attributes
        };
      } else {
        // ========== MODO 2: LISTING NUEVO (sin ASIN) ==========
        console.log(`[Amazon] 📤 Modo LISTING NUEVO - Tipo: ${listing.productType}`);
        
        if (!extractedData) {
          throw new Error('Se requieren datos extraídos para crear un listing nuevo');
        }
        
        // Generar todos los campos requeridos
        const fields = this.fieldGenerator.generateFields(listing.productType, extractedData);
        
        // Convertir a formato JSON-LD de Amazon
        const attributes = this.buildJsonLdAttributes(fields, marketplaceId, listing);
        
        payload = {
          productType: listing.productType,
          requirements: 'LISTING',
          attributes
        };
        
        console.log(`[Amazon] Campos generados: ${Object.keys(fields).length}`);
      }
      
      console.log(`[Amazon] Enviando a SP API...`);
      
      const url = `${this.spApiEndpoint}/listings/2021-08-01/items/${sellerId}/${listing.sellerSku}?marketplaceIds=${marketplaceId}`;
      
      const response = await axios.put(url, payload, {
        headers: {
          'x-amz-access-token': token,
          'Content-Type': 'application/json',
        },
      });
      
      const result = response.data;
      
      if (result.status === 'ACCEPTED') {
        console.log(`[Amazon] ✅ Producto publicado exitosamente`);
        return {
          shopifyProductId: listing.shopifyProductId || '',
          sku: listing.sellerSku,
          success: true,
          amazonSku: listing.sellerSku,
          message: 'Producto publicado exitosamente en Amazon México',
          timestamp: new Date().toISOString(),
        };
      } else {
        const issues = result.issues?.map((i: any) => i.message).join('; ') || 'Errores de validación';
        console.log(`[Amazon] ⚠️ Producto con issues: ${issues}`);
        return {
          shopifyProductId: listing.shopifyProductId || '',
          sku: listing.sellerSku,
          success: false,
          amazonSku: listing.sellerSku,
          message: issues,
          errors: result.issues || [],
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error('[Amazon] ❌ Error:', JSON.stringify(errorData, null, 2) || error.message);
      
      return {
        shopifyProductId: listing.shopifyProductId || '',
        sku: listing.sellerSku,
        success: false,
        amazonSku: listing.sellerSku,
        message: 'Error publicando en Amazon',
        errors: errorData?.errors?.map((e: any) => e.message) || [error.message],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Convierte campos generados al formato JSON-LD de Amazon
   */
  private buildJsonLdAttributes(fields: any, marketplaceId: string, listing: AmazonProductListing): any {
    const attributes: any = {};
    
    // Helper: atributo de texto (con language_tag)
    const addText = (key: string, value: any) => {
      if (value === undefined || value === null) return;
      attributes[key] = [{
        value,
        language_tag: 'es_MX',
        marketplace_id: marketplaceId,
      }];
    };
    
    // Helper: atributo simple (solo value + marketplace_id)
    const addSimple = (key: string, value: any) => {
      if (value === undefined || value === null) return;
      attributes[key] = [{
        value,
        marketplace_id: marketplaceId,
      }];
    };
    
    // Helper: atributo con unidad
    const addWithUnit = (key: string, obj: { value: number; unit: string }) => {
      if (!obj || obj.value === undefined) return;
      attributes[key] = [{
        value: obj.value,
        unit: obj.unit,
        marketplace_id: marketplaceId,
      }];
    };
    
    // Helper: atributo con dimensiones
    const addDimensions = (key: string, dims: { length?: number; width?: number; height?: number; unit?: string }) => {
      if (!dims) return;
      // Amazon espera 'length' no 'depth'
      const len = dims.length || 0;
      const wid = dims.width || 0;
      const hei = dims.height || 0;
      if (len === 0 || wid === 0 || hei === 0) return;
      attributes[key] = [{
        length: { value: len, unit: dims.unit || 'centimeters' },
        width: { value: wid, unit: dims.unit || 'centimeters' },
        height: { value: hei, unit: dims.unit || 'centimeters' },
        marketplace_id: marketplaceId,
      }];
    };
    
    // ========== CAMPOS BÁSICOS ==========
    addText('item_name', fields.item_name);
    addText('brand', fields.brand);
    addText('manufacturer', fields.manufacturer);
    addSimple('condition_type', fields.condition_type);
    addSimple('country_of_origin', fields.country_of_origin);
    addSimple('batteries_required', fields.batteries_required);
    addSimple('supplier_declared_dg_hz_regulation', fields.supplier_declared_dg_hz_regulation);
    addSimple('is_oem_authorized', fields.is_oem_authorized);
    addSimple('number_of_items', fields.number_of_items);
    
    // Precio
    if (fields.list_price) {
      attributes.list_price = [{
        currency: fields.list_price.currency,
        value_with_tax: fields.list_price.value_with_tax,
        marketplace_id: marketplaceId,
      }];
    }
    
    // Identificador externo
    if (fields.externally_assigned_product_identifier) {
      attributes.externally_assigned_product_identifier = [{
        value: fields.externally_assigned_product_identifier.value,
        type: fields.externally_assigned_product_identifier.type,
        marketplace_id: marketplaceId,
      }];
    }
    
    // Peso
    addWithUnit('item_weight', fields.item_weight);
    addWithUnit('website_shipping_weight', fields.website_shipping_weight);
    
    // Modelo
    addText('model_number', fields.model_number);
    addText('part_number', fields.part_number);
    
    // Viñetas
    if (fields.bullet_point && fields.bullet_point.length > 0) {
      attributes.bullet_point = fields.bullet_point.map((bullet: string) => ({
        value: bullet,
        language_tag: 'es_MX',
        marketplace_id: marketplaceId,
      }));
    }
    
    // Descripción
    addText('product_description', fields.product_description);
    
    // Garantía
    addText('warranty_description', fields.warranty_description);
    
    // Color
    addText('color', fields.color);
    
    // Material
    addText('material', fields.material);
    
    // Dimensiones
    addDimensions('item_depth_width_height', fields.item_depth_width_height);
    addDimensions('item_package_dimensions', fields.item_package_dimensions);
    
    // ========== CAMPOS ESPECÍFICOS ==========
    // Texto
    const textFields = [
      'item_type_keyword', 'connectivity_technology', 'form_factor', 'noise_cancellation',
      'included_components', 'power_source', 'water_resistance_level', 'battery_cell_composition',
      'wireless_carrier', 'color_temperature', 'compatible_devices', 'item_hardness',
      'material_type', 'filter_type', 'closure_type', 'controller_type', 'installation_type',
      'cable_feature', 'total_usb_ports',
    ];
    
    for (const field of textFields) {
      if (fields[field] !== undefined) {
        addText(field, fields[field]);
      }
    }
    
    // Fulfillment availability
    if (fields.fulfillment_availability) {
      attributes.fulfillment_availability = [{
        quantity: listing.quantity || fields.fulfillment_availability.quantity || 1,
        fulfillment_channel_code: fields.fulfillment_availability.fulfillment_channel_code || 'DEFAULT',
        marketplace_id: marketplaceId,
      }];
    }
    
    // Imágenes
    if (listing.attributes?.mainProductImageLocator) {
      attributes.main_product_image_locator = listing.attributes.mainProductImageLocator.map(img => ({
        marketplace_id: marketplaceId,
        media_location: img.mediaLocation,
      }));
    }
    
    return attributes;
  }

  async searchExistingProducts(keywords: string): Promise<any[]> {
    try {
      const token = await this.getAccessToken();
      const marketplaceId = config.amazon.marketplaceId;
      
      const response = await axios.get(
        `${this.spApiEndpoint}/catalog/2022-04-01/items?marketplaceIds=${marketplaceId}&keywords=${encodeURIComponent(keywords)}&includedData=identifiers,summaries`,
        {
          headers: {
            'x-amz-access-token': token,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data.items || [];
    } catch (error: any) {
      console.error('[Amazon] Error buscando productos:', error.message);
      return [];
    }
  }

  async uploadImage(sku: string, imageUrl: string): Promise<boolean> {
    console.log(`[Amazon] Subir imagen para ${sku}: ${imageUrl}`);
    return true;
  }
}
