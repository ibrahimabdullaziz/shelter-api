# Shelter

A custom Express + TypeScript backend for a short-term rental platform.

This project is a practical learning backend for accommodation bookings, user authentication, unit management, booking lifecycles, OTP email flows, and Cloudinary image uploads. It is not a NestJS project; it is a manually structured Express API built on Prisma and PostgreSQL.

## Overview

Shelter exposes a REST API for:

- user registration and login
- JWT access and refresh authentication
- OTP-based email verification and password reset flows
- country, city, currency, and category catalog access
- unit creation, activation, soft delete, and listing
- Cloudinary-backed photo uploads
- guest booking creation and updates
- host booking confirmation and rejection
- unit favorites and reviews
- role-based access protection

## Tech Stack

- Node.js
- TypeScript
- Express
- Prisma ORM
- PostgreSQL
- JWT authentication
- Zod validation
- Cloudinary
- Nodemailer (SMTP)
- Pino logging
- Mocha + Chai + Sinon + Supertest

## Current Production Hardening Status

The backend includes the following security protections:

- Helmet security headers
- CORS configuration
- JSON request size limiting
- request ID generation and structured logging
- redaction of sensitive values in logs
- safe production error handling
- auth and authorization failure logging
- OTP generation with secure randomness
- OTP attempt limits and atomic verification
- non-enumerating password reset behavior
- checks for deleted and inactive units
- validated image signatures before uploads
- role-based route protection

## Project Structure

```text
backend/
??? prisma/
?   ??? migrations/
?   ??? schema.prisma
?   ??? seed-admin.ts
?   ??? seed.ts
??? src/
?   ??? app.ts
?   ??? server.ts
?   ??? common/
?   ?   ??? middleware/
?   ?   ?   ??? authGuard.ts
?   ?   ?   ??? errorHandler.ts
?   ?   ?   ??? roleGuard.ts
?   ?   ?   ??? upload.ts
?   ?   ?   ??? validate.ts
?   ?   ??? types/
?   ?   ?   ??? express.d.ts
?   ?   ??? utils/
?   ?       ??? ApiError.ts
?   ?       ??? asyncHandler.ts
?   ?       ??? jwt.ts
?   ??? config/
?   ?   ??? cloudinary.ts
?   ?   ??? env.ts
?   ?   ??? logger.ts
?   ?   ??? metrics.ts
?   ?   ??? swagger.ts
?   ??? db/
?   ?   ??? prisma.ts
?   ??? modules/
?       ??? auth/
?       ??? bookings/
?       ??? categories/
?       ??? cities/
?       ??? countries/
?       ??? currencies/
?       ??? mail/
?       ??? otp/
?       ??? unit-favorites/
?       ??? unit-photos/
?       ??? unit-reviews/
?       ??? units/
?       ??? users/
??? test/
?   ??? e2e/
?   ??? integration/
?   ??? unit/
??? .mocharc.json
??? .nycrc.json
??? package.json
??? prisma.config.ts
??? tsconfig.json
??? README.md
??? ...
```

## Prerequisites

Before running the project, make sure you have:

- Node.js 20 or newer
- PostgreSQL available
- a configured `.env` file
- a Cloudinary account
- SMTP credentials for email delivery

## Environment Variables

Create a `.env` file in the `backend` folder:

```env
NODE_ENV=development
PORT=3000

DATABASE_URL="postgresql://username:password@localhost:5432/shelter"

JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"

SYSTEM_ADMIN_EMAIL="admin@example.com"
SYSTEM_ADMIN_PASSWORD="admin-password"

CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

MAIL_USER="your-email@example.com"
MAIL_PASSWORD="your-email-app-password"
MAIL_FROM="your-email@example.com"
MAIL_HOST="smtp.gmail.com"
MAIL_PORT="587"
MAIL_SECURE="false"

CORS_ORIGINS="https://your-frontend.com,https://admin.example.com"
```

Production note:

- `JWT_REFRESH_SECRET` is required in production mode.
- `CORS_ORIGINS` is required in production mode.
- the app exits on startup if required variables are missing.

## Install Dependencies

```bash
npm install
```

## Database Setup

Generate the Prisma client and apply migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

For local development with schema changes:

```bash
npx prisma migrate dev
```

If you want to seed the admin user:

```bash
npx tsx prisma/seed-admin.ts
```

## Run the App

Development:

```bash
npm run dev
```

Production build:

```bash
npm run build
```

Production start:

```bash
npm start
```

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
```

## API Routes

The app exposes endpoints under `/api`, including:

- `/api/auth`
- `/api/countries`
- `/api/cities`
- `/api/currencies`
- `/api/unit-categories`
- `/api/units`
- `/api/bookings`
- `/api/favorites`

## Testing

The project includes unit, integration, and end-to-end tests.

Run all tests:

```bash
npm test
```

Run unit tests only:

```bash
npm run test:unit
```

Run integration tests only:

```bash
npm run test:integration
```

Run e2e tests only:

```bash
npm run test:e2e
```

Coverage:

```bash
npm run test:coverage
npm run test:coverage:critical
```

## Production Deployment Checklist

Before deploying this backend to production, confirm the following:

1. `NODE_ENV=production` is set.
2. `DATABASE_URL` points to the production PostgreSQL instance.
3. `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are strong secrets.
4. `CORS_ORIGINS` contains only trusted frontend origins.
5. `MAIL_USER` and `MAIL_PASSWORD` are valid SMTP credentials. For Gmail, create an App Password and use `smtp.gmail.com` on port `587` with `MAIL_SECURE=false`.
6. `CLOUDINARY_*` values are valid production credentials.
7. `npx prisma migrate deploy` has been run against the target database.
8. `npm run build` passes successfully.
9. the server is started with `npm start` or a process manager like PM2 or systemd.
10. HTTPS is enabled in front of the backend.
11. debug or test routes remain disabled in production.
12. logs do not contain passwords, tokens, or OTP codes.

## Note on Runtime Deployment

This project is designed to run directly as a Node.js production service rather than through Docker. The verified runtime path is:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
npm start
```

## Notes

This backend is intended as a functional Express API and a practical backend-learning project. It is also ready to be extended for stronger scaling, deployment management, and additional production hardening.

## License

This project is for learning and personal use.
