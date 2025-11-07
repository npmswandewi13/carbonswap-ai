import 'dotenv/config'
import express from "express";
import type { Request, Response, Express } from "express";
import { MongoClient } from 'mongodb'
import { callAgent } from './agent.ts'

const app: Express = express()

import cors from 'cors'
app.use(cors())
app.use(express.json())

async function startServer() {
    // validate required envs at startup (fail fast)
    const uri = process.env.MONGODB_ATLAS_URI;
    if (!uri) {
        console.error('Missing MONGODB_ATLAS_URI environment variable')
        process.exit(1)
    }

    const client = new MongoClient(uri)

    try {
        await client.connect()
        await client.db('admin').command({ ping: 1 })
        console.log('Connected to MongoDB Atlas')

        app.get('/', (req: Request, res: Response) => {
            res.send('LangGraph Agent Server is running')
        })

        app.post('/chat', async (req: Request, res: Response) => {
            const initialMessage = req.body.message
            const threadId = Date.now().toString()
            try {
                const response = await callAgent(client, initialMessage, threadId)
                res.json({ threadId, response })
            } catch (error: any) {
                console.error('Error starting chat request:', error.message)
                res.status(500).json({ error: error.message || 'Internal Server Error' })
            }
        })

        app.post('/chat/:threadId', async (req: Request, res: Response) => {
            const { threadId } = req.params
            const { message } = req.body
            try {
                const response = await callAgent(client, message, threadId)
                res.json({ response })
            } catch (error: any) {
                console.error('Error processing chat request:', error.message)
                res.status(500).json({ error: 'Internal Server Error' })
            }
        })
        const PORT = process.env.PORT || 8000
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`)
        })

    } catch (error: any) {
        console.error('Failed to connect to MongoDB Atlas:', error.message)
        process.exit(1)
    }
}

startServer()