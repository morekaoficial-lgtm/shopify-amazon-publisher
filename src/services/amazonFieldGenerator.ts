import { ExtractedProductData } from './productTransformer';

export interface GeneratedAmazonFields {
  [key: string]: any;
}

/**
 * Genera campos requeridos por Amazon según el tipo de producto
 * Extrae todo lo posible de Shopify y genera valores por defecto para el resto
 */
export class AmazonFieldGenerator {
  
  /**
   * Genera TODOS los campos requeridos para un listing nuevo en Amazon
   */
  generateFields(
    productType: string,
    data: ExtractedProductData
  ): GeneratedAmazonFields {
    const fields: GeneratedAmazonFields = {};
    
    // ========== CAMPOS COMUNES PARA TODOS ==========
    fields.item_name = data.title.substring(0, 200);
    fields.brand = data.brand || 'Generic';
    fields.manufacturer = data.brand || 'Generic';
    fields.condition_type = 'new_new';
    fields.number_of_items = 1;
    fields.country_of_origin = 'CN';
    fields.batteries_required = data.hasBattery;
    fields.supplier_declared_dg_hz_regulation = 'not_applicable';
    fields.is_oem_authorized = false;
    
    // Precio (formato que Amazon espera)
    if (data.price && parseFloat(data.price) > 0) {
      fields.list_price = {
        currency: 'MXN',
        value_with_tax: parseFloat(data.price),
      };
    }
    
    // GTIN/EAN/UPC (preservar ceros iniciales)
    if (data.externalId) {
      fields.externally_assigned_product_identifier = {
        value: data.externalId,
        type: data.externalIdType || 'ean',
      };
    }
    
    // Peso
    if (data.weight && data.weight > 0) {
      const unit = this.mapWeightUnit(data.weightUnit);
      fields.item_weight = { value: data.weight, unit };
      fields.website_shipping_weight = { value: Math.round(data.weight * 1.2 * 100) / 100, unit };
    } else {
      const defaultWeight = this.getDefaultWeight(productType);
      fields.item_weight = defaultWeight;
      fields.website_shipping_weight = { 
        value: Math.round(defaultWeight.value * 1.2 * 100) / 100, 
        unit: defaultWeight.unit 
      };
    }
    
    // Número de modelo
    fields.model_number = data.modelNumber || this.generateModelNumber(data.sku, data.brand);
    fields.part_number = fields.model_number;
    
    // Viñetas
    fields.bullet_point = data.bullets.length > 0 
      ? data.bullets 
      : this.generateDefaultBullets(productType, data.title, data.brand);
    
    // Descripción
    fields.product_description = data.cleanDescription || this.generateDefaultDescription(productType, data.title, data.brand);
    
    // Garantía
    fields.warranty_description = '1 año de garantía del fabricante';
    
    // Color
    fields.color = data.color || 'Negro';
    
    // Material
    fields.material = data.material || 'Plástico';
    
    // Dimensiones
    const dims = data.dimensions || this.getDefaultDimensions(productType);
    fields.item_depth_width_height = dims;
    fields.item_package_dimensions = dims;
    
    // ========== CAMPOS ESPECÍFICOS POR TIPO ==========
    const specificFields = this.generateProductTypeFields(productType, data, fields);
    Object.assign(fields, specificFields);
    
    // Fulfillment availability siempre al final
    fields.fulfillment_availability = {
      quantity: 1,
      fulfillment_channel_code: 'DEFAULT',
    };
    
    return fields;
  }
  
