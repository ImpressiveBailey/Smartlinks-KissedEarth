export const FETCH_COLLECTIONS = `#graphql
query fetchCollections{
  collections(first: 10) {
    edges {
      node {
        id
        title
        handle
      }
    }
  }
}`;

export const CREATE_METAFIELDS_DEFINITION = `#graphql
mutation metafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition {
      id
      key
      namespace
    }
  }
}`;

export const GET_COLLECTIONS = `#graphql
query GetCollections($after: String){
  collections(first: 200, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node {
        id
        title
      }
    }
  },
}`;

export const SET_METAFIELD = `#graphql
mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields {
      key
    }
  }
}`;

export const GET_APP_METAFIELDS = `#graphql
query impCollectionsMetafield {
  metafieldDefinitions(first: 20, query: "key:imp_*", ownerType: COLLECTION) {
    edges {
      node {
        id
        key
        namespace
      }
    }
  }
}`;

export const GET_PINNED_COLLECTIONS = `#graphql
query pinnedCollectionsMetafield {
  metafieldDefinitions(first: 20, pinnedStatus: PINNED, ownerType: COLLECTION) {
    edges {
      node {
        id
        key
      }
    }
  }
}`;
