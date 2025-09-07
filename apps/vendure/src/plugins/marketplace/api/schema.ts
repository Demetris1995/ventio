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
`;
