const API_BASE = '/api';

function setMessage(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? 'crimson' : 'green';
}

function getCurrentUser() {
  const userRaw = localStorage.getItem('currentUser');
  if (!userRaw) return null;

  try {
    return JSON.parse(userRaw);
  } catch (error) {
    localStorage.removeItem('currentUser');
    return null;
  }
}

function formatMoney(value) {
  return Number(value).toFixed(2);
}

async function readResponseData(response) {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
}

async function requestJson(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const data = await readResponseData(response);
    return { ok: response.ok, data };
  } catch (error) {
    return {
      ok: false,
      data: { message: 'Server not reachable. Please start backend server.' }
    };
  }
}

function requireLogin() {
  const currentPath = window.location.pathname;
  const publicPages = ['/login.html', '/signup.html', '/'];

  if (!publicPages.includes(currentPath) && !getCurrentUser()) {
    window.location.href = 'login.html';
  }
}

function attachLogout() {
  const logoutButton = document.getElementById('logoutBtn');
  if (!logoutButton) return;

  logoutButton.addEventListener('click', (event) => {
    event.preventDefault();
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  });
}

async function registerUser(event) {
  event.preventDefault();
  const form = event.target;

  const payload = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    password: form.password.value,
    phone: form.phone.value.trim(),
    address: form.address.value.trim()
  };

  const result = await requestJson(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    setMessage('signupMessage', result.data.message || 'Registration failed.', true);
    return;
  }

  setMessage('signupMessage', 'Registration successful. Redirecting to login...');
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 900);
}

async function loginUser(event) {
  event.preventDefault();
  const form = event.target;

  const payload = {
    email: form.email.value.trim(),
    password: form.password.value
  };

  const result = await requestJson(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    setMessage('loginMessage', result.data.message || 'Login failed.', true);
    return;
  }

  localStorage.setItem('currentUser', JSON.stringify(result.data.user));
  window.location.href = 'home.html';
}

// load products and render on home page, also attach add to cart functionality
async function loadProducts() {
  const productsContainer = document.getElementById('productsContainer');
  if (!productsContainer) return;

  const result = await requestJson(`${API_BASE}/products`);
  if (!result.ok) {
    setMessage('homeMessage', 'Failed to load products.', true);
    return;
  }

  productsContainer.innerHTML = '';

  result.data.forEach((product) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <h3>${product.product_name}</h3>
      <p>${product.description}</p>
      <p><strong>Price:</strong> ${formatMoney(product.price)}</p>
      <p><strong>Category:</strong> ${product.category}</p>
      <p><strong>Stock:</strong> ${product.stock_quantity}</p>
      <button>Add to Cart</button>
    `;

    const addToCartButton = card.querySelector('button');
    addToCartButton.addEventListener('click', async () => {
      const user = getCurrentUser();
      if (!user) {
        setMessage('homeMessage', 'Please login first.', true);
        return;
      }

      const addResult = await requestJson(`${API_BASE}/cart/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          product_id: product.product_id,
          quantity: 1
        })
      });

      setMessage('homeMessage', addResult.data.message || 'Could not add item.', !addResult.ok);
    });

    productsContainer.appendChild(card);
  });
}

