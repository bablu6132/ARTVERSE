# ArtVerse Simple Web App

ArtVerse is a simple full-stack demo app for product listing, cart management, checkout, and admin table views.

## Tech Stack

- Node.js
- Express
- MySQL using `mysql2/promise`
- HTML, CSS, Vanilla JavaScript

## Project Structure

```text
project/
  config/
    db.js
  public/
    add_product.html
    admin.html
    cart.html
    home.html
    login.html
    signup.html
    script.js
    styles.css
  package.json
  package-lock.json
  README.md
  schema.sql
  server.js
```

## Features

- User registration and login
- Product listing and add-product form
- Add to cart, update quantity, remove cart item
- Place order from cart with stock checks and transaction
- Admin views for users, products, carts, orders, and payments

## Database Setup

`schema.sql` creates database `artverse` and all required tables:

- `Users`
- `Products`
- `Cart`
- `Cart_Items`
- `Orders`
- `Order_Items`
- `Payments`

Run `schema.sql` using any MySQL client (MySQL Workbench, phpMyAdmin, or CLI).

If `mysql` command is not available in terminal, use MySQL Workbench and execute the file directly.

## Sample Products SQL

Use this after schema setup to load demo products:

```sql
INSERT INTO Products (product_name, description, price, stock_quantity, category)
VALUES
  ('Canvas Sunset', 'Hand-painted sunset artwork on premium canvas.', 1499.00, 12, 'Wall Art'),
  ('Marble Bust Mini', 'Small decorative sculpture inspired by classical forms.', 899.00, 20, 'Sculpture'),
  ('Modern Wave Print', 'Abstract wave print for contemporary interiors.', 699.00, 30, 'Prints'),
  ('Golden Leaf Frame', 'Framed botanical art with textured gold accents.', 1199.00, 15, 'Framed Art'),
  ('Terracotta Vase Set', 'Set of 2 handmade terracotta accent vases.', 999.00, 18, 'Decor'),
  ('Monochrome Cityscape', 'Black-and-white cityscape painting with bold contrast.', 1599.00, 10, 'Wall Art'),
  ('Studio Sketch Collection', 'Pack of 5 minimalist sketch prints.', 549.00, 40, 'Prints'),
  ('Ceramic Table Idol', 'Handcrafted ceramic tabletop figurine.', 799.00, 22, 'Decor');
```

Verify:

```sql
SELECT product_id, product_name, price, stock_quantity, category
FROM Products
ORDER BY product_id DESC;
```

## Configuration

Update database connection values in `config/db.js`:

- `host`
- `user`
- `password`
- `database`

## Run Locally

1. Open terminal in project folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run `schema.sql` in your MySQL server.
4. Optional: run the sample products SQL above.
5. Start server:
   ```bash
   npm start
   ```
6. Open:
   `http://localhost:3000/`

Development mode:

```bash
npm run dev
```

## Routes

Pages:

- `/login.html`
- `/signup.html`
- `/home.html`
- `/cart.html`
- `/add_product.html`
- `/admin.html`

Root `/` redirects to `/login.html`.

API:

- `POST /api/register`
- `POST /api/login`
- `GET /api/products`
- `POST /api/products`
- `POST /api/cart/add`
- `GET /api/cart/:user_id`
- `PUT /api/cart/item`
- `DELETE /api/cart/item/:cart_item_id`
- `POST /api/orders`
- `GET /api/admin/users`
- `GET /api/admin/products`
- `GET /api/admin/orders`
- `GET /api/admin/carts`
- `GET /api/admin/payments`

## Notes

- SQL queries are parameterized with `db.execute`.
- Order placement uses transaction + rollback on failure.
- Passwords are currently plain text in this demo and should be hashed (for example with `bcrypt`) for production use.
- Payment row creation in order flow is currently demo behavior.