  /**
   * Genera campos específicos según el tipo de producto de Amazon
   */
  private generateProductTypeFields(productType: string, data: ExtractedProductData, allFields: GeneratedAmazonFields): GeneratedAmazonFields {
    const fields: GeneratedAmazonFields = {};
    const title = data.title.toLowerCase();
    const desc = data.description.toLowerCase();
    
    switch (productType) {
      case 'HEADPHONES':
        fields.item_type_keyword = 'over-ear-headphones';
        fields.connectivity_technology = data.connectivity || 'bluetooth';
        fields.form_factor = title.includes('in-ear') || title.includes('intra') || title.includes('auricular') 
          ? 'in_ear' 
          : title.includes('on-ear') 
            ? 'on_ear' 
            : 'over_ear';
        fields.noise_cancellation = title.includes('cancel') || desc.includes('cancel') 
          ? 'active' 
          : 'passive';
        fields.included_components = 'Audífonos, Cable de carga USB, Manual de usuario, Estuche';
        fields.water_resistance_level = data.isWaterproof ? 'ipx5' : 'not_water_resistant';
        fields.battery_cell_composition = 'lithium_ion';
        fields.cable_feature = data.isWireless ? 'sin_cable' : 'cable';
        break;
        
      case 'SPEAKER':
        fields.item_type_keyword = 'portable-speakers';
        fields.connectivity_technology = data.connectivity || 'bluetooth';
        fields.included_components = 'Bocina portátil, Cable de carga USB, Manual de usuario';
        fields.power_source = data.powerSource || 'battery_powered';
        fields.water_resistance_level = data.isWaterproof ? 'ipx5' : 'not_water_resistant';
        fields.battery_cell_composition = 'lithium_ion';
        fields.cable_feature = data.isWireless ? 'sin_cable' : 'cable';
        break;
        
      case 'CHARGER':
        fields.item_type_keyword = 'cell-phone-chargers';
        fields.included_components = 'Cargador, Cable USB, Manual de usuario';
        fields.power_source = 'corded_electric';
        fields.cable_feature = 'cable';
        fields.total_usb_ports = data.wattage ? String(Math.min(parseInt(data.wattage) / 20, 4)) : '1';
        break;
        
      case 'PORTABLE_POWER_BANK':
        fields.item_type_keyword = 'portable-power-banks';
        fields.included_components = 'Power Bank, Cable de carga USB, Manual de usuario';
        fields.power_source = 'battery_powered';
        fields.battery_cell_composition = 'lithium_ion';
        fields.cable_feature = 'cable';
        fields.total_usb_ports = '2';
        break;
        
      case 'SMARTWATCH':
        fields.item_type_keyword = 'smart-watches';
        fields.included_components = 'Smartwatch, Correa, Cable de carga magnético, Manual de usuario';
        fields.water_resistance_level = data.isWaterproof ? 'ip68' : 'ip67';
        fields.battery_cell_composition = 'lithium_ion';
        fields.wireless_carrier = 'unlocked';
        fields.connectivity_technology = data.connectivity || 'bluetooth';
        fields.cable_feature = 'sin_cable';
        break;
        
      case 'LIGHT_BULB':
        fields.item_type_keyword = 'light-bulbs';
        fields.included_components = 'Foco LED';
        fields.wattage = data.wattage || '9';
        fields.voltage = data.voltage || '110';
        fields.luminous_flux = '800';
        fields.color_temperature = title.includes('cálida') || title.includes('warm') ? '2700' : '6500';
        fields.power_source = 'corded_electric';
        break;
        
      case 'CELLULAR_PHONE_CASE':
        fields.item_type_keyword = 'cell-phone-cases';
        fields.included_components = 'Funda para celular';
        fields.compatible_devices = data.compatibleModels?.[0] || 'Universal';
        fields.form_factor = 'case';
        fields.closure_type = 'sin_cierre';
        break;
        
      case 'SCREEN_PROTECTOR':
        fields.item_type_keyword = 'screen-protectors';
        fields.included_components = 'Mica protectora, Kit de limpieza (paño, toallita alcohol, pegatina quita-polvo)';
        fields.compatible_devices = data.compatibleModels?.[0] || 'Universal';
        fields.item_hardness = '9H';
        fields.material_type = 'Cristal Templado';
        fields.closure_type = 'sin_cierre';
        break;
        
      case 'VACUUM_CLEANER':
        fields.item_type_keyword = 'vacuum-cleaners';
        fields.included_components = 'Aspiradora, Tubo telescópico, Accesorios, Manual de usuario';
        fields.power_source = 'battery_powered';
        fields.battery_cell_composition = 'lithium_ion';
        fields.filter_type = 'hepa';
        fields.cable_feature = 'sin_cable';
        break;
        
      case 'POWER_DRILL':
        fields.item_type_keyword = 'power-drills';
        fields.included_components = 'Taladro, Batería de litio, Cargador rápido, Maletín, Manual de usuario';
        fields.power_source = 'battery_powered';
        fields.battery_cell_composition = 'lithium_ion';
        fields.cable_feature = 'sin_cable';
        break;
        
      case 'AIR_CONDITIONER':
        fields.item_type_keyword = 'air-conditioners';
        fields.included_components = 'Aire acondicionado, Control remoto, Kit de instalación, Manual de usuario';
        fields.controller_type = 'remoto';
        fields.installation_type = 'ventana';
        fields.power_source = 'corded_electric';
        fields.cable_feature = 'cable';
        break;
        
      case 'TOOLS':
        fields.item_type_keyword = 'tools';
        fields.included_components = 'Herramienta, Accesorios, Manual de usuario';
        fields.power_source = data.hasBattery ? 'battery_powered' : 'manual';
        fields.cable_feature = data.hasBattery ? 'sin_cable' : 'cable';
        break;
        
      case 'TABLET':
        fields.item_type_keyword = 'tablets';
        fields.included_components = 'Tablet, Cable de carga, Adaptador de corriente, Manual de usuario';
        fields.connectivity_technology = data.connectivity || 'wi-fi';
        fields.power_source = 'battery_powered';
        fields.battery_cell_composition = 'lithium_ion';
        fields.wireless_carrier = 'unlocked';
        fields.cable_feature = 'sin_cable';
        break;
        
      case 'CAMERA':
        fields.item_type_keyword = 'camera-drones';
        fields.included_components = 'Drone, Control remoto, Batería recargable, Cable USB, Manual de usuario, Hélices de repuesto';
        fields.are_batteries_included = true;
        fields.remote_control_included = true;
        fields.number_of_batteries = 1;
        fields.camera_description = 'Cámara 4K HD integrada con estabilización electrónica';
        fields.video_capture_resolution = '4K';
        fields.connectivity_technology = 'wifi';
        fields.wireless_communication_technology = 'wifi';
        fields.recommended_uses_for_product = 'fotografia_aerea,videos,vuelo_recreativo';
        // Eliminar campos que no aplican a drones
        delete allFields.power_source;
        delete allFields.is_oem_authorized;
        delete allFields.website_shipping_weight;
        delete allFields.item_depth_width_height;
        delete allFields.cable_feature;
        break;
        
      case 'COMPUTER_KEYBOARD':
        fields.item_type_keyword = 'keyboards';
        fields.included_components = 'Teclado, Receptor USB, Manual de usuario';
        fields.connectivity_technology = data.connectivity || 'usb';
        fields.power_source = data.isWireless ? 'battery_powered' : 'corded_electric';
        fields.cable_feature = data.isWireless ? 'sin_cable' : 'cable';
        break;
        
      case 'FLASH_DRIVES':
        fields.item_type_keyword = 'usb-flash-drives';
        fields.included_components = 'Memoria USB, Manual de usuario';
        fields.connectivity_technology = 'usb';
        fields.power_source = 'usb_bus_powered';
        fields.cable_feature = 'cable';
        break;
        
      default:
        fields.item_type_keyword = 'electronics';
        fields.included_components = 'Producto, Manual de usuario, Accesorios';
        fields.power_source = 'corded_electric';
        fields.cable_feature = 'cable';
        break;
    }
    
    return fields;
  }
  
