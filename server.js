const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./config/db');

const app = express();
const PORT = 3000;

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function toPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

function sendServerError(res, message, error) {
  return res.status(500).json({ message, error: error.message });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Register
app.post('/api/register', async (req, res) => {
  const { name, email, password, phone, address } = req.body;

  if ([name, email, password, phone, address].some(isBlank)) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const [existingUsers] = await db.execute('SELECT user_id FROM users WHERE email = ?', [email]);

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const [insertResult] = await db.execute(
      'INSERT INTO users (name, email, password, phone, address) VALUES (?, ?, ?, ?, ?)',
      [name, email, password, phone, address]
    );

    const userId = insertResult.insertId;
    await db.execute('INSERT INTO cart (user_id) VALUES (?)', [userId]);

    return res.status(201).json({ message: 'Registration successful.', user_id: userId });
  } catch (error) {
    return sendServerError(res, 'Registration failed.', error);
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if ([email, password].some(isBlank)) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const [users] = await db.execute(
      'SELECT user_id, name, email FROM users WHERE email = ? AND password = ?',
      [email, password]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.status(200).json({ message: 'Login successful.', user: users[0] });
  } catch (error) {
    return sendServerError(res, 'Login failed.', error);
  }
});

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const [products] = await db.execute(
      'SELECT product_id, product_name, description, price, stock_quantity, category FROM products ORDER BY product_id DESC'
    );

    return res.status(200).json(products);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch products.', error);
  }
});

// Add product
app.post('/api/products', async (req, res) => {
  const { product_name, description, price, stock_quantity, category } = req.body;
  const parsedPrice = Number(price);
  const parsedStock = Number(stock_quantity);

  const missingText = [product_name, description, category].some(isBlank);
  const invalidNumber = Number.isNaN(parsedPrice) || Number.isNaN(parsedStock);

  if (missingText || invalidNumber) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  if (parsedPrice < 0 || parsedStock < 0) {
    return res.status(400).json({ message: 'Price and stock quantity must be 0 or greater.' });
  }

  try {
    const [insertResult] = await db.execute(
      'INSERT INTO products (product_name, description, price, stock_quantity, category) VALUES (?, ?, ?, ?, ?)',
      [product_name, description, parsedPrice, parsedStock, category]
    );

    return res.status(201).json({
      message: 'Product added successfully.',
      product_id: insertResult.insertId
    });
  } catch (error) {
    return sendServerError(res, 'Failed to add product.', error);
  }
});

