import { gql } from 'graphql-tag';

export const adminApiExtensionsSchema = gql/* GraphQL */`
  extend type Mutation {
    registerSeller(input: RegisterSellerInput!): RegisterSellerResult!
  }

  input RegisterSellerInput {
    sellerName: String!
    adminEmail: String!
    adminPassword: String!
    adminFirstName: String!
    adminLastName: String!
  }

  type RegisterSellerResult {
    sellerId: ID!
    channelId: ID!
    channelToken: String!
    roleId: ID!
    adminId: ID!
    adminEmail: String!
    stockLocationId: ID!
    shippingMethodId: ID!
  }
`;
