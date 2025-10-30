/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import * as AdminTypes from './admin.types.d.ts';

export type FetchCollectionsQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type FetchCollectionsQuery = { collections: { edges: Array<{ node: Pick<AdminTypes.Collection, 'id' | 'title' | 'handle'> }> } };

export type MetafieldDefinitionCreateMutationVariables = AdminTypes.Exact<{
  definition: AdminTypes.MetafieldDefinitionInput;
}>;


export type MetafieldDefinitionCreateMutation = { metafieldDefinitionCreate?: AdminTypes.Maybe<{ createdDefinition?: AdminTypes.Maybe<Pick<AdminTypes.MetafieldDefinition, 'id' | 'key' | 'namespace'>> }> };

export type GetCollectionsQueryVariables = AdminTypes.Exact<{
  after?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type GetCollectionsQuery = { collections: { pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'>, edges: Array<(
      Pick<AdminTypes.CollectionEdge, 'cursor'>
      & { node: Pick<AdminTypes.Collection, 'id' | 'title'> }
    )> } };

export type MetafieldsSetMutationVariables = AdminTypes.Exact<{
  metafields: Array<AdminTypes.MetafieldsSetInput> | AdminTypes.MetafieldsSetInput;
}>;


export type MetafieldsSetMutation = { metafieldsSet?: AdminTypes.Maybe<{ metafields?: AdminTypes.Maybe<Array<Pick<AdminTypes.Metafield, 'key'>>> }> };

export type ImpCollectionsMetafieldQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type ImpCollectionsMetafieldQuery = { metafieldDefinitions: { edges: Array<{ node: Pick<AdminTypes.MetafieldDefinition, 'id' | 'key' | 'namespace'> }> } };

export type PinnedCollectionsMetafieldQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type PinnedCollectionsMetafieldQuery = { metafieldDefinitions: { edges: Array<{ node: Pick<AdminTypes.MetafieldDefinition, 'id' | 'key'> }> } };

interface GeneratedQueryTypes {
  "#graphql\nquery fetchCollections{\n  collections(first: 10) {\n    edges {\n      node {\n        id\n        title\n        handle\n      }\n    }\n  }\n}": {return: FetchCollectionsQuery, variables: FetchCollectionsQueryVariables},
  "#graphql\nquery GetCollections($after: String){\n  collections(first: 200, after: $after) {\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n    edges {\n      cursor\n      node {\n        id\n        title\n      }\n    }\n  },\n}": {return: GetCollectionsQuery, variables: GetCollectionsQueryVariables},
  "#graphql\nquery impCollectionsMetafield {\n  metafieldDefinitions(first: 20, query: \"key:imp_*\", ownerType: COLLECTION) {\n    edges {\n      node {\n        id\n        key\n        namespace\n      }\n    }\n  }\n}": {return: ImpCollectionsMetafieldQuery, variables: ImpCollectionsMetafieldQueryVariables},
  "#graphql\nquery pinnedCollectionsMetafield {\n  metafieldDefinitions(first: 20, pinnedStatus: PINNED, ownerType: COLLECTION) {\n    edges {\n      node {\n        id\n        key\n      }\n    }\n  }\n}": {return: PinnedCollectionsMetafieldQuery, variables: PinnedCollectionsMetafieldQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\nmutation metafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {\n  metafieldDefinitionCreate(definition: $definition) {\n    createdDefinition {\n      id\n      key\n      namespace\n    }\n  }\n}": {return: MetafieldDefinitionCreateMutation, variables: MetafieldDefinitionCreateMutationVariables},
  "#graphql\nmutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {\n  metafieldsSet(metafields: $metafields) {\n    metafields {\n      key\n    }\n  }\n}": {return: MetafieldsSetMutation, variables: MetafieldsSetMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
