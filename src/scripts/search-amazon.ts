import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

async function searchProduct() {
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

    // Buscar producto por keywords
    const sellerId = process.env.AMAZON_SELLER_ID;
    const marketplaceId = 'A1AM78C64UM0Y8';
    
    console.log('🔍 Buscando productos de Moreka...');
    
    try {
      const response = await axios.get(
        `https://sellingpartnerapi-na.amazon.com/catalog/2022-04-01/items?marketplaceIds=${marketplaceId}&keywords=Moreka+BL029&includedData=identifiers,images,summaries`,
        {
          headers: {
            'x-amz-access-token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log('✅ Productos encontrados:');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (searchError: any) {
      console.log('❌ Error en búsqueda:', searchError.response?.data || searchError.message);
    }

  } catch (error: any) {
    console.error('❌ Error:', JSON.stringify(error.response?.data, null, 2) || error.message);
  }
}

searchProduct();