  // ============ VALORES POR DEFECTO ============
  
  private generateModelNumber(sku: string, brand: string): string {
    const prefix = (brand || 'GEN').substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '');
    const hash = sku.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 10000;
    return `${prefix || 'GEN'}-${hash.toString().padStart(4, '0')}`;
  }
  
  private generateDefaultBullets(productType: string, title: string, brand: string): string[] {
    const b = brand || 'Marca';
    return [
      `Producto de alta calidad de ${b}`,
      'Diseño ergonómico y funcional pensado para el usuario',
      'Fabricado con materiales duraderos y resistentes',
      'Fácil de usar e instalar, incluye manual de instrucciones',
      'Garantía de satisfacción y soporte técnico incluido',
    ];
  }
  
  private generateDefaultDescription(productType: string, title: string, brand: string): string {
    const b = brand || 'nuestra marca';
    return `${title} de ${b}. Producto fabricado con materiales de alta calidad para garantizar durabilidad y rendimiento óptimo. Diseño pensado para ofrecer la mejor experiencia de usuario. Incluye manual de instrucciones y todos los accesorios necesarios para su funcionamiento. Garantía de satisfacción del cliente.`;
  }
  
  private getDefaultWeight(productType: string): { value: number; unit: string } {
    const weights: Record<string, { value: number; unit: string }> = {
      'HEADPHONES': { value: 250, unit: 'grams' },
      'SPEAKER': { value: 500, unit: 'grams' },
      'CHARGER': { value: 150, unit: 'grams' },
      'PORTABLE_POWER_BANK': { value: 400, unit: 'grams' },
      'SMARTWATCH': { value: 80, unit: 'grams' },
      'LIGHT_BULB': { value: 100, unit: 'grams' },
      'CELLULAR_PHONE_CASE': { value: 50, unit: 'grams' },
      'SCREEN_PROTECTOR': { value: 30, unit: 'grams' },
      'VACUUM_CLEANER': { value: 2500, unit: 'grams' },
      'POWER_DRILL': { value: 1800, unit: 'grams' },
      'AIR_CONDITIONER': { value: 20000, unit: 'grams' },
      'TOOLS': { value: 800, unit: 'grams' },
      'TABLET': { value: 500, unit: 'grams' },
      'CAMERA': { value: 400, unit: 'grams' },
      'COMPUTER_KEYBOARD': { value: 600, unit: 'grams' },
      'FLASH_DRIVES': { value: 20, unit: 'grams' },
    };
    return weights[productType] || { value: 500, unit: 'grams' };
  }
  
  private getDefaultDimensions(productType: string): { length: number; width: number; height: number; unit: string } {
    const dims: Record<string, { length: number; width: number; height: number; unit: string }> = {
      'HEADPHONES': { length: 18, width: 16, height: 8, unit: 'centimeters' },
      'SPEAKER': { length: 12, width: 18, height: 10, unit: 'centimeters' },
      'CHARGER': { length: 6, width: 5, height: 3, unit: 'centimeters' },
      'PORTABLE_POWER_BANK': { length: 14, width: 7, height: 2, unit: 'centimeters' },
      'SMARTWATCH': { length: 10, width: 10, height: 6, unit: 'centimeters' },
      'LIGHT_BULB': { length: 7, width: 7, height: 12, unit: 'centimeters' },
      'CELLULAR_PHONE_CASE': { length: 2, width: 8, height: 16, unit: 'centimeters' },
      'SCREEN_PROTECTOR': { length: 1, width: 10, height: 20, unit: 'centimeters' },
      'VACUUM_CLEANER': { length: 28, width: 25, height: 115, unit: 'centimeters' },
      'POWER_DRILL': { length: 12, width: 28, height: 22, unit: 'centimeters' },
      'AIR_CONDITIONER': { length: 32, width: 55, height: 38, unit: 'centimeters' },
      'TOOLS': { length: 18, width: 28, height: 12, unit: 'centimeters' },
      'TABLET': { length: 2, width: 18, height: 26, unit: 'centimeters' },
      'CAMERA': { length: 18, width: 16, height: 8, unit: 'centimeters' },
      'COMPUTER_KEYBOARD': { length: 5, width: 45, height: 16, unit: 'centimeters' },
      'FLASH_DRIVES': { length: 1, width: 2, height: 6, unit: 'centimeters' },
    };
    return dims[productType] || { length: 15, width: 15, height: 15, unit: 'centimeters' };
  }
  
  private mapWeightUnit(unit?: string): string {
    const unitMap: Record<string, string> = {
      'g': 'grams', 'kg': 'kilograms', 'oz': 'ounces', 'lb': 'pounds',
    };
    return unitMap[unit?.toLowerCase() || ''] || 'grams';
  }
}
