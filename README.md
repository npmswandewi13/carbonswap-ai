# 🤖 Swappy AI: Agentic Chatbot API

**Swappy AI** is the intelligent chatbot agent of **CarbonSwap**, designed to deliver real-time insights, carbon market assistance, and project recommendations through natural conversations.

This repository hosts the **Agentic AI Chatbot API** — a LangGraph-powered conversational system that integrates semantic search, vector databases, and Google’s Gemini model to provide context-aware and tool-augmented responses.

Deployed on **Koyeb**, this API powers the **Swappy AI Assistant** within the **CarbonSwap Web Dashboard**.

---

## 🏢 CarbonSwap Overview

### 🌍 Problem Statement
Between **2019 and 2023**, Indonesia's industrial greenhouse gas emissions increased by **16.25%**, while household emissions rose by only **1.29%**.  
CO₂ concentration growth rates globally have tripled since the 1960s — from **0.8 ppm/year** to **2.4 ppm/year (2011–2020)**, hitting a **record 3.5 ppm increase in 2023–2024**.

While Indonesia has massive reforestation potential, companies face key ESG challenges:
1. Difficulty finding credible NGOs.
2. Lack of transparency and real-time monitoring.
3. Complex documentation for ESG compliance.

### 💡 Solution: CarbonSwap Platform
CarbonSwap bridges this gap by providing a **digital marketplace** that connects companies and verified NGOs to make carbon offset transparent, measurable, and secure.

**Key Features**
- ✅ Verified NGO partnerships  
- 🤖 AI insights and recommendations (Swappy AI)  
- 🪪 Verifiable ownership certificates  
- 🏦 Custodian fund flow via bank partners  
- 📈 Real-time project monitoring and ESG certification

**Target Users**
- **Companies:** buyers seeking verified carbon offset projects  
- **NGOs:** sellers offering validated reforestation and conservation projects  

---

## 💬 Swappy AI Overview

### 🤖 What is Swappy AI?
**Swappy AI** acts as a smart conversational layer that enhances CarbonSwap’s marketplace experience. It assists users with:
- Carbon market FAQs and methodology clarifications.  
- ESG and compliance document summaries.  
- Intelligent project search and comparison using vector retrieval.  
- Recommendation of plantation location or carbon offset projects.

---

## 🧠 System Architecture

| Layer | Technology | Description |
|-------|-------------|-------------|
| **Chat Engine** | LangGraph | Orchestrates dialogue state, tool usage, and decision routing |
| **LLM** | Gemini 2.5 Flash (Google Generative AI) | Generates contextual, natural responses |
| **Embeddings** | text-embedding-004 | For vector semantic similarity search |
| **Vector DB** | MongoDB Atlas Vector Search | Stores project and document embeddings |
| **Persistence** | MongoDBSaver (LangGraph) | Maintains conversation threads |
| **Server** | Express.js + TypeScript | REST API endpoints for chat interaction |
| **Deployment** | Koyeb | Serverless deployment for scalable chatbot service |

---

## ⚙️ API Overview

| Endpoint | Method | Description |
|-----------|--------|-------------|
| `/chat` | POST | Starts a new chat session with a message |
| `/chat/:threadId` | POST | Continues a chat using an existing thread |
| `/` | GET | Health check |
| `/download/readme` | GET | Download README (optional feature) |

### Example Request
```bash
POST https://constant-dorolice-carbonswap-de62cba7.koyeb.app/chat/
Content-Type: application/json

{
  "message": "Hi Swappy, recommend a carbon project in Kalimantan."
}
```

### Example Response
```json
{
  "threadId": "17310895012",
  "response": "Here are top Kalimantan projects by carbon sequestration: ..."
}
```

---

## 🧩 Core Components

### `agent.ts`
Implements Swappy’s reasoning flow with LangGraph and LangChain.  
Includes:
- **GoogleGenerativeAIEmbeddings** for vector encoding.  
- **MongoDBAtlasVectorSearch** for semantic search.  
- **ChatGoogleGenerativeAI** for LLM conversation.  
- **ToolNode** for connecting model tool calls with semantic search.  
- **retryWithBackoff()** to handle rate limits gracefully.

### `index.ts`
Handles REST routes and connects to MongoDB Atlas.  
Routes user messages to `callAgent()` function.

---

## 🧪 Example Workflow

1. User asks: “Show me mangrove projects in Bali.”  
2. Swappy classifies this as a *project-specific query* → invokes **vector_search tool**.  
3. MongoDB Vector Search retrieves top results based on embeddings.  
4. Swappy summarizes the projects and recommends next actions (view, compare, contact).

---

## 🧰 Tech Stack

<p align="center">
  <img src="https://skillicons.dev/icons?i=typescript,express,langchain,mongodb,googlecloud,nodejs,git,github" />
</p>

| Category | Tools |
|-----------|--------|
| **AI/LLM** | Google Gemini 2.5 Flash, LangGraph |
| **Backend** | Node.js, Express, TypeScript |
| **Vector DB** | MongoDB Atlas Vector Search |
| **Deployment** | Koyeb |
| **Environment** | dotenv |
| **Validation** | zod |

---

## 🚀 Local Setup

### 1️⃣ Clone the repository
```bash
git clone https://github.com/<your-username>/carbonswap-swappy-ai.git
cd carbonswap-swappy-ai
```

### 2️⃣ Install dependencies
```bash
npm install
```

### 3️⃣ Configure environment variables
Create a `.env` file:
```
GOOGLE_API_KEY=<your-google-api-key>
MONGODB_ATLAS_URI=<your-mongodb-uri>
PORT=8000
```

### 4️⃣ Run development server
```bash
npm run dev
```
Visit: **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## ☁️ Deployment

This service is deployed on **Koyeb** at:
> 🌐 [https://constant-dorolice-carbonswap-de62cba7.koyeb.app/chat/](https://constant-dorolice-carbonswap-de62cba7.koyeb.app/chat/)

---

## 🧠 Example Conversation

**User:** “Hi Swappy, compare carbon sequestration between Sumatra and Kalimantan projects.”  
**Swappy:** “Based on stored data, Kalimantan projects have an average sequestration of 1.3x higher than Sumatra, mainly due to mangrove density and project scale...”

**User:** “Show me the top 3 verified projects.”  
**Swappy:** “Here are the top 3 verified projects by rating and CO₂ capture capacity...”

---

## 🧾 References

1. LangGraph Documentation – [https://docs.langchain.com/langgraph](https://docs.langchain.com/langgraph)  
2. MongoDB Atlas Vector Search – [https://www.mongodb.com/docs/atlas/](https://www.mongodb.com/docs/atlas/)  
3. Google Gemini API – [https://ai.google.dev/](https://ai.google.dev/)  
4. CarbonSwap Whitepaper (internal reference)

---

## 🎯 Vision
> “To empower businesses with AI-driven environmental intelligence — enabling transparent, measurable, and impactful carbon offset actions.”

---

**Developed with 💚 by the CarbonSwap Team**
