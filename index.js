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

        // Vendor-এর premium status check
        const vendor = await users.findOne(
            { _id: new ObjectId(data.vendorId) },
            { projection: { premium: 1 } }
        );

        if (!vendor) {
            return res.status(404).send({
                success: false,
                message: "Vendor not found!"
            });
        }

        // Vendor-এর active menu count
        const count = await addMenuItem.countDocuments({
            vendorId: data.vendorId,
            isActive: true
        });

        // শুধু Free user-এর জন্য ৩টি menu limit
        if (!vendor.premium && count >= 3) {
            return res.status(403).send({
                success: false,
                limitReached: true,
                message: "Free plan allows only 3 active menu items!"
            });
        }

        // Premium অথবা limit-এর নিচে থাকা Free user
        const result = await addMenuItem.insertOne({
            ...data,
            isActive: true
        });

        return res.status(201).send({
            success: true,
            count: count + 1,
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


app.patch('/menu/availability/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { vendorId, isActive } = req.body;

        // Validation
        if (!vendorId || typeof isActive !== "boolean") {
            return res.status(400).send({
                success: false,
                message: "Invalid request data!"
            });
        }

        if (!ObjectId.isValid(id) || !ObjectId.isValid(vendorId)) {
            return res.status(400).send({
                success: false,
                message: "Invalid ID!"
            });
        }

        const vendor = await users.findOne({
            _id: new ObjectId(vendorId)
        });

        if (!vendor) {
            return res.status(404).send({
                success: false,
                message: "Vendor not found!"
            });
        }

        const menuItem = await addMenuItem.findOne({
            _id: new ObjectId(id),
            vendorId: vendorId
        });

        if (!menuItem) {
            return res.status(404).send({
                success: false,
                message: "Menu item not found!"
            });
        }


        if (menuItem.isActive === isActive) {
            return res.send({
                success: true,
                message: "Availability is already updated!",
                isActive
            });
        }

        const result = await addMenuItem.updateOne(
            {
                _id: new ObjectId(id),
                vendorId: vendorId
            },
            {
                $set: {
                    isActive: isActive
                }
            }
        );

        return res.send({
            success: true,
            message: isActive
                ? "Menu item activated successfully!"
                : "Menu item deactivated successfully!",
            isActive,
            result
        });

    } catch (error) {
        console.error("Availability update error:", error);

        return res.status(500).send({
            success: false,
            message: "Failed to update availability!"
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
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                success: false,
                message: "Invalid vendor ID"
            });
        }

        const vendor = await users.findOne(
            { _id: new ObjectId(id) },
            { projection: { premium: 1 } }
        );

        if (!vendor) {
            return res.status(404).send({
                success: false,
                message: "Vendor not found"
            });
        }

        return res.status(200).send({
            success: true,
            premium: vendor.premium === true
        });

    } catch (error) {
        console.error("Premium check error:", error);

        return res.status(500).send({
            success: false,
            message: "Failed to check premium status"
        });
    }
});

app.get('/vendor-to-customer-order/:vendorId', async (req, res) => {
    const { vendorId } = req.params;
    const result = await order.find({ vendorId: vendorId }).toArray()
    res.send(result)
})


app.patch('/vendor-to-customer-status/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const { status, vendorId } = req.body;

    const allowedStatuses = ["pending", "accepted", "rejected"];

    if (!allowedStatuses.includes(status)) {
        return res.status(400).send({
            success: false,
            message: "Invalid order status",
        });
    }
    if (order.status === "cancelled") {
        return res.status(403).send({
            success: false,
            message: "Customer cancelled this order",
        });
    }


    const result = await order.updateOne({ _id: new ObjectId(orderId), vendorId: vendorId, status: { $ne: "cancelled" }, }, {
        $set: { status: status, updatedAt: new Date(), }
    })
    if (result.modifiedCount === 0) {
        return res.status(400).send({
            success: false,
            message: "Order status was not updated",
        });
    }

    res.send({
        success: true,
        message: "Order status updated successfully",
        status: status,
    });
})

