import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

async function publishTest() {
  try {
    console.log('🔑 Obteniendo token de Amazon...');
    
    const tokenResponse = await axios.post('https://api.amazon.com/auth/o2/token', {
      grant_type: 'refresh_token',
      refresh_token: process.env.AMAZON_REFRESH_TOKEN!,
      client_id: process.env.AMAZON_LWA_CLIENT_ID!,
      client_secret: process.env.AMAZON_LWA_CLIENT_SECRET!,
    });

    const accessToken = tokenResponse.data.access_token;
    console.log('✅ Token obtenido');

    const sku = '76289822255194';
    const marketplaceId = 'A1AM78C64UM0Y8';
    const sellerId = process.env.AMAZON_SELLER_ID;
    
    console.log(`📤 Creando oferta para SKU: ${sku}...`);
    
    const url = `https://sellingpartnerapi-na.amazon.com/listings/2021-08-01/items/${sellerId}/${sku}?marketplaceIds=${marketplaceId}`;
    
    // Crear oferta en listing existente usando ASIN - solo campos necesarios
    const payload = {
      productType: 'HEADPHONES',
      requirements: 'LISTING_OFFER_ONLY',
      attributes: {
        merchant_suggested_asin: [{
          value: 'B0GTS2DW2Y',
          marketplace_id: marketplaceId
        }],
        condition_type: [{
          value: 'new_new',
          marketplace_id: marketplaceId
        }],
        externally_assigned_product_identifier: [{
          value: '7503058803911',
          type: 'ean',
          marketplace_id: marketplaceId
        }],
        fulfillment_availability: [{
          quantity: 1,
          fulfillment_channel_code: 'DEFAULT',
          marketplace_id: marketplaceId
        }]
      }
    };
    
    console.log('📦 Enviando oferta a Amazon México...');
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.put(url, payload, {
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Oferta creada!');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error: any) {
    console.error('❌ Error:');
    console.error(JSON.stringify(error.response?.data, null, 2) || error.message);
  }
}

publishTest();
