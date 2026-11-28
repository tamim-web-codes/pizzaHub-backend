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
const sessions = database.collection('session')
const addMenuItem = database.collection('addMenuItem')
const order = database.collection('order')
const payments = database.collection('payments')

app.get('/', (req, res) => {
    res.send({ messge: 'pizzahub connected' })
})

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    console.log(authHeader);
    if (!authHeader) {
        res.status(401).send({ message: 'Unauthorizad' })
        return
    }
    const token = authHeader.split(' ')[1]
    if (!token) {
        res.status(401).send({ message: 'Unauthorizad' })
        return
    }
    const query = { token }
    const session = await sessions.findOne(query)
    if (!session) {
        res.status(401).send({ message: 'Unauthorizad' })
        return
    }
    const userId = session.userId;
    const userQuery = { _id: new ObjectId(userId) }
    const user = await users.findOne(userQuery)
    if (!user) {
        res.status(401).send({ message: 'Unauthorizad' })
        return
    }
    req.user = user
    next()
}

const verifyVendor = async (req, res, next) => {
    if (req.user.role !== 'vendor') {
        res.status(403).send({ message: 'Forbidden' })
        return
    }
    next()
}

const verifyCustomer = async (req, res, next) => {
    if (req.user.role !== 'customer') {
        res.status(403).send({ message: 'Forbidden' })
        return
    }
    next()
}

const verifyAdmin = async (req, res, next) => {
    if (req.user.role !== 'admin') {
        res.status(403).send({ message: 'Forbidden' })
        return
    }
    next()
}


app.post('/add-menu/count', verifyToken, verifyVendor, async (req, res) => {
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
            console.log('premium');
            return res.status(402).send({
                success: false,
                limitReached: true,
                message: "Free plan allows only 3 active menu items!"
            });
        };
        // Premium vendor চাইলে item Premium করতে পারবে
        const isPremiumItem =
            vendor.premium === true && data.isPremiumItem === true;

        // Menu item save
        const result = await addMenuItem.insertOne({
            ...data,
            isPremiumItem,
            isActive: true
        });

        return res.status(201).send({
            success: true,
            count: count + 1,
            message: "Menu item added successfully!",
            result
        });

    } catch (error) {
        console.error("Add Menu Error:", error);

        return res.status(500).send({
            success: false,
            message: "Failed to add menu item!"
        });
    }
});


app.patch('/menu/availability/:id', verifyToken, verifyVendor, async (req, res) => {
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
    try {
        const query = {};
        const { search, category, location, sort, vendorId } = req.query;

        if (vendorId) {
            query.vendorId = vendorId;
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
                $options: "i"
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

        const result = await addMenuItem
            .find(query)
            .sort(sortOption)
            .toArray();

        // Vendor premium status check
        const vendorIds = [...new Set(result.map(item => item.vendorId))];

        const vendors = await users.find(
            {
                _id: {
                    $in: vendorIds.map(id => new ObjectId(id))
                }
            },
            {
                projection: {
                    premium: 1,
                    name: 1,
                    image: 1
                }
            }
        ).toArray();

        const vendorMap = new Map(
            vendors.map(vendor => [
                vendor._id.toString(),
                vendor
            ])
        );

        const menuItems = result.map(item => {
            const vendor = vendorMap.get(item.vendorId?.toString());

            return {
                ...item,

                vendorName: vendor?.name || "Unknown Vendor",
                vendorImage: vendor?.image || "",

                // Vendor subscription status
                isPremiumVendor: vendor?.premium === true,

                // Individual menu item premium status
                isPremiumItem: item.isPremiumItem === true
            };
        });

        res.send(menuItems);

    } catch (error) {
        console.error("My Menu Error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to fetch menu items"
        });
    }
});

app.get("/brows-menu/:id", verifyToken, async (req, res) => {
    const { id } = req.params;
    const result = await addMenuItem.findOne({ _id: new ObjectId(id) })
    res.send(result)



})

