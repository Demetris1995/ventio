import gql from 'graphql-tag';

export const schema = gql`
  extend type Mutation {
    registerSeller(input: RegisterSellerInput!): RegisterSellerPayload!
  }

  input RegisterSellerInput {
    name: String!
    adminEmailAddress: String!
    adminPassword: String!
  }

  type RegisterSellerPayload {
    sellerId: ID!
    channelId: ID!
    channelToken: String!
    adminEmailAddress: String!
    adminPassword: String!
  }

  type SellerShippingQuote {
    id: ID!
    code: String!
    name: String!
    price: Money!
    priceWithTax: Money!
  }

  type SellerEligibleMethods {
    sellerChannelId: ID!
    sellerName: String
    quotes: [SellerShippingQuote!]!
  }

  input SellerShippingSelectionInput {
    sellerChannelId: ID!
    shippingMethodId: ID!
  }

  extend type Query {
    eligibleMethodsBySeller: [SellerEligibleMethods!]!
  }

  extend type Mutation {
    setShippingPerSeller(selections: [SellerShippingSelectionInput!]!): Order!
  }
`;
