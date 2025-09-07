export const PRODUCTS_QUERY = /* GraphQL */ `
  query Products($take: Int!) {
    products(options: { take: $take }) {
      items {
        id
        name
        slug
        featuredAsset { preview }
        variants { id name priceWithTax currencyCode }
      }
    }
  }
`;
