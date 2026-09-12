import { Router, Request, Response } from 'express';
import { ProductTransformer } from '../services/productTransformer';

const router = Router();
const transformer = new ProductTransformer();

/**
 * POST /api/panel/generate
 * Genera contenido optimizado para Amazon usando el asistente
 * El servidor envía los datos extraídos y recibe contenido generado
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { sku, productType, extracted, amazon } = req.body;
    
    if (!sku || !productType || !extracted) {
      res.status(400).json({ error: 'Faltan datos requeridos: sku, productType, extracted' });
      return;
    }
    
    console.log(`[Panel] Solicitud de generación para SKU: ${sku}`);
    console.log(`[Panel] Tipo de producto: ${productType}`);
    
    // Analizar qué campos faltan
    const missingFields: string[] = [];
    if (!extracted.bullets || extracted.bullets.length === 0) missingFields.push('bullet_points');
    if (!extracted.cleanDescription || extracted.cleanDescription.length < 50) missingFields.push('description');
    if (!extracted.title || extracted.title.length < 30) missingFields.push('title');
    if (!extracted.color) missingFields.push('color');
    if (!extracted.material) missingFields.push('material');
    if (!extracted.modelNumber) missingFields.push('model_number');
    
    console.log(`[Panel] Campos faltantes: ${missingFields.join(', ')}`);
    
    // Generar contenido basado en los datos extraídos
    const generated = generateAmazonContent(extracted, productType, missingFields);
    
    res.json({
      success: true,
      sku,
      productType,
      missingFields,
      ...generated,
      message: `Contenido generado para ${missingFields.length} campos faltantes`,
    });
    
  } catch (error) {
    console.error('[Panel] Error generando contenido:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Genera contenido optimizado para Amazon
 * Esta función puede ser reemplazada por una llamada al asistente
 */
function generateAmazonContent(extracted: any, productType: string, missingFields: string[]) {
  const title = extracted.title || '';
  const brand = extracted.brand || 'Generic';
  const description = extracted.description || '';
  
  // Generar título SEO optimizado
  const seoTitle = optimizeTitle(title, productType, brand, extracted);
  
  // Generar descripción optimizada
  const seoDescription = optimizeDescription(description, title, brand, productType, extracted);
  
  // Generar viñetas
  const bullets = generateBullets(title, description, productType, brand, extracted);
  
  // Detectar/confirmar color
  const color = extracted.color || detectColorFromTitle(title) || 'Negro';
  
  // Detectar/confirmar material
  const material = extracted.material || detectMaterialFromText(title, description) || 'Plástico';
  
  // Generar número de modelo
  const modelNumber = extracted.modelNumber || generateModelNumber(title, brand);
  
  // Generar keywords
  const keywords = generateKeywords(title, productType, brand, extracted);
  
  return {
    title: seoTitle,
    description: seoDescription,
    bullets,
    color,
    material,
    modelNumber,
    keywords,
  };
}

function optimizeTitle(title: string, productType: string, brand: string, extracted: any): string {
  // Mantener título original si ya es bueno
  if (title.length >= 80 && title.length <= 200) {
    return title;
  }
  
  let optimized = title;
  
  // Agregar marca si falta
  if (!title.toLowerCase().includes(brand.toLowerCase())) {
    optimized = `${brand} ${optimized}`;
  }
  
  // Agregar keywords de tipo de producto si faltan
  const typeKeywords: Record<string, string> = {
    'HEADPHONES': 'Audífonos Bluetooth Inalámbricos',
    'SPEAKER': 'Bocina Bluetooth Portátil',
    'CHARGER': 'Cargador Rápido',
    'PORTABLE_POWER_BANK': 'Power Bank Portátil',
    'SMARTWATCH': 'Smartwatch Reloj Inteligente',
    'LIGHT_BULB': 'Foco LED',
    'CELLULAR_PHONE_CASE': 'Funda Protectora',
    'SCREEN_PROTECTOR': 'Mica Protectora Cristal Templado',
    'VACUUM_CLEANER': 'Aspiradora',
    'POWER_DRILL': 'Taladro Inalámbrico',
    'AIR_CONDITIONER': 'Aire Acondicionado Portátil',
    'TOOLS': 'Herramienta',
    'TABLET': 'Tablet',
    'CAMERA': 'Cámara',
    'COMPUTER_KEYBOARD': 'Teclado',
    'FLASH_DRIVES': 'Memoria USB',
  };
  
  const keyword = typeKeywords[productType];
  if (keyword && !title.toLowerCase().includes(keyword.toLowerCase().split(' ')[0])) {
    optimized = `${keyword} ${optimized}`;
  }
  
  // Limitar a 200 caracteres
  return optimized.substring(0, 200);
}

