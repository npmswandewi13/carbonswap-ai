// agent.ts
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder, } from "@langchain/core/prompts";
import { StateGraph } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { z } from "zod";
import "dotenv/config";
/**
 * retry helper for transient errors (rate limits)
 */
async function retryWithBackoff(fn, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            const isRate = err?.status === 429 || err?.code === 429;
            if (isRate && attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
                console.log(`[retry] rate limit, sleeping ${delay}ms (attempt ${attempt})`);
                await new Promise((r) => setTimeout(r, delay));
                continue;
            }
            throw err;
        }
    }
    throw new Error("Max retries exceeded");
}
/**
 * Main exported function: callAgent
 * - client: connected MongoClient
 * - query: user query string
 * - thread_id: conversation thread id (for persistence)
 */
export async function callAgent(client, query, thread_id) {
    try {
        // Validate API key exists
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            throw new Error("GOOGLE_API_KEY environment variable is required");
        }
        const dbName = "inventory_database";
        const db = client.db(dbName);
        const collection = db.collection("items");
        // State schema for LangGraph
        const GraphState = Annotation.Root({
            messages: Annotation({
                reducer: (x, y) => x.concat(y),
            }),
        });
        /**
         * Tool: vector_search (named "vector_search")
         * - Performs semantic search via MongoDB Atlas Vector Search
         * - Normalizes results depending on source
         * - Returns JSON string (easy for agent to consume)
         */
        const vectorSearchTool = tool(async ({ query, n = 6 }) => {
            try {
                console.log(`[vector_search] query="${query}" n=${n}`);
                const total = await collection.countDocuments();
                if (total === 0) {
                    return JSON.stringify({
                        error: "empty_db",
                        message: "No indexed documents found",
                        count: 0,
                    });
                }
                // instantiate embeddings & vector store (matches seed settings)
                const embeddingsClient = new GoogleGenerativeAIEmbeddings({
                    apiKey: apiKey,
                    modelName: "text-embedding-004",
                });
                const vectorStore = new MongoDBAtlasVectorSearch(embeddingsClient, {
                    collection,
                    indexName: "vector_index",
                    textKey: "pageContent",
                    embeddingKey: "embedding",
                });
                // perform similarity search with retry
                const rawResults = await retryWithBackoff(() => vectorStore.similaritySearchWithScore(query, n));
                // Normalize results to array of { id, score, source, summary, metadata }
                const normalized = [];
                for (const r of rawResults) {
                    // FIX: The library returns [doc, score] tuple - use array destructuring
                    const [doc, score] = r;
                    const meta = doc.metadata ?? {};
                    const docAny = doc;
                    const source = meta.source ?? docAny.source ?? "unknown";
                    // create friendly summary depending on source
                    let summary = "";
                    if (source === "dummyProjects" || meta.raw) {
                        // prefer raw structured fields if available
                        const raw = meta.raw ?? doc.metadata?.raw ?? docAny.raw ?? {};
                        const projectName = raw.projectName ??
                            raw.ProjectName ??
                            meta.projectName ??
                            docAny.pageContent?.slice(0, 80);
                        const location = raw.location ?? raw.Location ?? meta.location;
                        const price = raw.price ?? raw.Price;
                        const sequestration = raw.carbonSequestration ??
                            raw.carbonSequestration ??
                            raw.sequestration;
                        const stock = raw.stock ?? raw.Stock;
                        summary = `Project: ${projectName}${location ? ` | Location: ${location}` : ""}${sequestration ? ` | Est. sequestration: ${sequestration}` : ""}${price ? ` | Price: ${price}` : ""}${stock ? ` | Stock: ${stock}` : ""}`;
                    }
                    else if (source === "csv" || meta.row) {
                        const row = meta.row ?? docAny.row ?? {};
                        const nama = row.nama_lokasi ??
                            row.nama_lokasi ??
                            row.name ??
                            doc.pageContent?.slice(0, 80);
                        const luas = row.luas_ha ?? row.luas ?? row.area;
                        const karbon = row.karbon_terserap ?? row.karbon ?? row.carbon;
                        const rating = row.rating_ulasan ?? row.rating;
                        summary = `Location: ${nama}${luas ? ` | Area: ${luas} ha` : ""}${karbon ? ` | Carbon captured: ${karbon}` : ""}${rating ? ` | Rating: ${rating}` : ""}`;
                    }
                    else if (source === "markdown") {
                        // use chunk title / first lines
                        const snippet = (doc.pageContent ?? "")
                            .split("\n")
                            .slice(0, 3)
                            .join(" ")
                            .trim();
                        summary = `Doc: ${snippet}`;
                    }
                    else {
                        summary = (doc.pageContent ?? "").slice(0, 150);
                    }
                    normalized.push({
                        id: doc.metadata?._id ?? docAny._id ?? meta._id,
                        score,
                        source,
                        summary,
                        full: doc,
                    });
                }
                return JSON.stringify({
                    results: normalized,
                    searchType: "vector",
                    query,
                    count: normalized.length,
                });
            }
            catch (err) {
                console.error("[vector_search] error:", err);
                return JSON.stringify({
                    error: "search_error",
                    details: err?.message ?? String(err),
                    query,
                });
            }
        }, {
            name: "vector_search",
            description: "Performs semantic search over carbon projects, locations, and documentation. Use when user asks about specific projects, locations, sequestration numbers, price/stock, or asks 'show me' type queries.",
            schema: z.object({
                query: z
                    .string()
                    .describe("Search query (project name, location, metric, etc.)"),
                n: z.number().optional().default(6).describe("Max results to return"),
            }),
        });
        const tools = [vectorSearchTool];
        const toolNode = new ToolNode(tools);
        // Initialize the chat model and bind tools
        const model = new ChatGoogleGenerativeAI({
            model: "gemini-2.5-flash",
            temperature: 0,
            maxRetries: 0,
            apiKey: apiKey,
        }).bindTools(tools);
        // Decision engine: LangGraph will route to tools when model issues tool_calls
        function shouldContinue(state) {
            const msgs = state.messages || [];
            const last = msgs[msgs.length - 1];
            if (!last)
                return "__end__";
            if (last.tool_calls && last.tool_calls.length)
                return "tools";
            return "__end__";
        }
        // Model call: system prompt instructs Swappy behaviour and when to use tool
        async function callModel(state) {
            return retryWithBackoff(async () => {
                const prompt = ChatPromptTemplate.fromMessages([
                    [
                        "system",
                        `You are Swappy — a helpful Carbon Offset Chatbot Agent integrated into CarbonSwap (an ecommerce marketplace for carbon projects).

Your capabilities: 
- Answer general or carbon questions directly (like greetings, market, methodology, compliance basics, or unrelated topics). 
- You have access to the tool "vector_search", use this tool ONLY when the user requests project-specific, location-specific, numeric metrics, or asks to "show", "list", "recommend", "compare", or requests details about a named project or location. 
- Swappy can also retrieve and cite content from documentation that exists in the database, including: 
  - "CarbonSwap" overview pages (site / product marketplace descriptions), and 
  - "Carbon & Project Compliance" documents (legal, regulatory, and operational rules). 
  Use those documents to: provide authoritative explanations of marketplace features, quote or paraphrase compliance rules, and advise on required steps or references for due diligence. 

- Before calling the tool, ask clarifying questions if the user's request lacks necessary filters (e.g., region, min sequestration, price range). 
- After receiving tool results: summarize the top matches (project name or location), show key metadata (sequestration (tCO₂/plot if < 500, KgCO₂Seq if < 500) / price in US dollar per plot/ stock if available / area per plot in hectare(ha)), and suggest next steps (view project page, contact seller, ask detail information). 
- If the tool returns no results, acknowledge this and offer to help in other ways like offer high-level guidance or expand search criteria. 
- When you use content from the CarbonSwap or Compliance docs, explicitly label quoted/paraphrased material and mention the source (e.g., "According to CarbonSwap overview..." or "Per Carbon & Project Compliance: ..."). 
- When in doubt, decide intelligently whether a search is truly needed. When producing final responses, keep them concise, actionable, and clearly label whether results came from search or general knowledge.

---
Current time: {time}`,
                    ],
                    new MessagesPlaceholder("messages"),
                ]);
                const formatted = await prompt.formatMessages({
                    time: new Date().toISOString(),
                    messages: state.messages,
                });
                const result = await model.invoke(formatted);
                return { messages: [result] };
            });
        }
        // Build workflow graph
        const workflow = new StateGraph(GraphState)
            .addNode("agent", callModel)
            .addNode("tools", toolNode)
            .addEdge("__start__", "agent")
            .addConditionalEdges("agent", shouldContinue)
            .addEdge("tools", "agent");
        // persistence of conversation
        const checkpointer = new MongoDBSaver({ client, dbName });
        const app = workflow.compile({ checkpointer });
        // invoke workflow with user's message
        const finalState = await app.invoke({ messages: [new HumanMessage(query)] }, { recursionLimit: 12, configurable: { thread_id } });
        const lastMsg = finalState.messages[finalState.messages.length - 1];
        const response = (lastMsg && lastMsg.content) || "";
        console.log("[Swappy] response:", response);
        return response;
    }
    catch (err) {
        console.error("[callAgent] error:", err);
        if (err?.status === 429)
            throw new Error("Rate limited; try again later.");
        if (err?.status === 401)
            throw new Error("Authentication error; check API key.");
        throw new Error(`Agent error: ${err?.message ?? String(err)}`);
    }
}
//# sourceMappingURL=agent.js.map