// Shopify Types
export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: string;
  images: ShopifyImage[];
  variants: ShopifyVariant[];
  options: ShopifyOption[];
  metafields?: ShopifyMetafield[];
}

export interface ShopifyImage {
  id: string;
  src: string;
  altText: string | null;
}

export interface ShopifyVariant {
  id: string;
  title: string;
  sku: string;
  price: string;
  compareAtPrice: string | null;
  inventoryQuantity: number;
  weight: number;
  weightUnit: string;
  barcode?: string;
  externalId?: string;
  externalIdType?: string;
  image?: ShopifyImage;
  metafields?: ShopifyMetafield[];
}

export interface ShopifyOption {
  name: string;
  values: string[];
}

export interface ShopifyMetafield {
  namespace: string;
  key: string;
  value: string;
}

// Amazon Types
export interface AmazonProductListing {
  shopifyProductId: string;
  sellerSku: string;
  productType: string;
  requirements: string;
  attributes?: AmazonAttributes;
  asin?: string;
  externalId?: string;
  externalIdType?: string;
  quantity?: number;
}

export interface AmazonAttributes {
  itemName: string;
  brand: string;
  externalProductId?: string;
  externalProductIdType?: string;
  conditionType: string;
  bulletPoint?: string[];
  productDescription?: string;
  mainProductImageLocator?: AmazonImageLocator[];
  otherProductImageLocator?: AmazonImageLocator[];
  color?: string;
  size?: string;
  material?: string;
  packageWeight?: AmazonMeasurement;
  listPrice?: AmazonMoney;
  merchantSuggestedAsin?: string;
  keywords?: string[];
  fulfillmentAvailability?: Array<{
    quantity: number;
    fulfillmentChannelCode: string;
  }>;
}

export interface AmazonImageLocator {
  marketplaceId: string;
  mediaLocation: string;
}

export interface AmazonMeasurement {
  unit: string;
  value: number;
}

export interface AmazonMoney {
  currencyCode: string;
  amount: string;
}

// AI Generated Content
export interface AIGeneratedContent {
  title: string;
  bulletPoints: string[];
  description: string;
  keywords: string[];
  productType: string;
  category: string;
  missingFields: string[];
}

// Publish Result
export interface PublishResult {
  shopifyProductId: string;
  sku: string;
  success: boolean;
  amazonSku: string;
  message: string;
  errors?: string[];
  timestamp: string;
}
