// Central place for GraphQL documents (plain strings to avoid tooling churn)

export const QUERY_PRODUCT_BY_SLUG = /* GraphQL */ `
  query ProductBySlug($slug: String!) {
    product(slug: $slug) {
      id
      name
      slug
      description
      featuredAsset { preview }
      variants {
        id
        name
        priceWithTax
        currencyCode
      }
    }
  }
`;

export const MUTATION_ADD_TO_ORDER = /* GraphQL */ `
  mutation AddToOrder($variantId: ID!, $quantity: Int!) {
    addItemToOrder(productVariantId: $variantId, quantity: $quantity) {
      ... on Order {
        id
        code
        totalQuantity
        totalWithTax
        state
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`;

export const MUTATION_CHECKOUT = /* GraphQL */ `
  mutation Checkout(
    $email: String!
    $firstName: String!
    $lastName: String!
    $streetLine1: String!
    $city: String!
    $postalCode: String!
    $countryCode: String!
  ) {
    setCustomerForOrder(input: { firstName: $firstName, lastName: $lastName, emailAddress: $email }) {
      ... on Order { id }
      ... on ErrorResult { errorCode message }
    }
    setShippingAddress(input: {
      streetLine1: $streetLine1, city: $city, postalCode: $postalCode, countryCode: $countryCode
    }) {
      ... on Order { id }
      ... on ErrorResult { errorCode message }
    }
    setBillingAddress(input: {
      streetLine1: $streetLine1, city: $city, postalCode: $postalCode, countryCode: $countryCode
    }) {
      ... on Order { id }
      ... on ErrorResult { errorCode message }
    }
    addPaymentToOrder(input: { method: "manual-payment", metadata: {} }) {
      ... on Order { id code state }
      ... on ErrorResult { errorCode message }
    }
    transitionOrderToState(state: "ArrangingShipping") {
      ... on Order { id state }
      ... on ErrorResult { errorCode message }
    }
    transitionOrderToState(state: "ArrangingPayment") {
      ... on Order { id state }
      ... on ErrorResult { errorCode message }
    }
    transitionOrderToState(state: "PaymentAuthorized") {
      ... on Order { id state code }
      ... on ErrorResult { errorCode message }
    }
  }
`;
