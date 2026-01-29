# Messy Project

This is a sample project designed to test DocuMate's documentation analysis capabilities.

## Documentation Issues

This project intentionally includes various documentation problems:

### Auth Module (`src/auth/user-service.ts`)
- ✅ `createUser` - Well documented
- ❌ `authenticateUser` - **Missing docs** for critical public method
- ❌ `generateSessionToken` - Private method, no docs
- ⚠️ `deleteUser` - **Outdated example** (API changed, removed second parameter)
- ❌ `updateUserProfile` - Complex method, **no documentation**

### Utils Module (`src/utils/crypto.ts`)
- ❌ **Completely undocumented** - 4 exported functions with no JSDoc

### Utils Module (`src/utils/validators.ts`)
- ✅ `isValidEmail` - Documented
- ❌ `isValidPassword` - No docs
- ❌ `validateOrderInput` - Complex validation, **no docs**
- ❌ `sanitizeHtml` - No docs

### API Module (`src/api/order-controller.ts`)
- ⚠️ `createOrder` - **Outdated example** showing old request format
- ❌ `getOrder` - Missing docs
- ❌ `updateOrderStatus` - Missing docs
- ✅ `listOrders` - Documented

### API Module (`src/api/order-service.ts`)
- ❌ **All methods undocumented** - 4 public methods

### Database Module (`src/database/user-repository.ts`)
- ✅ `create` - Well documented with example
- ❌ `findByEmail` - Frequently used, **no docs**
- ❌ Other methods - Missing docs

## Expected DocuMate Results

- **Coverage**: ~20-25% (only 4-5 out of 25+ functions documented)
- **Health Score**: Low (30-40 range)
- **Critical Issues**: Public methods like `authenticateUser`, `validateOrderInput`
- **High Priority**: Complex methods with many parameters
- **Drift**: Outdated examples in `createOrder` and `deleteUser`

## Usage

Run DocuMate commands to analyze this project:

```bash
# Scan the project
documate scan messy-project/src

# Check documentation health
documate health

# Find documentation drift
documate drift

# Interactive fix session
documate fix -i

# Generate docs for specific file
documate generate messy-project/src/utils/crypto.ts -i
```
