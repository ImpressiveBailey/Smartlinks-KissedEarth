import OpenAI from "openai";

export type RelatedCollectionsResult = { data: { c: number; r: number[] }[] };
export type RelatedCollectionsTransformed = { c: string; r: string[] }[];

export const SYSTEM_PROMPT = `
You are an online store assistant. I will provide you with a list of shop categories with keys representing their category name and values representing their indices.

For example:
{"Computer": 0, "Gardening": 1,"Keyboard": 2, "Soil": 3}

After that, I will give you a list of numbers or indices representing the value of each item on the object. Your task is to return the top 10 (if there's enough categories) related categories from the list provided, based on the semantic distance of the category name to them.

Please note the following guidelines for your response:
1. Exclude Current Title: Do not include the current category index in the related results indices. For instance, if the query is for "0" (Breastfeeding), do not return "0" as a related category.
2. Ensure Valid JSON Format: Your response must be in valid JSON array format without any additional comments or text. The response should consist of an array of objects, where each object has a category index (c) and an array of related categories represented by their indices (r).
3. Always return top 10 indexes in (r) related categories: Provide the top 10 items that are closest in semantic meaning to the category's name.
4. No duplicate indices on the (r) related categories: Each (r) related categories indices on a category should be unique.

Here's an example of the expected format:
{ "data": [
  { "c": 0, "r": [2, // ...9 more related categories if any] },
  { "c": 1, "r": [3, // ...9 more related categories if any] },
  { "c": 2, "r": [0, // ...9 more related categories if any] },
  { "c": 3, "r": [1, // ...9 more related categories if any] }
]}

In the example above, Computer is related to keyboard while gardening is related to soil.

Please ensure that the related categories returned are semantically meaningful and relevant to the given category key.
`;

export const CHATGPT_CONFIG = {
  model: "gpt-3.5-turbo-0125",
  temperature: 0.85,
  top_p: 0.9,
  max_tokens: 4095,
  frequency_penalty: 0.1,
};

export const callChatGPT = async (
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
) => {
  const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_SECRET_KEY,
  });
  try {
    const completion = await openai.chat.completions.create({
      messages,
      ...CHATGPT_CONFIG,
      response_format: { type: "json_object" },
    });
    return completion.choices[0].message;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
};

export const splitPrompt = (text: string, splitLength: number): string[] => {
  if (splitLength <= 0) {
    return [];
  }

  const numParts = Math.ceil(text.length / splitLength);
  const fileData: string[] = [];

  for (let i = 0; i < numParts; i++) {
    const start = i * splitLength;
    const end = Math.min((i + 1) * splitLength, text.length);

    let content: string;
    if (i === numParts - 1) {
      content =
        `[START PART ${i + 1}/${numParts}]\n` +
        text.slice(start, end) +
        `\n[END PART ${i + 1}/${numParts}]`;
      content +=
        "\nALL PARTS SENT. I will now send a title and you will return the result for that title immediately. For now just acknowledge you understood.";
    } else {
      content =
        `Do not answer yet. This is just another part of the text I want to send you. Just receive and acknowledge as "Part ${i + 1}/${numParts} received" and wait for the next part.\n[START PART ${i + 1}/${numParts}]\n` +
        text.slice(start, end) +
        `\n[END PART ${i + 1}/${numParts}]`;
      content += `\nRemember not answering yet. Just acknowledge you received this part with the message "Part ${i + 1}/${numParts} received" and wait for the next part.`;
    }

    fileData.push(content);
  }

  return fileData;
};
const isValidJSON = (str: string) => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

export const transformResultToActualValues = (
  categories: string[],
  result: RelatedCollectionsResult["data"],
): RelatedCollectionsTransformed =>
  result.map((item) => {
    const c = categories[item.c];
    const r = item.r?.map((index) => categories[index]);
    return {
      c,
      r,
    };
  });

export const generateRelatedCollectionsResult = async (
  allCategories: string[],
  categories: string[],
) => {
  let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    } as OpenAI.Chat.Completions.ChatCompletionSystemMessageParam,
  ];

  // split data into chunks
  console.log("Feeding data to chat gpt");
  const categoriesObjectRaw = allCategories.reduce(
    (obj: Record<string, number>, category, index) => {
      obj[category] = index;
      return obj;
    },
    {},
  );
  const splitData = splitPrompt(`${categoriesObjectRaw}`, 10000);
  // Feed data
  for (let i = 0; i < splitData.length; i++) {
    const chatGPTResponse =
      i === splitData.length - 1
        ? "I have received all parts of the text. You can now start sending shop categories, and I will provide you with the related results."
        : `Part ${i + 1}/${splitData.length} received. Please proceed with the next part.`;
    messages = [
      ...messages,
      {
        role: "user",
        content: splitData[i],
      } as OpenAI.Chat.Completions.ChatCompletionUserMessageParam,
      {
        role: "assistant",
        content: chatGPTResponse,
      } as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam,
    ];
  }

  // Get results
  console.log("Generating result");
  const batchSize = 50;
  const batchPromises = [];
  const results: RelatedCollectionsResult["data"] = [];
  const categoriesObject = Object.keys(categories);

  for (let i = 0; i < categoriesObject.length; i += batchSize) {
    batchPromises.push(async () => {
      const batchCategories = categoriesObject.slice(i, i + batchSize);
      const queries = batchCategories
        .map((category) => `- ${category}`)
        .join("\n");
      const mainQuestion = `What are the related categories for these:
  ${queries}`;
      const previousMessages = i === 0 ? messages : messages.slice(0, -2);
      let batchMessages = [
        ...previousMessages,
        {
          role: "user",
          content: mainQuestion,
        } as OpenAI.Chat.Completions.ChatCompletionUserMessageParam,
      ];
      let resultResp = await callChatGPT(batchMessages);
      if (resultResp) batchMessages.push(resultResp);

      if (
        !resultResp ||
        resultResp?.content === null ||
        !isValidJSON(resultResp?.content || "")
      ) {
        console.error("failed generating for", categoriesObject[i]);
        throw new Error("Failed to generate related collections");
      }

      try {
        console.log(
          "Successfully generated for",
          `${Math.floor(i / batchSize) + 1} / ${Math.ceil(categoriesObject.length / batchSize)}`,
        );
        const cleanedContent = resultResp.content.replace(/\s+/g, " ").trim();
        const jsonResult: RelatedCollectionsResult = JSON.parse(cleanedContent);
        if (jsonResult.data && jsonResult.data.length !== 0) {
          return jsonResult.data;
        }
      } catch (error) {
        console.log("parsing error");
      }

      return [];
    });
  }
  console.log("batchPromises", batchPromises.length);
  const CONCURRENT_CALLS = 13;
  for (let i = 0; i < batchPromises.length; i += CONCURRENT_CALLS) {
    const partialResult = await Promise.all(
      batchPromises.slice(i, i + CONCURRENT_CALLS).map((func) => func()),
    );
    results.push(...partialResult.flat());
    console.log("generated for", results.length);
  }

  return {
    results: transformResultToActualValues(categories, results),
  };
};