app.patch('/edit-menu/:id', verifyToken, verifyVendor, async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const result = await addMenuItem.updateOne({ _id: new ObjectId(id) },
        { $set: data })
    res.send(result)
})



app.patch('/vendor-edit-profile/:id', verifyToken, verifyVendor, async (req, res) => {
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

app.delete('/delete-menu/:id', verifyToken, verifyVendor, async (req, res) => {
    const { id } = req.params;
    const result = await addMenuItem.deleteOne({ _id: new ObjectId(id) })
    res.send(result)
})

app.post('/order-now', verifyToken, verifyCustomer, async (req, res) => {
    const data = req.body
    const result = await order.insertOne(data)
    res.send(result)
})

app.get('/order-now/:customerEmail', verifyToken, verifyCustomer, async (req, res) => {
    const { customerEmail } = req.params;
    const result = await order.find({ customerEmail: customerEmail }).toArray()
    res.send(result)
})

app.patch('/update-customer-profile/:id', verifyToken, verifyCustomer, async (req, res) => {
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

app.patch('/order-canceld/:orderId', verifyToken, verifyCustomer, async (req, res) => {
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


app.post('/payments/checkout-verify', verifyToken, verifyVendor, async (req, res) => {
    const { sessionId } = req.body
    const { status,
        payment_status,
        customer_email,
        amount_total,
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
            amount_total,
            customer_email,
            userId: metadata.userId,
            payment_date: new Date(),
            payment_intent,
        }

        const result = await payments.insertOne(payment)
        const query = { _id: new ObjectId(metadata.userId) }
        console.log(result);
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

app.get('/vendor/:id/premium', verifyToken, verifyVendor, async (req, res) => {
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

app.get('/vendor-to-customer-order/:vendorId', verifyToken, verifyVendor, async (req, res) => {
    const { vendorId } = req.params;
    const result = await order.find({ vendorId: vendorId }).toArray()
    res.send(result)
})


app.patch('/vendor-to-customer-status/:orderId', verifyToken, verifyVendor, async (req, res) => {
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

app.get("/vendor-overview/:vendorId", verifyToken, verifyVendor, async (req, res) => {
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


app.get("/customer-order-overview/:customerId", verifyToken, verifyCustomer, async (req, res) => {
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


app.get("/admin/users", verifyToken, async (req, res) => {
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
                    premium: 1,
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
    "/admin/users/:id/block", verifyToken, verifyAdmin,

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


app.get("/admin/menu-items", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const {
            search = "",
            status = "all",
            category = "all",
        } = req.query;

        // Build MongoDB query
        const query = {};

        // Status filter
        if (status !== "all") {
            query.status = status;
        }

        // Category filter
        if (category !== "all") {
            query.category = category;
        }

        // Search filter
        if (search) {
            query.itemName = {
                $regex: search,
                $options: "i",
            };
        }

        // Fetch menu items
        const menuItems = await addMenuItem
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();

        // Add default values for old menu items
        const formattedMenuItems = menuItems.map((item) => ({
            ...item,
            status: item.status || "pending",
            isActive: item.isActive ?? false,
        }));

        res.status(200).send({
            success: true,
            total: formattedMenuItems.length,
            menuItems: formattedMenuItems,
        });

    } catch (error) {
        console.error("Get Admin Menu Items Error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to fetch menu items",
        });
    }
});


app.patch("/admin/menu-items/:id/status", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatus = [
            "pending",
            "approved",
            "rejected",
            "inactive"
        ];

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                success: false,
                message: "Invalid menu item ID"
            });
        }

        if (!allowedStatus.includes(status)) {
            return res.status(400).send({
                success: false,
                message: "Invalid status"
            });
        }

        const result = await addMenuItem.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status, updatedAt: new Date() } }
        );

        if (!result.matchedCount) {
            return res.status(404).send({
                success: false,
                message: "Menu item not found"
            });
        }

        res.send({
            success: true,
            message: `Menu item status updated to ${status}`
        });

    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to update menu item status"
        });
    }
});


app.delete("/admin/menu-items/:id", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                success: false,
                message: "Invalid menu item ID"
            });
        }

        const result = await addMenuItem.deleteOne({
            _id: new ObjectId(id)
        });

        if (!result.deletedCount) {
            return res.status(404).send({
                success: false,
                message: "Menu item not found"
            });
        }

        res.send({
            success: true,
            message: "Menu item deleted successfully"
        });

    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to delete menu item"
        });
    }
});


