import { OpenAIEmbeddings } from "@langchain/openai";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  json,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  InlineStack,
  Layout,
  Page,
  Scrollable,
  Spinner,
  Text,
  type TableData,
} from "@shopify/polaris";
import Bottleneck from "bottleneck";
import cosine from "compute-cosine-similarity";
import { useEffect, useState } from "react";
import { authenticate } from "~/shopify.server";
import type { MetafieldDefinition } from "~/types/admin.types";
import { type RelatedCollectionsTransformed } from "~/utils/chat.server";
import {
  getAllCollections,
  initializeMetafields,
  updateRelatedCollectionsMetafield,
} from "~/utils/helpers.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const collections = await getAllCollections(admin);
  const targetMetafield = await initializeMetafields(admin);

  return json({ collections, targetMetafield });
};
export const shouldRevalidate = () => false;
export type Recommendations = {
  currentCollection?: string;
  relevantCategories?: string[];
}[];

export type TargetMetafield =
  | Pick<MetafieldDefinition, "id" | "key" | "namespace">
  | undefined;

export const action = async ({ request }: ActionFunctionArgs) => {
  const {
    recommendations,
    targetField,
    allCollectionsTitle,
  }: {
    recommendations?: string;
    targetField?: string;
    allCollectionsTitle?: string;
  } = Object.fromEntries(await request.formData());

  const { admin } = await authenticate.admin(request);

  // Final step - Applying related collections to collections
  if (recommendations && targetField) {
    const recommendationsParsed: Recommendations = JSON.parse(recommendations);
    const targetMetafieldParsed: TargetMetafield = JSON.parse(targetField);

    const limiter = new Bottleneck({
      minTime: 1000 / 10, // At most 10 requests per second
    });

    const tasks = recommendationsParsed.map((collection) => {
      const currentCollection = collection.currentCollection;
      const relevantCategories = collection.relevantCategories;

      if (
        currentCollection &&
        relevantCategories &&
        targetMetafieldParsed?.namespace
      ) {
        return limiter.schedule(() =>
          updateRelatedCollectionsMetafield(
            admin,
            targetMetafieldParsed?.namespace,
            currentCollection,
            relevantCategories,
          ),
        );
      }
      return undefined;
    });

    try {
      await Promise.all(tasks);
      return json({
        collectionsApplied: true,
        error: "",
        res: [],
      });
    } catch (error) {
      console.error("Error applying collections:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if it's a 401 authentication error
      if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized')) {
        return json({
          collectionsApplied: false,
          error: "Authentication expired. Please refresh the page and reinstall the app if needed.",
          res: [],
        });
      }

      return json({
        collectionsApplied: false,
        error: `Failed applying related collections: ${errorMessage}. Please try again.`,
        res: [],
      });
    }
  }

  if (allCollectionsTitle) {
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const collections1: string[] = JSON.parse(allCollectionsTitle);
    try {
      const res = await embeddings.embedDocuments(collections1);
      return json({
        collectionsApplied: false,
        error: "",
        res: collections1.map((c, i) => ({
          title: c,
          embeddings: res[i],
        })),
      });
    } catch (error) {
      console.error("Error generating embeddings:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return json({
        collectionsApplied: false,
        error: `Failed generating related collections: ${errorMessage}. Please try again.`,
        res: [],
      });
    }
  }

  return json({
    collectionsApplied: false,
    error: "Something went wrong. Please try again.",
    res: [],
  });
};