async function addProduct(event) {
  event.preventDefault();
  const form = event.target;
  const user = getCurrentUser();

  if (!user) {
    setMessage('addProductMessage', 'Please login first.', true);
    return;
  }

  const payload = {
    product_name: form.product_name.value.trim(),
    description: form.description.value.trim(),
    price: Number(form.price.value),
    stock_quantity: Number(form.stock_quantity.value),
    category: form.category.value.trim()
  };

  const result = await requestJson(`${API_BASE}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  setMessage('addProductMessage', result.data.message || 'Could not add product.', !result.ok);

  if (result.ok) {
    form.reset();
  }
}

async function updateCartItem(cartItemId, quantity) {
  return requestJson(`${API_BASE}/cart/item`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cart_item_id: cartItemId, quantity })
  });
}

async function removeCartItem(cartItemId) {
  return requestJson(`${API_BASE}/cart/item/${cartItemId}`, {
    method: 'DELETE'
  });
}

async function loadCart() {
  const cartContainer = document.getElementById('cartContainer');
  if (!cartContainer) return;

  const user = getCurrentUser();
  if (!user) {
    setMessage('cartMessage', 'Please login first.', true);
    return;
  }

  const result = await requestJson(`${API_BASE}/cart/${user.user_id}`);
  if (!result.ok) {
    setMessage('cartMessage', 'Failed to fetch cart.', true);
    return;
  }

  const cartItems = result.data;

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    cartContainer.innerHTML = '<div class="card">Cart is empty.</div>';
    return;
  }

  cartContainer.innerHTML = '';
  let totalAmount = 0;

  cartItems.forEach((item) => {
    totalAmount += Number(item.line_total);

    const row = document.createElement('div');
    row.className = 'card';
    row.innerHTML = `
      <h3>${item.product_name}</h3>
      <p>Price: ${formatMoney(item.price)}</p>
      <p>
        Quantity:
        <input type="number" min="1" value="${item.quantity}" id="qty-${item.cart_item_id}" />
      </p>
      <div class="row">
        <button class="secondary" id="update-${item.cart_item_id}">Update Quantity</button>
        <button id="remove-${item.cart_item_id}">Remove</button>
      </div>
    `;

    const quantityInput = row.querySelector(`#qty-${item.cart_item_id}`);
    const updateButton = row.querySelector(`#update-${item.cart_item_id}`);
    const removeButton = row.querySelector(`#remove-${item.cart_item_id}`);

    updateButton.addEventListener('click', async () => {
      const newQuantity = Number(quantityInput.value);
      const updateResult = await updateCartItem(item.cart_item_id, newQuantity);

      setMessage('cartMessage', updateResult.data.message || 'Could not update item.', !updateResult.ok);
      if (updateResult.ok) {
        loadCart();
      }
    });

    removeButton.addEventListener('click', async () => {
      const removeResult = await removeCartItem(item.cart_item_id);

      setMessage('cartMessage', removeResult.data.message || 'Could not remove item.', !removeResult.ok);
      if (removeResult.ok) {
        loadCart();
      }
    });

    cartContainer.appendChild(row);
  });

  const totalCard = document.createElement('div');
  totalCard.className = 'card';
  totalCard.innerHTML = `<strong>Total: ${formatMoney(totalAmount)}</strong>`;
  cartContainer.appendChild(totalCard);
}

async function placeOrder() {
  const user = getCurrentUser();
  if (!user) {
    setMessage('cartMessage', 'Please login first.', true);
    return;
  }

  const result = await requestJson(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: user.user_id })
  });

  setMessage('cartMessage', result.data.message || 'Could not place order.', !result.ok);

  if (result.ok) {
    loadCart();
  }
}

function renderTable(tableId, rows) {
  const table = document.getElementById(tableId);
  if (!table) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    table.innerHTML = '<tr><td>No data</td></tr>';
    return;
  }

  const headers = Object.keys(rows[0]);
  const headerHtml = `<tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>`;
  const rowsHtml = rows
    .map((row) => `<tr>${headers.map((header) => `<td>${row[header] ?? ''}</td>`).join('')}</tr>`)
    .join('');

  table.innerHTML = headerHtml + rowsHtml;
}

async function loadAdminData() {
  if (!document.getElementById('usersTable')) return;

  const endpoints = [
    { tableId: 'usersTable', path: '/admin/users' },
    { tableId: 'productsTable', path: '/admin/products' },
    { tableId: 'ordersTable', path: '/admin/orders' },
    { tableId: 'cartsTable', path: '/admin/carts' },
    { tableId: 'paymentsTable', path: '/admin/payments' }
  ];

  try {
    const results = await Promise.all(
      endpoints.map((item) => requestJson(`${API_BASE}${item.path}`))
    );

    endpoints.forEach((endpoint, index) => {
      const result = results[index];
      renderTable(endpoint.tableId, result.ok ? result.data : []);
    });
  } catch (error) {
    setMessage('adminMessage', 'Failed to load admin data.', true);
  }
}

function setupPage() {
  requireLogin();
  attachLogout();

  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', registerUser);
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', loginUser);
  }

  const addProductForm = document.getElementById('addProductForm');
  if (addProductForm) {
    addProductForm.addEventListener('submit', addProduct);
  }

  const placeOrderButton = document.getElementById('placeOrderBtn');
  if (placeOrderButton) {
    placeOrderButton.addEventListener('click', placeOrder);
  }

  loadProducts();
  loadCart();
  loadAdminData();
}

document.addEventListener('DOMContentLoaded', setupPage);