function optimizeDescription(description: string, title: string, brand: string, productType: string, extracted: any): string {
  if (description && description.length > 100) {
    // Limpiar y formatear descripción existente
    return cleanAndFormatDescription(description);
  }
  
  // Generar descripción por defecto
  const typeDesc: Record<string, string> = {
    'HEADPHONES': `Audífonos Bluetooth de alta calidad de ${brand}. Diseño ergonómico para máxima comodidad. Sonido envolvente con tecnología de cancelación de ruido. Batería de larga duración para disfrutar tu música todo el día. Compatibles con todos los dispositivos Bluetooth.`,
    'SPEAKER': `Bocina Bluetooth portátil de ${brand}. Sonido potente y claro con graves profundos. Diseño compacto y resistente para llevar a cualquier lugar. Conectividad Bluetooth estable y batería de larga duración.`,
    'CHARGER': `Cargador rápido de ${brand}. Carga tus dispositivos de forma segura y eficiente. Compatible con múltiples dispositivos. Diseño compacto ideal para viajes.`,
    'PORTABLE_POWER_BANK': `Power Bank portátil de ${brand}. Carga tus dispositivos en cualquier lugar. Alta capacidad de batería con múltiples puertos USB. Diseño compacto y ligero.`,
    'SMARTWATCH': `Smartwatch de ${brand}. Monitorea tu actividad física, frecuencia cardíaca y sueño. Notificaciones inteligentes directo en tu muñeca. Pantalla táctil a color con múltiples esferas.`,
    'LIGHT_BULB': `Foco LED de ${brand}. Iluminación brillante y eficiente. Ahorro de energía con larga vida útil. Fácil instalación en cualquier socket estándar.`,
    'CELLULAR_PHONE_CASE': `Funda protectora de ${brand}. Protege tu celular de caídas y golpes. Diseño delgado que no añade volumen. Material duradero de alta calidad.`,
    'SCREEN_PROTECTOR': `Mica protectora de cristal templado de ${brand}. Protege la pantalla de tu celular de rayones y golpes. Instalación fácil sin burbujas. Sensibilidad táctil preservada.`,
    'VACUUM_CLEANER': `Aspiradora de ${brand}. Potente succión para limpieza profunda. Diseño ligero y maniobrable. Filtro HEPA para eliminar alérgenos.`,
    'POWER_DRILL': `Taladro inalámbrico de ${brand}. Potente motor de 24V para perforación y atornillado. Batería de litio recargable. Diseño ergonómico con luz LED.`,
    'AIR_CONDITIONER': `Aire acondicionado portátil de ${brand}. Enfría rápidamente cualquier espacio. Control remoto incluido. Fácil instalación sin obras.`,
    'TOOLS': `Herramienta de ${brand}. Fabricada con materiales de alta calidad. Diseño ergonómico para uso prolongado. Ideal para profesionales y hogar.`,
    'TABLET': `Tablet de ${brand}. Pantalla táctil de alta resolución. Procesador potente para multitarea. Ideal para trabajo y entretenimiento.`,
    'CAMERA': `Drone ${brand} con cámara 4K HD. Captura fotos y videos aéreos de alta calidad. Control por app y múltiples funciones inteligentes. Ideal para principiantes y aficionados.`,
    'COMPUTER_KEYBOARD': `Teclado de ${brand}. Conectividad estable y respuesta táctil precisa. Diseño ergonómico para largas sesiones de trabajo.`,
  };
  
  return typeDesc[productType] || `${title} de ${brand}. Producto de alta calidad con garantía de satisfacción.`;
}

