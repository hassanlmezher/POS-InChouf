# API reference

Base path: `/api`. JSON requests must use `Content-Type: application/json`. Mutations require an `Origin` equal to the request origin. Use the HttpOnly session cookie from login. Never send a tenant ID. Validation rejects unknown fields on mutation payloads. Monetary values are integer USD cents.

| Method     | Path                                        | Authorization / purpose                                                               |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| GET        | `/health`                                   | Database connectivity; no business data                                               |
| POST       | `/bootstrap`                                | One-time secret header; creates Supabase Auth users and profiles in an empty database |
| POST       | `/login`                                    | Supabase Auth email/password verification, rate limited                               |
| POST       | `/logout`                                   | Revoke current user's sessions                                                        |
| GET        | `/me`                                       | Active session and membership                                                         |
| POST       | `/password`                                 | Verify and change the Supabase Auth password, then revoke sessions                    |
| GET        | `/admin/tenants`                            | Super Admin metadata, counts, platform events                                         |
| POST       | `/admin/tenants`                            | Create tenant and owner atomically                                                    |
| PATCH      | `/admin/tenants/:id`                        | Manually set subscription and activation                                              |
| POST       | `/admin/tenants/:id/reset`                  | Reset owner password and revoke sessions                                              |
| GET        | `/store/:slug`                              | Active public catalog, settings and delivery zones                                    |
| POST       | `/store/:slug/orders`                       | Anonymous validated/rate-limited checkout                                             |
| GET        | `/store/:slug/track/:token`                 | Limited order view and proof history                                                  |
| POST       | `/store/:slug/track/:token/files`           | Raw binary upload tied to this order                                                  |
| GET        | `/store/:slug/track/:token/files/:fileId`   | Authorized order file                                                                 |
| POST       | `/store/:slug/track/:token/proofs/:proofId` | Approve or request changes on latest pending proof                                    |
| GET, POST  | `/orders`                                   | Authorized list or manual checkout                                                    |
| GET, PATCH | `/orders/:id`                               | Assignment-aware detail and versioned update                                          |
| POST       | `/orders/:id/tracking`                      | Rotate/revoke customer capability                                                     |
| GET, POST  | `/orders/:id/files`                         | List/upload order files                                                               |
| POST       | `/orders/:id/proofs`                        | Add next proof version; locked after approval                                         |
| GET        | `/waiting-proofs`                           | Assignment-aware work queue                                                           |
| GET, POST  | `/products`                                 | Product permission; list/create                                                       |
| PATCH      | `/products/:id`                             | Product permission; update                                                            |
| GET        | `/catalog`                                  | Catalog for authorized manual orders                                                  |
| GET, POST  | `/zones`                                    | Delivery read; owner create                                                           |
| PATCH      | `/zones/:id`                                | Owner zone update                                                                     |
| GET, POST  | `/team`                                     | Authorized assignment list; owner create staff                                        |
| PATCH      | `/team/:id`                                 | Owner change role/deactivate                                                          |
| GET        | `/employees`                                | Owner list including inactive employees                                               |
| PATCH      | `/settings`                                 | Owner branding/contact/category/payment/theme config                                  |
| GET        | `/customers`                                | Customer permission; grouped order history                                            |
| GET        | `/audit`                                    | Owner audit history                                                                   |
| POST       | `/files`                                    | Product-image upload                                                                  |
| GET        | `/files/:id`                                | Member-authorized private file                                                        |
| GET        | `/images/:id`                               | Image assigned to an active public catalog item                                       |

## Checkout payload

```json
{
  "customer": "Customer name",
  "phone": "Phone number",
  "email": "",
  "address": "Full delivery address",
  "zoneId": "ID from the active store catalog",
  "notes": "",
  "paymentMethod": "Cash on delivery",
  "idempotency": "client-generated UUID",
  "items": [
    {
      "productId": "catalog product ID",
      "quantity": 1,
      "variant": "",
      "custom": {}
    }
  ]
}
```

A successful response contains `id`, `reference`, `total`, and `trackingUrl`. Save the tracking URL immediately. Duplicate idempotency submissions return 409 rather than reserving inventory twice. The existing private token is intentionally not recoverable from its database hash.

Order updates contain the last fetched `version` and only changed fields: `status`, `payment`, `employeeId`, `driverId`, `deliveryStatus`, `cashCollected`, `reason`, `note`. The server checks transitions, roles, assignments and version conflicts. File upload bodies are raw bytes with `X-File-Name`; they are not multipart forms.

Errors: 400 validation; 401 sign-in required; 403 permission/origin/suspension; 404 inaccessible record; 409 stale version, inventory, proof or uniqueness conflict; 413 oversized upload; 429 rate limit; 500 sanitized unexpected failure. No CORS wildcard is enabled.
