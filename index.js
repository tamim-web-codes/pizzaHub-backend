import express from 'express'
import cors from 'cors'
import 'dotenv/config'
const app = express()

app.use(express.json())
app.use(cors())

const port = 5000;

import { MongoClient, ObjectId } from 'mongodb';

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

app.get('/my-menu', async (req, res) => {

    const query = {}
    const { search, category, location, sort } = req.query;
    if (search) {
        query.$or = [
            { itemName: { $regex: search, $options: "i" } },
            { category: { $regex: search, $options: "i" } },
            { location: { $regex: search, $options: "i" } },
        ];
    }
    if (category) {
        query.category = {
            $regex: `^${category}$`,
            $options: 'i'
        };
    }
    if (location) {
        query.location = {
            $regex: `^${location}$`,
            $options: "i",
        };
    }
    let sortOption = {};

    if (sort === "low-to-high") {
        sortOption = { price: 1 };
    } else if (sort === "high-to-low") {
        sortOption = { price: -1 };
    }
    const result = await addMenuItem.find(query).sort(sortOption).toArray()
    res.send(result)
})

app.patch('/edit-menu/:id', async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const result = await addMenuItem.updateOne({ _id: new ObjectId(id) },
        { $set: data })
    res.send(result)
})


app.listen(port, () => {
    console.log(`PizzaHub backend On Server ${port}`);
})

// http://localhost:5000/add-menu

