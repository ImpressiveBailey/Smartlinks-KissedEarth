import type { authenticate } from "~/shopify.server";
import {
  CREATE_METAFIELDS_DEFINITION,
  GET_APP_METAFIELDS,
  GET_COLLECTIONS,
  GET_PINNED_COLLECTIONS,
  SET_METAFIELD,
} from "~/constants/graphQlQueries";
import {
  MetafieldAdminAccess,
  MetafieldOwnerType,
  MetafieldStorefrontAccess,
} from "~/types/admin.types.d";

type AdminClient = Awaited<ReturnType<typeof authenticate.admin>>['admin'];

// Define types for common GraphQL response structures
type Edge<T> = { node: T };
type MetafieldDefinition = { key: string; id: string; namespace: string; [key: string]: any };
type Collection = { id: string; title: string; [key: string]: any };

export const initializeMetafields = async (
  admin: AdminClient,
) => {
  let relatedCollectionsMetafieldId;
  const metafieldsToCreate = [
    {
      key: "imp_related_collections",
      name: "Related Collections",
      description:
        "Do not edit. These collections are added automatically and will be overridden when a new related collections are generated.",
    },
    {
      key: "imp_excluded_collections",
      name: "Excluded Collections",
      description:
        "Edit this metafield if you wish to exclude a particular collection added by the AI from the Related collections metafield.",
    },
    {
      key: "imp_additional_collections",
      name: "Additional Collections",
      description:
        "If you wish to add more related collections, you can manually add them here.",
    },
  ];

  const targetMetafields = await admin.graphql(GET_APP_METAFIELDS);
  const metafieldJson = await targetMetafields.json();
  const existingMetafields = metafieldJson.data?.metafieldDefinitions.edges.map(
    (edge: Edge<MetafieldDefinition>) => edge.node,
  );

  // check if all keys inside metafieldsToCreate are present on existingMetafields
  const allMetafieldsPresent = metafieldsToCreate.every((metafield) =>
    existingMetafields?.some(
      (existingMetafield: MetafieldDefinition) => existingMetafield.key === metafield.key,
    ),
  );
  if (allMetafieldsPresent) {
    relatedCollectionsMetafieldId = existingMetafields?.find(
      (metafield: MetafieldDefinition) => metafield.key === "imp_related_collections",
    );
    return relatedCollectionsMetafieldId;
  }

  const pinnedMetafields = await admin.graphql(GET_PINNED_COLLECTIONS);
  const rawPinnedMetafields = await pinnedMetafields.json();
  const allPinnedMetafields =
    rawPinnedMetafields.data?.metafieldDefinitions.edges.length || 0;

  await Promise.all(
    metafieldsToCreate.map(async (metafield) => {
      const { key, description, name } = metafield;
      if (
        existingMetafields?.some(
          (existingMetafield: MetafieldDefinition) => existingMetafield.key === key,
        )
      ) {
        return null;
      }
      const metafieldCreateResp = await admin.graphql(
        CREATE_METAFIELDS_DEFINITION,
        {
          variables: {
            definition: {
              key,
              description,
              name,
              access: {
                admin: MetafieldAdminAccess.MerchantReadWrite,
                storefront: MetafieldStorefrontAccess.PublicRead,
              },
              type: "list.collection_reference",
              ownerType: MetafieldOwnerType.Collection,
              pin: allPinnedMetafields <= 17,
            },
          },
        },
      );

      if (key === "imp_related_collections") {
        const createdMetafieldId = (await metafieldCreateResp.json()).data;
        return createdMetafieldId?.metafieldDefinitionCreate?.createdDefinition;
      }

      return null;
    }),
  );

  relatedCollectionsMetafieldId = existingMetafields?.find(
    (metafield: MetafieldDefinition) => metafield.key === "imp_related_collections",
  );

  return relatedCollectionsMetafieldId;
};
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const getAllCollections = async (
  admin: AdminClient,
) => {
  let hasNextPage = true;
  let cursor = "";
  const allCollections = [];

  while (hasNextPage) {
    // get all collections
    const collectionsQuery = await admin.graphql(GET_COLLECTIONS, {
      variables: { after: cursor === "" ? undefined : cursor },
    });

    const responseJson = await collectionsQuery.json();
    const hasNextPageResp =
      responseJson.data?.collections.pageInfo.hasNextPage || false;
    const collections = responseJson.data?.collections.edges.map(
      (edge: Edge<Collection>) => edge.node,
    );
    cursor = responseJson.data?.collections.pageInfo.endCursor || "";
    if (collections) {
      allCollections.push(...collections);
    }
    hasNextPage = hasNextPageResp;
    await delay(50);
  }

  return allCollections;
};

export const updateRelatedCollectionsMetafield = async (
  admin: AdminClient,
  namespace: string,
  collectionId: string,
  collectionIds: string[],
) => {
  return await admin.graphql(SET_METAFIELD, {
    variables: {
      metafields: [
        {
          key: "imp_related_collections",
          namespace,
          ownerId: collectionId,
          type: "list.collection_reference",
          value: JSON.stringify(collectionIds),
        },
      ],
    },
  });
};

// export const populateCollections = async (
//   admin: AdminApiContext<RestResources>,
// ) => {
//   for (const collection of memoCollections) {
//     await admin.graphql(
//       `#graphql
//         mutation populateProduct($input: CollectionInput!) {
//           collectionCreate(input: $input) {
//             collection {
//               id
//               title
//               handle
//             }
//           }
//         }`,
//       {
//         variables: {
//           input: {
//             title: collection.categoryName,
//             handle: collection.currentUrl,
//           },
//         },
//       },
//     );
//     await delay(200);
//     console.log(`Collection ${collection.categoryName} created`);
//   }
//   console.log("All collections created");
//   return null;
// };
