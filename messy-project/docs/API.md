# API Documentation

This document describes the API endpoints for the messy project.

## Authentication

All endpoints require authentication using JWT tokens.

### Login

Login to get an access token.

```typescript
const response = await login(username, password);
```

## User Management

### Get User

Retrieve user information using `getUserById()` function.

```typescript
const user = await getUserById(123);
```

### Create User

Create a new user with the `createUser()` method from UserService class.

## Order Management

Process orders using the `OrderService` class and its `processOrder()` method.

Example:

```typescript
const service = new OrderService();
await service.processOrder(orderData);
```

## Validation

Use `isValidEmail()` to validate email addresses before processing.
