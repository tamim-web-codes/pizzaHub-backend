import express from 'express'
import cors from 'cors'
import 'dotenv/config'
const app = express()

app.use(express.json())
app.use(cors())

const port = 5000;

import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
    try {
        await client.connect();
        console.log("You successfully connected to MongoDB!");
        return client;
    } catch (err) {
        console.dir(err);
    }
}
const connectMongoClient = await connectToMongoDB()
const database = connectMongoClient.db('pizzahub')
const addMenuItem = database.collection('addMenuItem')

app.get('/', (req, res) => {
    res.send({ messge: 'pizzahub connected' })
})

app.post('/add-menu', async (req, res) => {
    const data = req.body;
    const result = await addMenuItem.insertOne(data)
    res.send(result)
})

app.listen(port, () => {
    console.log(`PizzaHub backend On Server ${port}`);
})

// http://localhost:5000/add-menu

