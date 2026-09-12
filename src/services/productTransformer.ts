import { ShopifyProduct, AmazonProductListing, AmazonAttributes } from '../types';

export interface ExtractedProductData {
  title: string;
  description: string;
  cleanDescription: string;
  brand: string;
  price: string;
  sku: string;
  externalId?: string;
  externalIdType?: string;
  weight?: number;
  weightUnit?: string;
  color?: string;
  material?: string;
  modelNumber?: string;
  connectivity?: string;
  powerSource?: string;
  wattage?: string;
  voltage?: string;
  capacity?: string;
  batteryCapacity?: string;
  bullets: string[];
  images: string[];
  tags: string[];
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  isWireless: boolean;
  hasBattery: boolean;
  isWaterproof: boolean;
  compatibleModels?: string[];
  screenSize?: string;
}

export class ProductTransformer {
  /**
   * Extrae TODA la información posible de un producto Shopify
   */
  extractAllData(shopifyProduct: ShopifyProduct): ExtractedProductData {
    const variant = shopifyProduct.variants[0];
    const description = shopifyProduct.description || '';
    
    return {
      title: this.cleanTitle(shopifyProduct.title),
      description,
      cleanDescription: this.cleanDescription(description),
      brand: shopifyProduct.vendor || 'Generic',
      price: variant?.price || '0',
      sku: variant?.sku || shopifyProduct.id,
      externalId: this.getExternalId(variant),
      externalIdType: this.detectIdType(variant?.externalId || variant?.barcode),
      weight: variant?.weight && variant.weight > 0 ? variant.weight : undefined,
      weightUnit: variant?.weightUnit,
      color: this.extractColor(shopifyProduct.title, variant?.title, description),
      material: this.extractMaterial(shopifyProduct.title, description),
      modelNumber: this.extractModelNumber(shopifyProduct.title, description),
      connectivity: this.detectConnectivity(shopifyProduct.title, description),
      powerSource: this.detectPowerSource(shopifyProduct.title, description),
      wattage: this.extractNumericValue(description, ['W', 'watt', 'watts', 'Watts', 'W']),
      voltage: this.extractNumericValue(description, ['V', 'volt', 'volts', 'Volt']),
      capacity: this.extractNumericValue(description, ['mAh', 'MAH', 'mAH', 'BTU', 'btu']),
      batteryCapacity: this.extractNumericValue(description, ['mAh', 'MAH']),
      bullets: this.extractBulletPoints(description),
      images: (shopifyProduct.images || []).map(img => img.src),
      tags: Array.isArray(shopifyProduct.tags) ? shopifyProduct.tags : [],
      dimensions: this.extractDimensions(description),
      isWireless: this.detectWireless(shopifyProduct.title, description),
      hasBattery: this.detectBattery(shopifyProduct.title, description),
      isWaterproof: this.detectWaterproof(shopifyProduct.title, description),
      compatibleModels: this.extractCompatibleModels(description),
      screenSize: this.extractScreenSize(description),
    };
  }

  /**
   * Transforma un producto de Shopify a formato Amazon
   */
  transform(shopifyProduct: ShopifyProduct, existingAsin?: string, externalId?: string): AmazonProductListing {
    const variant = shopifyProduct.variants[0];
    const sku = variant?.sku || shopifyProduct.id;
    const productExternalId = externalId || variant?.externalId || variant?.barcode;
    const productExternalIdType = variant?.externalIdType || this.detectIdType(productExternalId);
    const productType = this.detectProductType(shopifyProduct);
    
    // Para ofertas en listings existentes, solo necesitamos campos básicos
    if (existingAsin) {
      return {
        shopifyProductId: shopifyProduct.id,
        sellerSku: sku,
        productType,
        requirements: 'LISTING_OFFER_ONLY',
        asin: existingAsin,
        externalId: productExternalId,
        externalIdType: productExternalIdType,
        quantity: variant?.inventoryQuantity || 1,
      };
    }
    
    // Para listings nuevos, construir atributos completos
    const data = this.extractAllData(shopifyProduct);
    const attributes = this.buildAmazonAttributes(data, productType);
    
    return {
      shopifyProductId: shopifyProduct.id,
      sellerSku: sku,
      productType,
      requirements: 'LISTING',
      attributes,
      externalId: productExternalId,
      externalIdType: productExternalIdType,
      quantity: variant?.inventoryQuantity || 1,
    };
  }

