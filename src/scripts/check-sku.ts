import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

async function checkSku() {
  try {
    console.log('🔑 Obteniendo token...');
    
    const tokenResponse = await axios.post('https://api.amazon.com/auth/o2/token', {
      grant_type: 'refresh_token',
      refresh_token: process.env.AMAZON_REFRESH_TOKEN!,
      client_id: process.env.AMAZON_LWA_CLIENT_ID!,
      client_secret: process.env.AMAZON_LWA_CLIENT_SECRET!,
    });

    const accessToken = tokenResponse.data.access_token;
    console.log('✅ Token obtenido\n');

    const sku = '76289822255194';
    const marketplaceId = 'A1AM78C64UM0Y8';
    
    console.log(`🔍 Verificando SKU: ${sku}...`);
    
    try {
      const response = await axios.get(
        `https://sellingpartnerapi-na.amazon.com/listings/2021-08-01/items/${marketplaceId}/${sku}`,
        {
          headers: {
            'x-amz-access-token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log('✅ SKU encontrado en Amazon:');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (getError: any) {
      console.log('❌ SKU no encontrado o error:');
      console.log(JSON.stringify(getError.response?.data, null, 2) || getError.message);
    }

  } catch (error: any) {
    console.error('❌ Error:', JSON.stringify(error.response?.data, null, 2) || error.message);
  }
}

checkSku();