function generateBullets(title: string, description: string, productType: string, brand: string, extracted: any): string[] {
  // Si ya tenemos bullets de Shopify, usarlos y mejorarlos
  if (extracted.bullets && extracted.bullets.length > 0) {
    return extracted.bullets.slice(0, 5).map((b: string) => b.substring(0, 500));
  }
  
  // Generar bullets por tipo de producto
  const typeBullets: Record<string, string[]> = {
    'HEADPHONES': [
      `✅ SONIDO PREMIUM: Audífonos ${brand} con tecnología Bluetooth 5.3 para conexión estable y sonido de alta fidelidad`,
      `✅ BATERÍA DE LARGA DURACIÓN: Disfruta hasta 16 horas de reproducción continua con una sola carga`,
      `✅ DISEÑO ERGONÓMICO: Almohadillas suaves y ajustables para máxima comodidad durante uso prolongado`,
      `✅ COMPATIBILIDAD UNIVERSAL: Funciona con iPhone, Android, tablets, laptops y cualquier dispositivo Bluetooth`,
      `✅ GARANTÍA DE CALIDAD: Producto ${brand} con 1 año de garantía del fabricante y soporte técnico`,
    ],
    'SPEAKER': [
      `✅ SONIDO POTENTE: Bocina ${brand} con graves profundos y agudos claros para una experiencia envolvente`,
      `✅ BLUETOOTH 5.0: Conexión estable hasta 10 metros de alcance con cualquier dispositivo`,
      `✅ PORTÁTIL Y RESISTENTE: Diseño compacto ideal para exteriores, playa, camping y viajes`,
      `✅ BATERÍA DURADERA: Hasta 8 horas de reproducción continua con una sola carga`,
      `✅ MÚLTIPLES ENTRADAS: Bluetooth, USB, tarjeta TF y radio FM para todas tus opciones de música`,
    ],
    'CHARGER': [
      `✅ CARGA RÁPIDA: Tecnología de carga rápida que reduce el tiempo de carga hasta 50%`,
      `✅ PROTECCIÓN INTEGRAL: Protección contra sobrecorriente, sobretensión y sobrecalentamiento`,
      `✅ COMPATIBLE CON MÚLTIPLES DISPOSITIVOS: iPhone, Android, tablets y más`,
      `✅ DISEÑO COMPACTO: Ideal para viajes, oficina y uso diario`,
      `✅ CERTIFICADO DE CALIDAD: Cumple con estándares de seguridad internacionales`,
    ],
    'SMARTWATCH': [
      `✅ MONITOREO DE SALUD: Seguimiento de frecuencia cardíaca, pasos, calorías y sueño`,
      `✅ NOTIFICACIONES INTELIGENTES: Recibe llamadas, mensajes y notificaciones de apps en tu muñeca`,
      `✅ PANTALLA TÁCTIL A COLOR: Visualización clara con múltiples esferas personalizables`,
      `✅ RESISTENTE AL AGUA: Protección IP67 para uso durante ejercicio y actividades al aire libre`,
      `✅ BATERÍA DE LARGA DURACIÓN: Hasta 7 días de uso con una sola carga`,
    ],
    'POWER_DRILL': [
      `✅ MOTOR POTENTE 24V: Taladro inalámbrico con alto torque para perforación y atornillado`,
      `✅ 3 FUNCIONES EN 1: Taladro, atornillador y modo impacto para todo tipo de trabajos`,
      `✅ BATERÍA DE LITIO: Batería recargable de larga duración con indicador de carga`,
      `✅ DISEÑO ERGONÓMICO: Empuñadura antideslizante y luz LED para trabajar en espacios oscuros`,
      `✅ INCLUYE ACCESORIOS: Kit completo con brocas, puntas de atornillador y maletín de transporte`,
    ],
    'CAMERA': [
      `✅ CÁMARA 4K HD: Captura videos y fotos aéreas con calidad profesional y estabilización electrónica`,
      `✅ CONTROL POR APP: Controla el drone desde tu smartphone con funciones de vuelo inteligente y transmisión en tiempo real`,
      `✅ DISEÑO PLEGABLE: Compacto y portátil, fácil de transportar en cualquier mochila o bolso`,
      `✅ VUELO ESTABLE: Tecnología de estabilización de altitud y sensores para vuelo suave y seguro`,
      `✅ IDEAL PARA PRINCIPIANTES: Modos de vuelo asistido, despegue/aterrizaje con un botón y protección de hélices`,
    ],
  };
  
  return typeBullets[productType] || [
    `✅ ALTA CALIDAD: Producto ${brand} fabricado con materiales duraderos y resistentes`,
    `✅ FÁCIL DE USAR: Diseño intuitivo ideal para principiantes y usuarios avanzados`,
    `✅ VERSÁTIL: Múltiples funciones y aplicaciones para uso diario`,
    `✅ DISEÑO MODERNO: Estética elegante que complementa cualquier espacio`,
    `✅ GARANTÍA INCLUIDA: 1 año de garantía del fabricante con soporte técnico especializado`,
  ];
}