export default function Index() {
  const nav = useNavigation();
  const actionData = useActionData<typeof action>();
  const { collections, targetMetafield } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const isLoading =
    ["submitting"].includes(nav.state) && nav.formMethod === "POST";
  const [isResultGenerated, setIsResultGenerated] = useState(false);
  const [areCollectionsApplied, setAreCollectionsApplied] = useState(0);
  const [allCollectionsTitle, setAllCollectionsTitle] = useState<string[]>([]);
  const [collectionsForDisplay, setCollectionsForDisplay] =
    useState<RelatedCollectionsTransformed>([]);
  const [mappedRecommendations, setMappedRecommendations] = useState<
    Recommendations[]
  >([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const isProcessingData =
    ["loading"].includes(nav.state) && nav.formMethod === "POST";

  // Get all collections
  useEffect(() => {
    if (collections) {
      const collectionTitles = collections.map((c) => c.title);
      const uniqueCollections = [...new Set(collectionTitles)];
      setAllCollectionsTitle(uniqueCollections);
    }
  }, [collections]);

  // Process embeddings and return recommendations
  useEffect(() => {
    if (actionData?.error !== "") return;
    if (actionData?.res && !collectionsForDisplay.length) {
      const recommendations = actionData?.res.map((category, i) => {
        const currentEmbedding = category?.embeddings;
        const similarityScores = actionData?.res
          .filter((c, j) => i !== j)
          .map((c, j) => ({
            target: c?.title,
            score:
              currentEmbedding && c
                ? cosine(currentEmbedding, c.embeddings)
                : 0,
          }))
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, 11)
          .map((c) => c.target);

        return {
          c: category?.title || "",
          r: similarityScores ?? [],
        };
      });
      setIsResultGenerated(true);
      setCollectionsForDisplay(
        recommendations.map((recommendation) => ({
          ...recommendation,
          r: recommendation.r.filter(
            (item): item is string => item !== undefined,
          ),
        })),
      );
    }
  }, [actionData?.error, actionData?.res, collectionsForDisplay.length]);

  // Once recommendations are ready, map them to the collections ID
  useEffect(() => {
    if (collectionsForDisplay) {
      // Map the recommendations to the collections
      const mappedCollections = collections.map((collection) => {
        const currentCollection = collectionsForDisplay.find(
          (c) => collection.title === c?.c,
        );
        const collectionId = collection.id;
        const relevantCategories = currentCollection?.r.map((r) => {
          const relatedCollection = collections.find((c) => c.title === r);
          return relatedCollection?.id ?? "";
        });

        return {
          currentCollection: collectionId,
          relevantCategories,
        };
      });
      const chunkedMappedCollections = mappedCollections.reduce(
        (resultArray: Recommendations[], item, index) => {
          const chunkIndex = Math.floor(index / 600);

          if (!resultArray[chunkIndex]) {
            resultArray[chunkIndex] = []; // start a new chunk
          }

          resultArray[chunkIndex].push(item);

          return resultArray;
        },
        [],
      );
      setMappedRecommendations(chunkedMappedCollections);
    }
  }, [
    actionData,
    allCollectionsTitle,
    collections,
    collectionsForDisplay,
    isResultGenerated,
  ]);

  // If collections applied, update state
  useEffect(() => {
    if (actionData?.error && actionData.error !== "") {
      // Set local error and clear any previous local errors
      setLocalError(null);
      return;
    }
    if (actionData?.collectionsApplied) {
      setAreCollectionsApplied((prev) => prev + 1);
      // Clear any local errors on success
      setLocalError(null);
    }
  }, [actionData]);

  if (collections.length === 0) {
    return (
      <Page>
        <Layout>
          <Layout.Section>
            <Banner
              title={"Your store does not have any collections yet."}
              tone="critical"
            />
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page>
      <ui-title-bar title="Skailed™ Smart Links"></ui-title-bar>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {(actionData?.error || localError) && (
              <Banner
                title="Error"
                tone="critical"
              >
                <BlockStack gap="200">
                  <Text as="p">{actionData?.error || localError}</Text>
                  {((actionData?.error || localError)?.toLowerCase().includes('authentication') ||
                    (actionData?.error || localError)?.includes('401')) && (
                    <Text as="p" variant="bodyMd">
                      <strong>Tip:</strong> If you're seeing authentication errors, try:
                      <br />• Refreshing this page
                      <br />• Reinstalling the app from the Shopify admin
                      <br />• Ensuring the app has the required permissions
                    </Text>
                  )}
                  {localError && (
                    <InlineStack gap="200">
                      <Button size="micro" onClick={() => setLocalError(null)}>
                        Dismiss
                      </Button>
                    </InlineStack>
                  )}
                </BlockStack>
              </Banner>
            )}
            <Card>
              {areCollectionsApplied === mappedRecommendations.length ? (
                <Banner
                  title={
                    "Related collections successully applied to all collections!"
                  }
                  tone="success"
                />
              ) : (
                <BlockStack gap="500">
                  {!isResultGenerated && (
                    <>
                      <Text as="h3" variant="headingMd">
                        Press the button below to generate related collections.
                      </Text>
                      <Text as="p">
                        Once the operation is completed, a table will be
                        displayed with the collections and their related
                        collections. Please note that this will only show the
                        result and not apply the related collections to the
                        collections yet.
                      </Text>
                      <InlineStack>
                        <Button
                          disabled={isLoading || isProcessingData}
                          variant="primary"
                          onClick={() =>
                            submit(
                              {
                                allCollectionsTitle:
                                  JSON.stringify(allCollectionsTitle),
                              },
                              { method: "post" },
                            )
                          }
                        >
                          Generate collections
                        </Button>
                      </InlineStack>
                      {isLoading && (
                        <InlineStack gap="300" blockAlign="center">
                          <Spinner accessibilityLabel="Loading" size="large" />
                          <Text as="p">
                            {isProcessingData ? "Processing" : "Generating"}{" "}
                            related collections for {allCollectionsTitle.length}{" "}
                            collections.
                            <br />
                            This will take approximately{" "}
                            {Math.ceil(allCollectionsTitle.length * 0.025)}{" "}
                            seconds. Please do not refresh the page.
                          </Text>
                        </InlineStack>
                      )}
                    </>
                  )}

                  {isResultGenerated && (
                    <Text as="h3" variant="headingMd">
                      Please review the result below and press the "Apply to
                      collections" button to start adding the related
                      collections to the collections.
                    </Text>
                  )}

                  {collectionsForDisplay && isResultGenerated && (
                    <Scrollable shadow style={{ height: "600px" }} focusable>
                      <DataTable
                        stickyHeader
                        columnContentTypes={["text", "text"]}
                        headings={["Collection", "Related Collections"]}
                        firstColumnMinWidth="350px"
                        rows={
                          collectionsForDisplay
                            .filter((c) => c.c && c.r.length > 0)
                            .map((collection) => [
                              collection.c,
                              collection.r.join(", "),
                            ]) as TableData[][]
                        }
                      />
                    </Scrollable>
                  )}

                  {isResultGenerated && (
                    <BlockStack gap="500">
                      {mappedRecommendations.length > 1 && (
                        <>
                          <Banner tone="info">
                            Since your collection exceeds 600, we have to split
                            the operation into {mappedRecommendations.length}.
                          </Banner>
                          <Text as="p" variant="headingMd">
                            Please press the "Apply to collections" button for
                            each of the batch.
                          </Text>
                        </>
                      )}
                      <InlineStack gap="500">
                        {mappedRecommendations.map((recommendation, i) => (
                          <Button
                            disabled={isLoading || areCollectionsApplied !== i}
                            variant="primary"
                            key={i}
                            onClick={() => {
                              try {
                                submit(
                                  {
                                    recommendations:
                                      JSON.stringify(recommendation) ?? "",
                                    targetField:
                                      JSON.stringify(targetMetafield) ?? "",
                                  },
                                  { method: "post" },
                                );
                              } catch (error) {
                                console.error("Submit error:", error);
                                // Handle error gracefully without throwing
                              }
                            }}
                          >
                            {areCollectionsApplied > i
                              ? "Applied ✅"
                              : `Apply to collections
                          ${
                            mappedRecommendations.length > 1
                              ? `(Batch ${i + 1})`
                              : ""
                          }`}
                          </Button>
                        ))}
                      </InlineStack>
                      {isLoading && (
                        <InlineStack gap="300" blockAlign="center">
                          <Spinner accessibilityLabel="Loading" size="large" />
                          <Text as="p">
                            Applying related collections (Batch{" "}
                            {areCollectionsApplied + 1}) for{" "}
                            {
                              mappedRecommendations[areCollectionsApplied]
                                .length
                            }{" "}
                            collections.
                            <br />
                            This will take approximately{" "}
                            {Math.ceil(
                              mappedRecommendations[areCollectionsApplied]
                                .length * 0.1,
                            )}{" "}
                            seconds. Please do not refresh the page.
                          </Text>
                        </InlineStack>
                      )}
                    </BlockStack>
                  )}
                </BlockStack>
              )}
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}


