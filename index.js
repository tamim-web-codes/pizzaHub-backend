import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
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
const payments = database.collection('payments')

app.get('/', (req, res) => {
    res.send({ messge: 'pizzahub connected' })
})



app.post('/add-menu/count', async (req, res) => {
    try {
        const data = req.body;

        const count = await addMenuItem.countDocuments({
            vendorId: data.vendorId,
            isActive: true
        });

        // আগে থেকেই ৩টি থাকলে নতুন data insert হবে না
        if (count >= 3) {
            return res.status(403).send({
                success: false,
                limitReached: true,
                message: "Free plan allows only 3 active menu items!"
            });
        }

        const result = await addMenuItem.insertOne({
            ...data,
            isActive: true
        });

        const updatedCount = count + 1;

        return res.status(201).send({
            success: true,
            count: updatedCount,
            message: "Menu item added successfully!",
            result
        });

    } catch (error) {
        console.error(error);

        return res.status(500).send({
            success: false,
            message: "Failed to add menu item!"
        });
    }
});
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

app.patch('/update-customer-profile/:id', async (req, res) => {
    const { id } = req.params;
    const { name, image } = req.body
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


app.patch('/order-canceld/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        const result = await order.updateOne(
            {
                _id: new ObjectId(orderId),
                status: 'pending'
            },
            {
                $set: { status: 'cancelled' }
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(400).send({
                success: false,
                message: "Order not found or already cancelled!"
            });
        }

        return res.status(200).send({
            success: true,
            message: "Order cancelled successfully!"
        });

    } catch (error) {
        console.error("Cancel order error:", error);

        return res.status(500).send({
            success: false,
            message: "Failed to cancel order!"
        });
    }
});


app.post('/payments/checkout-verify', async (req, res) => {
    const { sessionId } = req.body
    const { status,
        payment_status,
        customer_email,
        metadata,
        payment_intent, } = await stripe.checkout.sessions.retrieve(sessionId)
    if (status === 'complete' && payment_status === 'paid') {
        const sessionQuery = { sessionId }
        const existingPayment = await payments.findOne(sessionQuery)
        if (existingPayment) {
            return res.send({ success: false, message: 'Payment alredy verified' })
        }

        const payment = {
            sessionId,
            status,
            payment_status,
            customer_email,
            userId: metadata.userId,
            payment_date: new Date(),
            payment_intent,
        }

        const result = await payments.insertOne(payment)
        const query = { _id: new ObjectId(metadata.userId) }

        const updatedDoc = {
            $set: {
                premium: true,
            }
        }
        const updateResult = await users.updateOne(query, updatedDoc)

        res.send({ success: true, result, updateResult })

    }
    res.send({ success: false, message: 'Payment verification failed' })
})

app.get('/vendor/:id/premium', async (req, res) => {
    const { id } = req.params;
    const result = await users.findOne({ _id: new ObjectId(id) }, { projection: { premium: 1 } })
    res.send(result)
})

app.listen(port, () => {
    console.log(`PizzaHub backend On Server ${port}`);
})


