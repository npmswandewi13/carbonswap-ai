import { MongoClient } from "mongodb";
import "dotenv/config";
/**
 * Main exported function: callAgent
 * - client: connected MongoClient
 * - query: user query string
 * - thread_id: conversation thread id (for persistence)
 */
export declare function callAgent(client: MongoClient, query: string, thread_id: string): Promise<any>;
//# sourceMappingURL=agent.d.ts.map