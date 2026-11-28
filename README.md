# PizzaHub Backend

Backend API for **PizzaHub — Pizza Ordering & Delivery Platform**. This server handles authentication-related verification, role-based authorization, menu management, order management, vendor subscriptions, and payment-related operations.

## Features

- Express.js REST API
- MongoDB database integration
- Better Auth session-based user verification
- Role-based access control for Customer, Vendor, and Admin
- Menu item creation and management
- Free and Premium vendor menu limits
- Customer order management
- Vendor order management
- Stripe Checkout integration for Vendor Premium subscriptions
- Payment verification and transaction management
- Environment-based configuration
- API error handling

## Technology Stack

- Node.js
- Express.js
- MongoDB
- Better Auth
- Stripe
- dotenv
- CORS

> Add or remove packages according to the actual backend `package.json`.

## Project Structure

```text
pizzaHub-backend/
│
├── index.js
├── package.json
├── package-lock.json
├── .env
├── .gitignore
│
└── README.md
```

> Update this structure if your actual backend has additional folders or files.

## Installation

### 1. Clone the Repository

```bash
git clone YOUR_BACKEND_GITHUB_REPOSITORY_URL
```

### 2. Navigate to the Project Directory

```bash
cd pizzaHub-backend
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory.

Add the environment variables used by your backend:

```env
PORT=5000

MONGODB_URI=your_mongodb_connection_string

DB_NAME=pizzahub

BETTER_AUTH_SECRET=your_better_auth_secret

STRIPE_SECRET_KEY=your_stripe_secret_key

STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

> Add Google OAuth or other variables only if they are actually configured in your backend. Never commit your `.env` file or expose secret keys.

### 5. Run the Server

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

> Make sure these scripts exist in your `package.json`. Update the commands if your scripts use different names.

## Database Collections

PizzaHub uses MongoDB with the following business collections:

| Collection | Purpose |
|---|---|
| `user` | User information and roles |
| `addMenuItem` | Restaurant menu items |
| `order` | Customer orders |
| `payments` | Vendor subscription transactions |

Better Auth manages its own authentication-related collections.

## Authentication & Authorization

PizzaHub uses Better Auth for authentication.

The backend verifies the user's session and retrieves the associated user information before allowing access to protected APIs.

### Middleware

- `verifyToken`: Checks the authorization token/session and identifies the authenticated user.
- `verifyVendor`: Allows access only to authenticated users with the Vendor role.

Protected APIs should verify the user's role and resource ownership on the server.

### Role-Based Access

| Role | Access |
|---|---|
| Customer | Customer-related protected features |
| Vendor | Menu management, customer orders, subscription management |
| Admin | User management, menu approval, transaction management |

## Menu Management

- Vendors can create, update, and delete their own menu items.
- Newly created menu items require Admin approval.
- Only approved and active menu items should appear on the public menu.
- Free vendors can have up to 3 active menu items.
- Premium vendors can publish unlimited active menu items.

The backend checks the vendor's Premium status and active menu item count before allowing a new menu item.

## Order Management

- Customers can place orders for available menu items.
- New orders have a Pending status.
- Vendors can accept or reject their own customer orders.
- Customers can cancel only Pending orders.
- Users must not modify orders belonging to other users.

## Stripe Subscription

Stripe is used only for Vendor Premium subscriptions.

Payment flow:

1. Vendor requests a Premium subscription.
2. Backend creates a Stripe Checkout Session.
3. Vendor completes payment through Stripe Checkout.
4. Stripe sends a webhook event to the backend.
5. Backend verifies the webhook signature.
6. After successful verification, the vendor's Premium status is updated and the transaction is saved.

Customer pizza ordering does not require Stripe payment integration.

## API Documentation

Add your actual API endpoints here.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/featured-menu` | Retrieve featured menu items |
| POST | `/add-menu/count` | Check vendor limit and add a menu item |
| GET | `/vendor-to-customer-order/:vendorId` | Retrieve vendor customer orders |
| POST | YOUR_CHECKOUT_ENDPOINT | Create a Premium Checkout Session |
| POST | `/payments/checkout-verify` | Verify checkout/payment information |

> Confirm each endpoint against your actual Express server before publishing this documentation.

## Error Handling

The API should return appropriate HTTP status codes:

| Status | Meaning |
|---|---|
| 200 | Request successful |
| 201 | Resource created |
| 400 | Invalid request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Resource not found |
| 500 | Internal server error |

## Security

- Keep database credentials and secret keys in environment variables.
- Never push `.env` files to GitHub.
- Verify authenticated users on protected APIs.
- Verify roles on the server.
- Check resource ownership before modifying or deleting records.
- Verify Stripe webhook signatures before activating Premium subscriptions.
- Never trust frontend role or payment status values.

## Related Repository

**Frontend Repository:** YOUR_FRONTEND_GITHUB_REPOSITORY_URL

**Backend Repository:** YOUR_BACKEND_GITHUB_REPOSITORY_URL

**Live Website:** YOUR_LIVE_WEBSITE_URL

---

Developed as part of the **PizzaHub — Pizza Ordering & Delivery Platform** project.