app.get("/admin/transactions", async (req, res) => {
    try {
        // Database থেকে সব transaction নিয়ে আসছি
        const allTransactions = await payments
            .find()
            .sort({ payment_date: -1 })
            .toArray();

        // প্রতিটি transaction-এর user information খুঁজছি
        const transactions = await Promise.all(
            allTransactions.map(async (transaction) => {
                const user = await users.findOne(
                    { _id: new ObjectId(transaction.userId) },
                    {
                        projection: {
                            name: 1,
                            email: 1,
                            businessName: 1,
                            image: 1,
                        },
                    }
                );

                return {
                    ...transaction,
                    vendorName: user?.businessName || user?.name || "Unknown Vendor",
                    vendorEmail: user?.email || transaction.customer_email || "N/A",
                };
            })
        );

        res.status(200).send({
            success: true,
            transactions,
        });

    } catch (error) {
        console.error("Admin Transactions Error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to fetch transactions",
        });
    }
});



app.get("/admin/overview", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const [
            totalUsers,
            totalVendors,
            totalCustomers,
            totalPremiumVendors,
            totalMenuItems,
            pendingMenuItems,
            totalTransactions,
        ] = await Promise.all([
            users.countDocuments(),

            users.countDocuments({ role: "vendor" }),

            users.countDocuments({ role: "customer" }),

            // Premium users count
            users.countDocuments({ premium: true }),

            // Total menu items
            addMenuItem.countDocuments(),

            // Pending menu items
            order.countDocuments({ status: "pending" }),

            // Total transactions
            payments.countDocuments(),
        ]);

        res.status(200).send({
            success: true,
            overview: {
                totalUsers,
                totalVendors,
                totalCustomers,
                totalPremiumVendors,
                totalMenuItems,
                pendingMenuItems,
                totalTransactions,
            },
        });
    } catch (error) {
        console.error("Admin Overview Error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to load admin overview",
        });
    }
});

app.get('/featured-menu', async (req, res) => {
    try {
        const featuredItems = await addMenuItem
            .find({
                status: "approved",
                isActive: true,
                isPremiumItem: true
            })
            .sort({ createdAt: -1 })
            .limit(6)
            .toArray();

        // Vendor IDs collect
        const vendorIds = [
            ...new Set(featuredItems.map(item => item.vendorId))
        ];

        // Vendor information fetch
        const vendors = await users.find(
            {
                _id: {
                    $in: vendorIds.map(id => new ObjectId(id))
                }
            },
            {
                projection: {
                    name: 1,
                    image: 1,
                    email: 1,
                    businessName: 1
                }
            }
        ).toArray();

        // Vendor map
        const vendorMap = new Map(
            vendors.map(vendor => [
                vendor._id.toString(),
                vendor
            ])
        );

        // Attach vendor information
        const result = featuredItems.map(item => {
            const vendor = vendorMap.get(
                item.vendorId?.toString()
            );

            return {
                ...item,
                vendorName: vendor?.businessName || vendor?.name || "Unknown Vendor",
                vendorImage: vendor?.image || "",
                vendorEmail: vendor?.email || ""
            };
        });

        res.status(200).send({
            success: true,
            count: result.length,
            result
        });

    } catch (error) {
        console.error("Featured Menu Error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to fetch featured menu items!"
        });
    }
});


app.listen(port, () => {
    console.log(`PizzaHub backend On Server ${port}`);
})


