import axios from 'axios';
import { config } from '../config';
import { AIGeneratedContent } from '../types';

export class AIFillService {
  async generateProductContent(
    title: string,
    description: string,
    productType: string,
    vendor: string,
    tags: string[]
  ): Promise<AIGeneratedContent> {
    const prompt = `Genera contenido optimizado para Amazon basado en este producto de Shopify:

TÍTULO: ${title}
DESCRIPCIÓN: ${description}
TIPO: ${productType}
MARCA: ${vendor}
TAGS: ${tags.join(', ')}

Genera en formato JSON:
{
  "title": "Título optimizado para Amazon (máx 200 chars)",
  "bulletPoints": ["5 bullet points cortos y persuasivos"],
  "description": "Descripción HTML formateada para Amazon",
  "keywords": ["10 keywords de búsqueda separados por coma"],
  "productType": "Tipo de producto Amazon (ej: LUGGAGE, HOME, SPORTS)",
  "category": "Categoría sugerida",
  "missingFields": ["Campos que faltan y deberían completarse"]
}`;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'Eres un experto en publicación de productos en Amazon. Genera contenido optimizado para SEO y conversiones.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${config.openai.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('No se pudo parsear la respuesta de IA');
    } catch (error) {
      console.error('[AI] Error generando contenido:', error);
      
      // Fallback: retornar contenido básico
      return {
        title: title.substring(0, 200),
        bulletPoints: [
          `Producto de alta calidad de ${vendor}`,
          `Tipo: ${productType}`,
          'Disponible para envío inmediato',
        ],
        description: description || `Producto ${title} de ${vendor}`,
        keywords: tags,
        productType: 'HOME',
        category: productType,
        missingFields: ['bulletPoints', 'keywords'],
      };
    }
  }
}