// Add product to cart
app.post('/api/cart/add', async (req, res) => {
  const userId = toPositiveInt(req.body.user_id);
  const productId = toPositiveInt(req.body.product_id);
  const quantity = toPositiveInt(req.body.quantity || 1);

  if (!userId || !productId || !quantity) {
    return res.status(400).json({ message: 'user_id, product_id and valid quantity are required.' });
  }

  try {
    const [productRows] = await db.execute(
      'SELECT product_id, stock_quantity FROM products WHERE product_id = ?',
      [productId]
    );

    if (productRows.length === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    if (productRows[0].stock_quantity < quantity) {
      return res.status(400).json({ message: 'Insufficient stock.' });
    }

    const [cartRows] = await db.execute('SELECT cart_id FROM cart WHERE user_id = ?', [userId]);

    let cartId;
    if (cartRows.length === 0) {
      const [insertCart] = await db.execute('INSERT INTO cart (user_id) VALUES (?)', [userId]);
      cartId = insertCart.insertId;
    } else {
      cartId = cartRows[0].cart_id;
    }

    const [existingItems] = await db.execute(
      'SELECT cart_item_id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?',
      [cartId, productId]
    );

    if (existingItems.length > 0) {
      const newQuantity = existingItems[0].quantity + quantity;

      if (productRows[0].stock_quantity < newQuantity) {
        return res.status(400).json({ message: 'Quantity exceeds stock.' });
      }

      await db.execute('UPDATE cart_items SET quantity = ? WHERE cart_item_id = ?', [
        newQuantity,
        existingItems[0].cart_item_id
      ]);
    } else {
      await db.execute('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)', [
        cartId,
        productId,
        quantity
      ]);
    }

    return res.status(200).json({ message: 'Item added to cart.' });
  } catch (error) {
    return sendServerError(res, 'Failed to add to cart.', error);
  }
});

// Get cart by user id
app.get('/api/cart/:user_id', async (req, res) => {
  try {
    const [cartItems] = await db.execute(
      `SELECT
         ci.cart_item_id,
         ci.product_id,
         p.product_name,
         ci.quantity,
         p.price,
         (ci.quantity * p.price) AS line_total
       FROM cart c
       JOIN cart_items ci ON c.cart_id = ci.cart_id
       JOIN products p ON p.product_id = ci.product_id
       WHERE c.user_id = ?
       ORDER BY ci.cart_item_id DESC`,
      [req.params.user_id]
    );

    return res.status(200).json(cartItems);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch cart.', error);
  }
});

// Update quantity of one cart item
app.put('/api/cart/item', async (req, res) => {
  const cartItemId = toPositiveInt(req.body.cart_item_id);
  const quantity = toPositiveInt(req.body.quantity);

  if (!cartItemId || !quantity) {
    return res.status(400).json({ message: 'cart_item_id and valid quantity are required.' });
  }

  try {
    const [items] = await db.execute(
      `SELECT ci.cart_item_id, p.stock_quantity
       FROM cart_items ci
       JOIN products p ON p.product_id = ci.product_id
       WHERE ci.cart_item_id = ?`,
      [cartItemId]
    );

    if (items.length === 0) {
      return res.status(404).json({ message: 'Cart item not found.' });
    }

    if (quantity > items[0].stock_quantity) {
      return res.status(400).json({ message: 'Quantity exceeds stock.' });
    }

    await db.execute('UPDATE cart_items SET quantity = ? WHERE cart_item_id = ?', [quantity, cartItemId]);

    return res.status(200).json({ message: 'Cart item updated.' });
  } catch (error) {
    return sendServerError(res, 'Failed to update cart item.', error);
  }
});

// Remove one cart item
app.delete('/api/cart/item/:cart_item_id', async (req, res) => {
  const cartItemId = toPositiveInt(req.params.cart_item_id);

  if (!cartItemId) {
    return res.status(400).json({ message: 'Valid cart_item_id is required.' });
  }

  try {
    const [result] = await db.execute('DELETE FROM cart_items WHERE cart_item_id = ?', [cartItemId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cart item not found.' });
    }

    return res.status(200).json({ message: 'Cart item removed.' });
  } catch (error) {
    return sendServerError(res, 'Failed to remove cart item.', error);
  }
});

// Place order from cart
app.post('/api/orders', async (req, res) => {
  const userId = toPositiveInt(req.body.user_id);

  if (!userId) {
    return res.status(400).json({ message: 'user_id is required.' });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [cartRows] = await conn.execute('SELECT cart_id FROM cart WHERE user_id = ?', [userId]);

    if (cartRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Cart not found.' });
    }

    const cartId = cartRows[0].cart_id;

    const [items] = await conn.execute(
      `SELECT
         ci.product_id,
         ci.quantity,
         p.price,
         p.stock_quantity
       FROM cart_items ci
       JOIN products p ON p.product_id = ci.product_id
       WHERE ci.cart_id = ?`,
      [cartId]
    );

    if (items.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Cart is empty.' });
    }

    for (const item of items) {
      if (item.quantity > item.stock_quantity) {
        await conn.rollback();
        return res.status(400).json({
          message: `Insufficient stock for product_id ${item.product_id}.`
        });
      }
    }

    const totalAmount = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

    const [orderResult] = await conn.execute(
      'INSERT INTO orders (user_id, total_amount, order_status) VALUES (?, ?, ?)',
      [userId, totalAmount, 'Pending']
    );

    const orderId = orderResult.insertId;

    for (const item of items) {
      await conn.execute(
        'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.price]
      );

      await conn.execute('UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?', [
        item.quantity,
        item.product_id
      ]);
    }

    await conn.execute('INSERT INTO payments (order_id, payment_method, payment_status) VALUES (?, ?, ?)', [
      orderId,
      'demo',
      'completed'
    ]);

    await conn.execute('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);

    await conn.commit();

    return res.status(201).json({
      message: 'Order placed successfully.',
      order_id: orderId,
      total_amount: totalAmount
    });
  } catch (error) {
    await conn.rollback();
    return sendServerError(res, 'Failed to place order.', error);
  } finally {
    conn.release();
  }
});

// Admin: users
app.get('/api/admin/users', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT user_id, name, email, phone, address FROM users ORDER BY user_id DESC'
    );
    return res.status(200).json(rows);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch users.', error);
  }
});

// Admin: products
app.get('/api/admin/products', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT product_id, product_name, description, price, stock_quantity, category FROM products ORDER BY product_id DESC'
    );
    return res.status(200).json(rows);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch products.', error);
  }
});

// Admin: orders
app.get('/api/admin/orders', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT order_id, user_id, total_amount, order_status, order_date FROM orders ORDER BY order_id DESC'
    );
    return res.status(200).json(rows);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch orders.', error);
  }
});

// Admin: carts
app.get('/api/admin/carts', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
         c.cart_id,
         c.user_id,
         ci.cart_item_id,
         ci.product_id,
         ci.quantity,
         p.price
       FROM cart c
       LEFT JOIN cart_items ci ON c.cart_id = ci.cart_id
       LEFT JOIN products p ON p.product_id = ci.product_id
       ORDER BY c.cart_id DESC, ci.cart_item_id DESC`
    );
    return res.status(200).json(rows);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch carts.', error);
  }
});

// Admin: payments
app.get('/api/admin/payments', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT payment_id, order_id, payment_method, payment_status, payment_date FROM payments ORDER BY payment_id DESC'
    );
    return res.status(200).json(rows);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch payments.', error);
  }
});

// Open the login page when the root URL is visited
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
