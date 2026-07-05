# MYNTRA-CLONE-
# 🛍️ E-Commerce Application

> A full-stack production-ready Myntra Clone built using **Expo React Native**, **Node.js**, **Express.js**, and **MongoDB Atlas**, implementing enterprise-grade architecture, scalable backend services, real-time notifications, personalized recommendations, concurrency-safe cart management, and secure transaction processing.

---

## 📌 Project Overview

This project was developed as part of the **Elevance Skills Internship Program**.

The application is designed following modern software engineering practices with a focus on:

- Scalable Architecture
- High Performance
- Secure APIs
- Production Deployment
- Clean Code Principles
- Enterprise-Level Features

---

# 🚀 Features

## ✅ User Authentication

- User Registration
- User Login
- Secure Authentication
- Persistent User Sessions

---

## 🛒 Shopping

- Browse Products
- Product Details
- Categories
- Wishlist
- Shopping Cart
- Checkout

---

# 📌 Internship Tasks Implemented

## ✅ Task 1 – Transaction History with Audit & Export

Features:

- My Transactions Page
- Server-side Pagination
- Server-side Filtering
- Server-side Sorting
- Transaction Audit Logs
- Idempotent Payment Webhooks
- Streaming CSV Export
- Secure PDF Receipt Generation
- Unique Invoice Numbers

---

## ✅ Task 2 – Scalable Theme & Dark Mode

Features:

- Centralized Theme Architecture
- System Theme Detection
- Manual Theme Switching
- AsyncStorage Persistence
- Dark Mode
- Light Mode
- Extensible Theme System
- Accessibility-Compliant Colors

---

## ✅ Task 3 – Event-Driven Push Notification System

Features:

- Expo Push Notifications
- Secure Device Registration
- Real-Time Notifications
- Scheduled Notifications
- Background Queue
- Retry Mechanism
- Exponential Backoff
- Rate Limiting
- Notification Analytics
- Invalid Token Cleanup
- Foreground Handling
- Background Handling
- Terminated State Handling

---

## ✅ Task 4 – Concurrency-Safe Cart

Features:

- Active Cart
- Save For Later
- Multi-device Synchronization
- Optimistic Locking
- MongoDB Transactions
- Stock Validation
- Price Change Detection
- Discontinued Product Handling
- Conflict Resolution
- Live Cart Totals

---

## ✅ Task 5 – Scalable Personalization Engine

Features:

- "You May Also Like"
- Similar Products
- Category Similarity
- Wishlist Overlap
- Browsing History
- Product Popularity
- Cold Start Handling
- Server-side View History
- Last 50 Unique Views
- Automatic TTL Cleanup
- Optimized Recommendation Queries
- Recommendation Analytics

---

# 🏗️ Technology Stack

## Frontend

- Expo React Native
- TypeScript
- Expo Router
- AsyncStorage

## Backend

- Node.js
- Express.js
- MongoDB Atlas
- Mongoose

## Notifications

- Expo Notifications
- Expo Push Service

## Deployment

- Vercel (Frontend)
- Render (Backend)

## Version Control

- Git
- GitHub

---

# 📂 Project Structure

```
myntra-clone/
│
├── backend/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── scripts/
│   ├── tests/
│   └── server.js
│
├── myntra/
│   ├── app/
│   ├── components/
│   ├── context/
│   ├── hooks/
│   ├── utils/
│   └── assets/
│
└── README.md
```

---

# 🗄️ Database Collections

- Users
- Products
- Categories
- Orders
- Wishlist
- Cart
- CartAudit
- Transactions
- TransactionAudit
- DeviceToken
- Notification
- NotificationJob
- UserViewHistory
- RecommendationAnalytics

---

# ⚡ API Modules

- Authentication
- Products
- Categories
- Wishlist
- Cart
- Orders
- Transactions
- Notifications
- Recommendations

---

# 🔔 System Highlights

- RESTful API Architecture
- MongoDB Index Optimization
- Atomic Database Transactions
- Optimistic Locking
- Queue-based Notification Processing
- Event-driven Architecture
- Recommendation Engine
- Production-ready Folder Structure

---

# 🧪 Testing

Implemented:

- Unit Testing
- Integration Testing
- API Testing
- Queue Testing
- Notification Testing
- Cart Testing
- Recommendation Testing
- Performance Verification

---

# 🌐 Deployment

## Frontend

Hosted on **Vercel**

## Backend

Hosted on **Render**

## Database

MongoDB Atlas

---

# ⚙️ Installation

## Clone Repository

```bash
git clone https://github.com/devaraj24dr/MYNTRA-CLONE-PRODUCTION-LEVEL.git
```

---

## Backend

```bash
cd backend

npm install

npm run dev
```

---

## Frontend

```bash
cd myntra

npm install

npm start
```

---

# 🔑 Environment Variables

Backend `.env`

```env
MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_secret

PORT=5000

ALLOWED_ORIGINS=*

EXPO_PROJECT_ID=your_expo_project_id
```

Frontend `.env`

```env
EXPO_PUBLIC_API_URL=https://your-backend-url.onrender.com
```

---

# 📈 Performance

- Optimized MongoDB Indexes
- Efficient Aggregation Pipelines
- Cursor-based Streaming
- Low Memory CSV Export
- Recommendation Engine Optimized for Fast Response Times
- Background Queue Processing
- Retry Mechanisms
- Scalable Architecture

---

# 🔒 Security

- Environment Variables
- Secure Authentication
- Idempotent Payment Handling
- Input Validation
- Notification Rate Limiting
- Secure Device Registration
- MongoDB Transactions
- Optimistic Locking

---

# 📚 Future Enhancements

- Payment Gateway Integration
- AI Search
- Voice Shopping
- Multi-language Support
- Admin Dashboard
- Analytics Dashboard
- Real-time Inventory Management

---

# 👨‍💻 Developer

**Devaraj P**

B.Tech – Artificial Intelligence & Data Science

Velammal Institute of Technology

GitHub:
https://github.com/devaraj24dr

---

# 📄 License

This project was developed for educational and internship purposes.

---

⭐ If you found this project useful, consider giving it a star on GitHub.
