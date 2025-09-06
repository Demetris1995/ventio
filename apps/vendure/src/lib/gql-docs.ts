export const QUERY_ACTIVE_ORDER = /* GraphQL */ `
  query ActiveOrder {
    activeOrder {
      id
      code
      currencyCode
      totalWithTax
      subTotalWithTax
      lines {
        id
        quantity
        linePriceWithTax
        productVariant {
          id
          name
          sku
          priceWithTax
          product {
            slug
          }
        }
        featuredAsset {
          preview
        }
      }
    }
  }
`;

export const MUTATION_ADD_ITEM = /* GraphQL */ `
  mutation AddItemToOrder($variantId: ID!, $qty: Int!) {
    addItemToOrder(productVariantId: $variantId, quantity: $qty) {
      ... on Order { id }
      ... on ErrorResult { errorCode message }
    }
  }
`;

export const MUTATION_ADJUST_LINE = /* GraphQL */ `
  mutation AdjustOrderLine($lineId: ID!, $qty: Int!) {
    adjustOrderLine(orderLineId: $lineId, quantity: $qty) {
      ... on Order { id }
      ... on ErrorResult { errorCode message }
    }
  }
`;

export const MUTATION_REMOVE_LINE = /* GraphQL */ `
  mutation RemoveOrderLine($lineId: ID!) {
    removeOrderLine(orderLineId: $lineId) {
      ... on Order { id }
      ... on ErrorResult { errorCode message }
    }
  }
`;
