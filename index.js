import "dotenv/config";
import express from "express";
import { MongoClient } from "mongodb";
import { callAgent } from "./agent.js";
const app = express();
import cors from "cors";
app.use(cors());
app.use(express.json());
// Ensure the environment variable is set
const mongoUri = process.env.MONGODB_ATLAS_URI;
if (!mongoUri) {
    throw new Error("MONGODB_ATLAS_URI environment variable is not defined.");
}
const client = new MongoClient(mongoUri);
async function startServer() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Connected to MongoDB Atlas");
        app.get("/", (req, res) => {
            res.send("LangGraph Agent Server is running");
        });
        app.post("/chat", async (req, res) => {
            const initialMessage = req.body.message;
            const threadId = Date.now().toString();
            try {
                const response = await callAgent(client, initialMessage, threadId);
                res.json({ threadId, response });
            }
            catch (error) {
                console.error("Error starting chat request:", error.message);
                res
                    .status(500)
                    .json({ error: error.message || "Internal Server Error" });
            }
        });
        app.post("/chat/:threadId", async (req, res) => {
            const { threadId } = req.params;
            const { message } = req.body;
            try {
                const response = await callAgent(client, message, threadId);
                res.json({ response });
            }
            catch (error) {
                console.error("Error processing chat request:", error.message);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });
        const PORT = process.env.PORT || 8000;
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error("Failed to connect to MongoDB Atlas:", error.message);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=index.js.map