  /**
   * Construye atributos de Amazon a partir de los datos extraídos
   */
  private buildAmazonAttributes(data: ExtractedProductData, productType: string): AmazonAttributes {
    const marketplaceId = 'A1AM78C64UM0Y8';
    
    const attributes: AmazonAttributes = {
      itemName: data.title.substring(0, 200),
      brand: data.brand,
      conditionType: 'new_new',
      listPrice: {
        currencyCode: 'MXN',
        amount: data.price,
      },
    };
    
    // Descripción y bullets
    if (data.cleanDescription) {
      attributes.productDescription = data.cleanDescription.substring(0, 2000);
    }
    
    if (data.bullets.length > 0) {
      attributes.bulletPoint = data.bullets.slice(0, 5);
    }
    
    // Color
    if (data.color) {
      attributes.color = data.color;
    }
    
    // Material
    if (data.material) {
      attributes.material = data.material;
    }
    
    // Imágenes
    if (data.images.length > 0) {
      attributes.mainProductImageLocator = [{
        marketplaceId,
        mediaLocation: data.images[0],
      }];
      
      if (data.images.length > 1) {
        attributes.otherProductImageLocator = data.images.slice(1, 5).map(src => ({
          marketplaceId,
          mediaLocation: src,
        }));
      }
    }
    
    // Peso
    if (data.weight && data.weight > 0) {
      attributes.packageWeight = {
        unit: this.mapWeightUnit(data.weightUnit || 'g'),
        value: data.weight,
      };
    }
    
    // Keywords
    if (data.tags.length > 0) {
      attributes.keywords = data.tags.slice(0, 10);
    }
    
    return attributes;
  }

  // ============ EXTRACTORES AVANZADOS ============

  private getExternalId(variant: any): string | undefined {
    if (!variant) return undefined;
    // Usar el ID tal cual, sin eliminar ceros iniciales
    const id = variant.externalId || variant.barcode;
    if (!id) return undefined;
    // Solo limpiar caracteres no numéricos, PRESERVAR ceros iniciales
    return id.replace(/\D/g, '');
  }

  private extractBulletPoints(description: string): string[] {
    if (!description) return [];
    
    const plainText = description
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const bullets: string[] = [];
    
    // 1. Buscar listas con viñetas HTML
    const htmlListPattern = /<li[^>]*>(.*?)<\/li>/gi;
    let match;
    while ((match = htmlListPattern.exec(description)) !== null) {
      const bullet = match[1].replace(/<[^>]*>/g, ' ').trim();
      if (bullet.length > 10 && bullet.length < 500) {
        bullets.push(bullet);
      }
    }
    
    // 2. Buscar viñetas de texto
    if (bullets.length === 0) {
      const textListPattern = /[•\-\*\u2713\u2714]\s*([^•\-\*\n]+)/g;
      while ((match = textListPattern.exec(plainText)) !== null) {
        const bullet = match[1].trim();
        if (bullet.length > 10 && bullet.length < 500) {
          bullets.push(bullet);
        }
      }
    }
    
    // 3. Buscar patrones "Feature:", "Característica:", etc.
    if (bullets.length === 0) {
      const featurePattern = /(?:caracter[íi]stica|feature|especificaci[óo]n|spec|detalle)[\s:]*([^\n.]+)/gi;
      while ((match = featurePattern.exec(plainText)) !== null) {
        const bullet = match[1].trim();
        if (bullet.length > 10 && bullet.length < 500) {
          bullets.push(bullet);
        }
      }
    }
    
    // 4. Extraer oraciones con palabras clave de features
    if (bullets.length === 0) {
      const featureKeywords = [
        'bluetooth', 'inalámbrico', 'wireless', 'batería', 'battery',
        'horas', 'hours', 'resistente', 'waterproof', 'ipx', 'ip68',
        'cancelación', 'noise', 'ruido', 'calidad', 'sonido', 'audio',
        'garantía', 'warranty', 'compatible', 'diseño', 'ergonómico',
        'pantalla', 'screen', 'touch', 'control', 'botón', 'carga',
        'usb', 'tipo c', 'type c', 'microfono', 'rgb', 'led', 'luz',
        'potencia', 'power', 'voltaje', 'voltage', 'frecuencia',
        'conexión', 'connection', 'inalámbrica', 'range', 'alcance'
      ];
      
      const sentences = plainText
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 15 && s.length < 500);
      
      for (const sentence of sentences) {
        const lowerSentence = sentence.toLowerCase();
        if (featureKeywords.some(kw => lowerSentence.includes(kw))) {
          bullets.push(sentence);
          if (bullets.length >= 5) break;
        }
      }
    }
    
