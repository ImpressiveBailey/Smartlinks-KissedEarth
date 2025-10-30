import { eventTrigger } from "@trigger.dev/sdk";
import { client } from "~/trigger.server";
import {
  type RelatedCollectionsTransformed,
  generateRelatedCollectionsResult,
} from "~/utils/chat.server";

export const job = client.defineJob({
  id: "example-job",
  name: "Example Job: a joke with a delay",
  version: "0.0.1",
  trigger: eventTrigger({
    name: "example.event",
  }),
  run: async (payload: string[], io, ctx) => {
    let allResults: RelatedCollectionsTransformed = [];
    const payloadLength = payload.length;

    if (payloadLength > 800) {
      const half = Math.ceil(payloadLength / 2);

      const firstHalfPayload = payload.slice(0, half);
      const secondHalfPayload = payload.slice(half);

      await io.runTask("generate-collections-1", async () => {
        const results = await generateRelatedCollectionsResult(
          payload,
          firstHalfPayload,
        );
        allResults.push(...results.results);
      });

      await io.runTask("generate-collections-2", async () => {
        const results = await generateRelatedCollectionsResult(
          payload,
          secondHalfPayload,
        );
        allResults.push(...results.results);
      });
    } else {
      await io.runTask("generate-collections", async () => {
        const results = await generateRelatedCollectionsResult(
          payload,
          payload,
        );
        allResults.push(...results.results);
      });
    }

    return allResults;
  },
});
