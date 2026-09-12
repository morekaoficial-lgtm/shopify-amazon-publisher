import { Router, Request, Response } from 'express';
import { ShopifyService } from '../services/shopifyService';

const router = Router();
const shopify = new ShopifyService();

// Listar todos los productos
router.get('/', async (_req: Request, res: Response) => {
  try {
    const products = await shopify.getAllProducts(250);
    res.json({
      count: products.length,
      products: products.map(p => ({
        id: p.id,
        title: p.title,
        sku: p.variants[0]?.sku || 'Sin SKU',
        price: p.variants[0]?.price || '0',
        inventory: p.variants[0]?.inventoryQuantity || 0,
        image: p.images[0]?.src || null,
        status: p.status,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Obtener un producto por ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const product = await shopify.getProduct(req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado' });
      return;
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