    // 5. Fallback: primeras oraciones significativas
    if (bullets.length === 0) {
      const sentences = plainText
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 20 && s.length < 500)
        .slice(0, 5);
      bullets.push(...sentences);
    }
    
    return bullets.slice(0, 5);
  }

  private extractColor(title: string, variantTitle?: string, description?: string): string | undefined {
    const colorMap: Record<string, string> = {
      'negro': 'Negro', 'black': 'Negro', 'mate black': 'Negro Mate',
      'blanco': 'Blanco', 'white': 'Blanco',
      'rojo': 'Rojo', 'red': 'Rojo',
      'azul': 'Azul', 'blue': 'Azul', 'navy': 'Azul Marino',
      'verde': 'Verde', 'green': 'Verde',
      'amarillo': 'Amarillo', 'yellow': 'Amarillo',
      'rosa': 'Rosa', 'pink': 'Rosa',
      'morado': 'Morado', 'purple': 'Morado', 'violeta': 'Violeta',
      'naranja': 'Naranja', 'orange': 'Naranja',
      'gris': 'Gris', 'gray': 'Gris', 'grey': 'Gris',
      'plateado': 'Plateado', 'silver': 'Plateado',
      'dorado': 'Dorado', 'gold': 'Dorado',
      'café': 'Café', 'brown': 'Café',
      'beige': 'Beige',
      'turquesa': 'Turquesa', 'turquoise': 'Turquesa',
      'cian': 'Cian', 'cyan': 'Cian',
      'transparente': 'Transparente', 'clear': 'Transparente',
    };
    
    const textToSearch = `${title} ${variantTitle || ''} ${description || ''}`.toLowerCase();
    
    for (const [key, value] of Object.entries(colorMap)) {
      if (textToSearch.includes(key)) return value;
    }
    
    return undefined;
  }

  private extractMaterial(title: string, description?: string): string | undefined {
    const materialMap: Record<string, string> = {
      'plástico': 'Plástico', 'plastic': 'Plástico', 'plastico': 'Plástico',
      'metal': 'Metal', 'metálico': 'Metal',
      'aluminio': 'Aluminio', 'aluminum': 'Aluminio',
      'acero': 'Acero Inoxidable', 'steel': 'Acero Inoxidable', 'stainless': 'Acero Inoxidable',
      'silicona': 'Silicona', 'silicone': 'Silicona',
      'cuero': 'Cuero', 'leather': 'Cuero', 'piel': 'Cuero',
      'madera': 'Madera', 'wood': 'Madera',
      'vidrio': 'Vidrio', 'glass': 'Vidrio',
      'tela': 'Tela', 'fabric': 'Tela', 'textil': 'Tela',
      'nylon': 'Nylon',
      'poliéster': 'Poliéster', 'polyester': 'Poliéster',
      'goma': 'Goma', 'rubber': 'Goma',
      'abs': 'ABS',
      'pvc': 'PVC',
      'tpu': 'TPU',
      'policarbonato': 'Policarbonato', 'polycarbonate': 'Policarbonato',
      'cristal': 'Cristal Templado', 'templado': 'Cristal Templado',
    };
    
    const textToSearch = `${title} ${description || ''}`.toLowerCase();
    
    for (const [key, value] of Object.entries(materialMap)) {
      if (textToSearch.includes(key)) return value;
    }
    
    return undefined;
  }

  private extractModelNumber(title: string, description?: string): string | undefined {
    const text = `${title} ${description || ''}`;
    
    // Patrones comunes de números de modelo
    const patterns = [
      /(?:modelo|model|n[úu]mero de modelo)[\s:.-]+([a-z0-9\-]{2,20})/i,
      /\b([a-z]{1,4}\d{2,6}[a-z]?)\b/i,
      /\b([a-z]\d{2,4}[a-z]?)\b/i,
      /\b([a-z]{2,4}-\d{2,6})\b/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].toUpperCase();
    }
    
    return undefined;
  }

  private extractNumericValue(text: string | undefined, suffixes: string[]): string | undefined {
    if (!text) return undefined;
    
    for (const suffix of suffixes) {
      // Patrones como "10000mAh", "24V", "500W", "5,000 BTU"
      const pattern = new RegExp(`(\\d[\\d,.]*\\d*)\\s*${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      const match = text.match(pattern);
      if (match) return match[1].replace(/,/g, '');
    }
    
    return undefined;
  }

  private extractDimensions(description: string | undefined): { length: number; width: number; height: number; unit: string } | undefined {
    if (!description) return undefined;
    
    // Buscar patrones como "10 x 20 x 30 cm" o "Dimensiones: 15 x 10 x 5 cm"
    const patterns = [
      /(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*(cm|mm|m|pulgadas|inches?)/i,
      /(?:dimensiones|dimensions|tamaño|size)[\s:]*(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*(cm|mm|m|pulgadas|inches?)/i,
    ];
    
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        const unitMap: Record<string, string> = {
          'cm': 'centimeters', 'mm': 'millimeters', 'm': 'meters',
          'pulgadas': 'inches', 'pulgada': 'inches', 'inches': 'inches', 'inch': 'inches',
        };
        return {
          length: parseFloat(match[1]),
          width: parseFloat(match[2]),
          height: parseFloat(match[3]),
          unit: unitMap[match[4].toLowerCase()] || 'centimeters',
        };
      }
    }
    
    return undefined;
  }

  private extractCompatibleModels(description: string | undefined): string[] | undefined {
    if (!description) return undefined;
    
    // Buscar modelos de teléfono compatibles
    const patterns = [
      /(?:compatible con|para|for)\s*([^\n.]+)/gi,
      /(?:samsung|iphone|xiaomi|huawei|motorola)\s+[a-z]?\d{1,3}(?:\s+(?:pro|max|plus|mini))?/gi,
    ];
    
    const models: string[] = [];
    for (const pattern of patterns) {
      const matches = description.match(pattern);
      if (matches) models.push(...matches);
    }
    
    return models.length > 0 ? models : undefined;
  }

  private extractScreenSize(description: string | undefined): string | undefined {
    if (!description) return undefined;
    const match = description.match(/(\d+(?:\.\d+)?)\s*["'](?:\s*pulgadas?)?/i);
    return match ? match[1] : undefined;
  }

  private detectConnectivity(title: string, description?: string): string {
    const text = `${title} ${description || ''}`.toLowerCase();
    if (text.includes('bluetooth 5.3')) return 'bluetooth_5_3';
    if (text.includes('bluetooth 5.2')) return 'bluetooth_5_2';
    if (text.includes('bluetooth 5.1')) return 'bluetooth_5_1';
    if (text.includes('bluetooth 5')) return 'bluetooth_5';
    if (text.includes('bluetooth')) return 'bluetooth';
    if (text.includes('wifi') || text.includes('wi-fi')) return 'wi-fi';
    if (text.includes('usb-c') || text.includes('type c') || text.includes('tipo c')) return 'usb_type_c';
    if (text.includes('usb')) return 'usb';
    if (text.includes('inalámbrico') || text.includes('wireless')) return 'wireless';
    return 'wired';
  }

  private detectPowerSource(title: string, description?: string): string {
    const text = `${title} ${description || ''}`.toLowerCase();
    if (text.includes('batería recargable') || text.includes('rechargeable battery')) return 'rechargeable_battery';
    if (text.includes('batería') || text.includes('battery powered')) return 'battery_powered';
    if (text.includes('cable') || text.includes('corded')) return 'corded_electric';
    if (text.includes('solar')) return 'solar';
    return 'battery_powered';
  }

  private detectWireless(title: string, description?: string): boolean {
    const text = `${title} ${description || ''}`.toLowerCase();
    return text.includes('bluetooth') || text.includes('inalámbrico') || text.includes('wireless');
  }

  private detectBattery(title: string, description?: string): boolean {
    const text = `${title} ${description || ''}`.toLowerCase();
    return text.includes('batería') || text.includes('battery') || text.includes('recargable') || text.includes('rechargeable');
  }

  private detectWaterproof(title: string, description?: string): boolean {
    const text = `${title} ${description || ''}`.toLowerCase();
    return text.includes('waterproof') || text.includes('ipx') || text.includes('ip68') || text.includes('resistente al agua');
  }

  // ============ DETECTORES DE TIPO ============

  detectProductType(product: ShopifyProduct): string {
    const type = product.productType?.toLowerCase() || '';
    const title = product.title?.toLowerCase() || '';
    const desc = (product.description || '').toLowerCase();
    const tags = Array.isArray(product.tags) 
      ? product.tags.join(' ').toLowerCase() 
      : String(product.tags || '').toLowerCase();
    
    // Audífonos
    if (type.includes('audio') || type.includes('headphone') || type.includes('earphone') ||
        title.includes('audífono') || title.includes('headphone') || title.includes('earbud') ||
        title.includes('auricular') || title.includes('headset') ||
        tags.includes('audifono') || tags.includes('headphone') || tags.includes('audio')) {
      return 'HEADPHONES';
    }
    
    // Bocinas / Altavoces
    if (title.includes('bocina') || title.includes('altavoz') || title.includes('speaker') ||
        title.includes('parlante') || title.includes('soundbar') ||
        tags.includes('speaker') || tags.includes('bocina') || tags.includes('altavoz')) {
      return 'SPEAKER';
    }
    
    // Cargadores
    if (title.includes('cargador') || title.includes('charger') || title.includes('adaptador') ||
        title.includes('cable') || title.includes('usb') ||
        tags.includes('charger') || tags.includes('cargador') || tags.includes('cable')) {
      return 'CHARGER';
    }
    
    // Power Banks
    if (title.includes('powerbank') || title.includes('power bank') || title.includes('batería portátil') ||
        title.includes('bateria portatil') || title.includes('pila portatil') ||
        tags.includes('powerbank') || tags.includes('bateria portatil')) {
      return 'PORTABLE_POWER_BANK';
    }
    
    // Smartwatches
    if (title.includes('smartwatch') || title.includes('smart watch') || title.includes('reloj inteligente') ||
        title.includes('pulsera') || title.includes('fitness tracker') ||
        tags.includes('smartwatch') || tags.includes('reloj inteligente')) {
      return 'SMARTWATCH';
    }
    
    // Fundas de celular
    if (title.includes('funda') || title.includes('case') || title.includes('cover') ||
        title.includes('protector') || title.includes('carcasa') ||
        tags.includes('funda') || tags.includes('case') || tags.includes('carcasa')) {
      return 'CELLULAR_PHONE_CASE';
    }
    
    // Micas / Protectores de pantalla
    if (title.includes('mica') || title.includes('cristal templado') || title.includes('screen protector') ||
        title.includes('protector de pantalla') || title.includes('vidrio templado') ||
        tags.includes('mica') || tags.includes('cristal templado') || tags.includes('screen protector')) {
      return 'SCREEN_PROTECTOR';
    }
    
    // Focos / Iluminación
    if (title.includes('foco') || title.includes('lámpara') || title.includes('lampara') ||
        title.includes('luz') || title.includes('led') || title.includes('bombillo') ||
        title.includes('light bulb') || title.includes('guirnalda') || title.includes('iluminación') ||
        tags.includes('foco') || tags.includes('lampara') || tags.includes('led')) {
      return 'LIGHT_BULB';
    }
    
    // Aire acondicionado / Ventilación
    if (title.includes('aire acondicionado') || title.includes('minisplit') || title.includes('ventilador') ||
        title.includes('climatizador') || title.includes('enfriador') || title.includes('cooler') ||
        title.includes('extractor') || title.includes('ventilación') ||
        tags.includes('aire acondicionado') || tags.includes('ventilador')) {
      return 'AIR_CONDITIONER';
    }
    
    // Aspiradoras
    if (title.includes('aspiradora') || title.includes('vacuum') || title.includes('aspirador') ||
        tags.includes('aspiradora') || tags.includes('vacuum')) {
      return 'VACUUM_CLEANER';
    }
    
    // Taladros / Herramientas eléctricas
    if (title.includes('taladro') || title.includes('atornillador') || title.includes('drill') ||
        title.includes('lijadora') || title.includes('esmeril') || title.includes('pulidora') ||
        title.includes('sierra') || title.includes('caladora') ||
        tags.includes('taladro') || tags.includes('herramienta')) {
      return 'POWER_DRILL';
    }
    
    // Herramientas manuales
    if (title.includes('herramienta') || title.includes('tool') || title.includes('kit de') ||
        tags.includes('herramienta') || tags.includes('tool')) {
      return 'TOOLS';
    }
    
    // Tabletas / Tablets
    if (title.includes('tablet') || title.includes('ipad') || title.includes('tableta') ||
        tags.includes('tablet') || tags.includes('tableta')) {
      return 'TABLET';
    }
    
    // Cámaras
    if (title.includes('cámara') || title.includes('camara') || title.includes('camera') ||
        title.includes('webcam') || title.includes('gopro') || title.includes('dvr') ||
        tags.includes('camara') || tags.includes('camera')) {
      return 'CAMERA';
    }
    
    // Teclados y mouse
    if (title.includes('teclado') || title.includes('keyboard') || title.includes('mouse') ||
        title.includes('ratón') || title.includes('alfombrilla') ||
        tags.includes('teclado') || tags.includes('keyboard') || tags.includes('mouse')) {
      return 'COMPUTER_KEYBOARD';
    }
    
    // USB / Memorias
    if (title.includes('usb') || title.includes('memoria') || title.includes('pendrive') ||
        title.includes('flash drive') || title.includes('disco duro') || title.includes('ssd') ||
        tags.includes('usb') || tags.includes('memoria')) {
      return 'FLASH_DRIVES';
    }
    
    // Default: intentar detectar por categoría general
    if (type.includes('electronic') || type.includes('electrónico')) {
      return 'CONSUMER_ELECTRONICS';
    }
    
    return 'PRODUCT';
  }

  // ============ UTILIDADES ============

  private cleanTitle(title: string): string {
    return title.substring(0, 200).trim();
  }

  private cleanDescription(description: string): string {
    const plainText = description
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return plainText.substring(0, 2000);
  }

  private mapWeightUnit(unit: string): string {
    const unitMap: Record<string, string> = {
      'g': 'grams', 'kg': 'kilograms', 'oz': 'ounces', 'lb': 'pounds',
    };
    return unitMap[unit?.toLowerCase()] || 'grams';
  }

  detectIdType(barcode?: string): string {
    if (!barcode) return 'ean';
    const clean = barcode.replace(/\D/g, '');
    if (clean.length === 12) return 'upc';
    if (clean.length === 13) return 'ean';
    if (clean.length === 14) return 'gtin';
    return 'ean';
  }
}