app.get("/vendor-overview/:vendorId", async (req, res) => {
    try {
        const { vendorId } = req.params;

        // Vendor খুঁজে বের করা
        const vendor = await users.findOne({
            _id: new ObjectId(vendorId),
        });

        if (!vendor) {
            return res.status(404).send({
                success: false,
                message: "Vendor not found",
            });
        }

        // মোট menu items
        const totalMenuItems = await addMenuItem.countDocuments({
            vendorId,
        });

        // Active menu items
        const activeItems = await addMenuItem.countDocuments({
            vendorId,
            isActive: true,
        });

        // Pending orders
        const pendingOrders = await order.countDocuments({
            vendorId,
            status: "pending",
        });

        // Accepted orders
        const acceptedOrders = await order.countDocuments({
            vendorId,
            status: "accepted",
        });

        // Free vendor-এর বাকি slot
        const isPremium = vendor.premium === true;
        const freeSlotsLeft = isPremium
            ? null
            : Math.max(0, 3 - activeItems);

        res.send({
            success: true,
            totalMenuItems,
            activeItems,
            pendingOrders,
            acceptedOrders,
            isPremium,
            freeSlotsLeft,
        });

    } catch (error) {
        console.error("Vendor overview error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to load vendor overview",
        });
    }
});


app.get("/customer-order-overview/:customerId", async (req, res) => {
    try {
        const { customerId } = req.params;

        if (!customerId) {
            return res.status(400).send({
                success: false,
                message: "Customer ID is required",
            });
        }

        // Total orders
        const totalOrders = await order.countDocuments({
            customerId,
        });

        // Pending orders
        const pendingOrders = await order.countDocuments({
            customerId,
            status: "pending",
        });

        // Accepted orders
        const acceptedOrders = await order.countDocuments({
            customerId,
            status: "accepted",
        });

        // Rejected and cancelled orders
        const rejectedCancelledOrders = await order.countDocuments({
            customerId,
            status: {
                $in: ["rejected", "cancelled"],
            },
        });

        res.send({
            success: true,
            totalOrders,
            pendingOrders,
            acceptedOrders,
            rejectedCancelledOrders,
        });

    } catch (error) {
        console.error("Customer overview error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to load customer overview",
        });
    }
});


app.get("/admin/users", async (req, res) => {
    try {
        const { search = "", role = "all" } = req.query;

        const query = {};

        if (role !== "all") {
            query.role = role;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }

        const usersList = await users.find(
            query,
            {
                projection: {
                    name: 1,
                    email: 1,
                    image: 1,
                    role: 1,
                    isBlocked: 1,
                    businessName: 1,
                    subscriptionPlan: 1,
                },
            }
        ).toArray();

        res.send({
            success: true,
            users: usersList,
        });

    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to fetch users",
        });
    }
});

app.patch(
    "/admin/users/:id/block",

    async (req, res) => {
        try {
            const { id } = req.params;
            const { isBlocked } = req.body;

            if (!ObjectId.isValid(id)) {
                return res.status(400).send({
                    success: false,
                    message: "Invalid user ID",
                });
            }

            if (typeof isBlocked !== "boolean") {
                return res.status(400).send({
                    success: false,
                    message: "Invalid block status",
                });
            }

            const result = await users.updateOne(
                {
                    _id: new ObjectId(id),
                    role: { $in: ["vendor", "customer"] },
                },
                {
                    $set: { isBlocked },
                }
            );

            if (!result.matchedCount) {
                return res.status(404).send({
                    success: false,
                    message: "User not found",
                });
            }
            if (users.isBlocked === true) {
                return res.status(403).send({
                    success: false,
                    message: "Your account has been blocked by admin.",
                });
            }

            res.send({
                success: true,
                message: isBlocked
                    ? "User blocked successfully"
                    : "User unblocked successfully",
            });

        } catch (error) {
            res.status(500).send({
                success: false,
                message: "Failed to update user status",
            });
        }
    }
);

app.listen(port, () => {
    console.log(`PizzaHub backend On Server ${port}`);
})


