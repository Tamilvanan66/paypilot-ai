# PayPilot AI

A full-stack starter for an AI-powered commerce and payment assistant.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB (Mongoose)
- Payments: PayPal REST API Sandbox
- AI: OpenAI-compatible Chat Completions API (optional)

## Requirements
- Node.js 20+
- MongoDB running locally or a MongoDB Atlas connection string
- PayPal Developer Sandbox app credentials (optional until testing checkout)
- AI API key (optional; assistant falls back to a helpful demo response)

## Setup

### 1. Backend
```bash
cd server
cp .env.example .env
# Edit .env and add your values
npm install
npm run dev
```

### 2. Frontend
Open another terminal:
```bash
cd client
cp .env.example .env
npm install
npm run dev
```
Open the Vite URL shown in the terminal (normally http://localhost:5173).

## Environment variables

`server/.env`:
- `PORT`: API port (default 5000)
- `MONGODB_URI`: MongoDB connection string
- `CLIENT_URL`: frontend origin
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`: Sandbox credentials
- `PAYPAL_BASE_URL`: keep `https://api-m.sandbox.paypal.com` for development
- `AI_API_KEY`: optional model provider key
- `AI_BASE_URL`: optional OpenAI-compatible API base URL
- `AI_MODEL`: model name supported by your provider

`client/.env`:
- `VITE_API_URL`: backend URL, default `http://localhost:5000`

## PayPal safety notes
- This starter uses PayPal Sandbox by default.
- The backend calculates the order amount from product records. Never trust a price sent by the browser.
- The backend captures and verifies the PayPal order before marking an order paid.
- Never put PayPal secrets or AI API keys in frontend environment variables.
- Do not use real payment credentials while learning/testing.

## API
- `GET /api/health`
- `GET /api/products`
- `POST /api/products`
- `GET /api/orders`
- `POST /api/paypal/create-order`
- `POST /api/paypal/capture-order`
- `POST /api/ai/chat`
- `GET /api/analytics`

This is a learning starter, not a production-ready store. Before public launch, add authentication/authorization, rate limiting, input validation, CSRF strategy where applicable, logging, tests, privacy disclosures, and deployment hardening.
