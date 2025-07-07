# 📝 NoteTaking Backend

This is the backend API for the NoteTaking web application built with Node.js, Express, TypeScript, and MongoDB. It handles authentication, note management, image uploads, and supports lazy deletion of unused images using Cloudinary.

---

## 🚀 Live URL

- API Base URL: [https://notetaking-backend-ogwv.onrender.com](https://notetaking-backend-ogwv.onrender.com)

---

## 📦 Tech Stack

- Node.js
- Express
- TypeScript
- MongoDB + Mongoose
- JWT Authentication
- Cloudinary (for image uploads)
- Jest + Supertest (for testing)
- Docker & GitHub Actions (for CI/CD)


## 🛠️ Environment Variables

Create a .env file in the root directory with the following variables:
PORT=5000
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_jwt_secret
CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

## Run Locally with Docker
docker-compose up --build
## Run Tests with Docker
docker-compose -f docker-compose.test.yml up --build

## Run Tests in local environment
npm run test
Uses:
Jest for testing
Supertest for endpoint testing
Mocks Cloudinary and JWT where needed


## Features
User Signup/Login with JWT
Secure note creation, update, delete
Cloudinary image uploads via TinyMCE
Lazy image cleanup with PendingDeletion collection
Full API test coverage using Docker
