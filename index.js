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
const users = database.collection('user')
const addMenuItem = database.collection('addMenuItem')
const order = database.collection('order')

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
    if (req.query.vendorId) {
        query.vendorId = req.query.vendorId
    }
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

app.get("/brows-menu/:id", async (req, res) => {
    const { id } = req.params;
    const result = await addMenuItem.findOne({ _id: new ObjectId(id) })
    res.send(result)



})

app.patch('/edit-menu/:id', async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const result = await addMenuItem.updateOne({ _id: new ObjectId(id) },
        { $set: data })
    res.send(result)
})



app.patch('/vendor-edit-profile/:id', async (req, res) => {
    const { id } = req.params;
    const { name, image } = req.body;

    const updateData = {};

    if (name) {
        updateData.name = name;
    }

    if (image !== undefined) {
        updateData.image = image;
    }
    const result = await users.updateOne({ _id: new ObjectId(id) }, {
        $set: updateData
    })
    res.send(result)
})

app.delete('/delete-menu/:id', async (req, res) => {
    const { id } = req.params;
    const result = await addMenuItem.deleteOne({ _id: new ObjectId(id) })
    res.send(result)
})


app.post('/order-now', async (req, res) => {
    const data = req.body
    const result = await order.insertOne(data)
    res.send(result)
})

app.get('/order-now/:customerEmail', async (req, res) => {
    const { customerEmail } = req.params;
    const result = await order.find({ customerEmail: customerEmail }).toArray()
    res.send(result)
})




app.listen(port, () => {
    console.log(`PizzaHub backend On Server ${port}`);
})

// http://localhost:5000/add-menu