function detectColorFromTitle(title: string): string | undefined {
  const colors: Record<string, string> = {
    'negro': 'Negro', 'black': 'Negro',
    'blanco': 'Blanco', 'white': 'Blanco',
    'rojo': 'Rojo', 'red': 'Rojo',
    'azul': 'Azul', 'blue': 'Azul',
    'verde': 'Verde', 'green': 'Verde',
  };
  
  const lower = title.toLowerCase();
  for (const [key, value] of Object.entries(colors)) {
    if (lower.includes(key)) return value;
  }
  return undefined;
}

function detectMaterialFromText(title: string, description: string): string | undefined {
  const materials: Record<string, string> = {
    'silicona': 'Silicona', 'silicone': 'Silicona',
    'cuero': 'Cuero', 'leather': 'Cuero',
    'metal': 'Metal',
    'aluminio': 'Aluminio', 'aluminum': 'Aluminio',
    'plastico': 'Plástico', 'plástico': 'Plástico', 'plastic': 'Plástico',
  };
  
  const text = `${title} ${description || ''}`.toLowerCase();
  for (const [key, value] of Object.entries(materials)) {
    if (text.includes(key)) return value;
  }
  return undefined;
}

function generateModelNumber(title: string, brand: string): string {
  // Extraer modelo del título si existe
  const match = title.match(/\b([A-Z]{1,4}\d{2,6}[A-Z]?)\b/);
  if (match) return match[1];
  
  // Generar uno basado en marca
  const prefix = brand.substring(0, 3).toUpperCase();
  const hash = title.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 1000;
  return `${prefix}-${hash.toString().padStart(3, '0')}`;
}

function generateKeywords(title: string, productType: string, brand: string, extracted: any): string[] {
  const keywords = [brand, productType];
  
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('bluetooth')) keywords.push('bluetooth');
  if (lowerTitle.includes('inalámbrico') || lowerTitle.includes('wireless')) keywords.push('inalámbrico');
  if (lowerTitle.includes('portátil')) keywords.push('portátil');
  if (lowerTitle.includes('recargable')) keywords.push('recargable');
  if (extracted.color) keywords.push(extracted.color);
  
  return keywords.slice(0, 10);
}

function cleanAndFormatDescription(description: string): string {
  return description
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 2000);
}

export default router;
