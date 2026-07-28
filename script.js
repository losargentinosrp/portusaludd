const STORAGE_KEY = "viandas-state-v2";
const BACKUP_KEY = "viandas-state-v2-backup";
const SESSION_KEY = "viandas-state-v2-session";
const DEFAULT_OWNER_EMAIL = "mateomiranda314@gmail.com";

const roleBar = document.getElementById("roleBar");
const roleSelect = document.getElementById("roleSelect");
const adminBtn = document.getElementById("adminBtn");
const createCategoryBtn = document.getElementById("createCategoryBtn");
const createPublicationBtn = document.getElementById("createPublicationBtn");
const categoryRow = document.getElementById("categoryRow");
const productsGrid = document.getElementById("products");
const searchInput = document.getElementById("searchInput");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalActions = document.getElementById("modalActions");

const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("viandas-channel")
    : null;

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  databaseURL: "https://TU_PROYECTO-default-rtdb.firebaseio.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

let firebaseDb = null;

const defaultState = {
  role: "Propietario",
  selectedCategory: null,
  categories: ["Desayunos", "Almuerzos", "Meriendas", "Ensaladas"],
  products: [
    {
      id: 101,
      name: "Ensalada light",
      description: "Ensalada fresca con pollo, verduras y aderezo light.",
      value: "$1.800",
      category: "Ensaladas",
      image:
        "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80",
      visible: true
    },
    {
      id: 102,
      name: "Vianda de arroz y carne",
      description: "Arroz, carne hervida, vegetales y salsa casera.",
      value: "$2.400",
      category: "Almuerzos",
      image:
        "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80",
      visible: true
    },
    {
      id: 103,
      name: "Muffin de avena",
      description: "Postre saludable con avena, banana y canela.",
      value: "$900",
      category: "Meriendas",
      image:
        "https://images.unsplash.com/photo-1483695028939-5bb13f8648b0?auto=format&fit=crop&w=800&q=80",
      visible: true
    }
  ],
  pedidos: 0,
  pedidosSemana: 0,
  propietarios: [DEFAULT_OWNER_EMAIL]
};

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJSON(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function isOwnerSession() {
  return (
    state.role === "Propietario" ||
    state.propietarios.includes(DEFAULT_OWNER_EMAIL)
  );
}

function loadState() {
  const primary = parseJSON(localStorage.getItem(STORAGE_KEY));
  const backup = parseJSON(localStorage.getItem(BACKUP_KEY));
  const session = parseJSON(sessionStorage.getItem(SESSION_KEY));
  const source = primary || backup || session || defaultState;

  return {
    ...defaultState,
    ...source,
    selectedCategory:
      source.selectedCategory !== undefined
        ? source.selectedCategory
        : defaultState.selectedCategory,
    categories: Array.isArray(source.categories)
      ? source.categories
      : defaultState.categories,
    products: Array.isArray(source.products) ? source.products : defaultState.products,
    propietarios: Array.isArray(source.propietarios)
      ? source.propietarios
      : defaultState.propietarios
  };
}

function saveState() {
  const payload = JSON.stringify(state);
  localStorage.setItem(STORAGE_KEY, payload);
  localStorage.setItem(BACKUP_KEY, payload);
  sessionStorage.setItem(SESSION_KEY, payload);

  if (channel) {
    channel.postMessage({ type: "state-update", state });
  }

  syncToRealtime();
}

function hydrateFromRemote(remoteState) {
  state = { ...defaultState, ...remoteState };
  renderAll();
}

function initRealtimeSync() {
  if (!window.firebase || !firebaseConfig.databaseURL || firebaseConfig.databaseURL.includes("TU_PROYECTO")) {
    return;
  }

  try {
    firebase.initializeApp(firebaseConfig);
    firebaseDb = firebase.database();

    firebaseDb.ref("viandasState").on("value", (snapshot) => {
      const remoteState = snapshot.val();
      if (remoteState) {
        state = { ...defaultState, ...remoteState };
        renderAll();
      }
    });
  } catch (error) {
    console.warn("Firebase no inicializado:", error);
  }
}

function syncToRealtime() {
  if (!firebaseDb) return;
  firebaseDb.ref("viandasState").set(state);
}

let state = loadState();

function renderAll() {
  roleSelect.value = state.role || "Visitante";
  renderRoleControls();
  renderCategories();
  renderProducts();
}

function renderRoleControls() {
  const ownerSession = isOwnerSession();
  roleBar.classList.toggle("hidden", !ownerSession);
  adminBtn.classList.toggle("hidden", !ownerSession);
  createCategoryBtn.classList.toggle("hidden", !ownerSession);
  createPublicationBtn.classList.toggle("hidden", !ownerSession);
}

function renderCategories() {
  categoryRow.innerHTML = "";

  state.categories.forEach((cat) => {
    const pill = document.createElement("button");
    pill.className = "category-pill";
    if (state.selectedCategory === cat) {
      pill.classList.add("active");
    }
    pill.textContent = cat;
    pill.addEventListener("click", () => {
      state.selectedCategory =
        state.selectedCategory === cat ? null : cat;
      saveState();
      renderCategories();
      renderProducts();
    });
    categoryRow.appendChild(pill);
  });
}

function matchesSearch(product, query) {
  if (!query) return true;

  const normalizedQuery = normalizeText(query);
  const searchableText = normalizeText(
    [product.name, product.description, product.value, product.category]
      .join(" ")
  );
  const queryTerms = normalizedQuery.split(" ").filter(Boolean);

  if (!queryTerms.length) return true;

  return queryTerms.every((term) => searchableText.includes(term));
}

function renderProducts() {
  const query = searchInput.value.trim();
  const ownerSession = isOwnerSession();

  const visibleProducts = state.products.filter((product) => {
    if (ownerSession) return true;
    return product.visible !== false;
  });

  const categoryFiltered = state.selectedCategory
    ? visibleProducts.filter(
        (product) =>
          normalizeText(product.category || "") ===
          normalizeText(state.selectedCategory)
      )
    : visibleProducts;

  const filtered = categoryFiltered.filter((product) => matchesSearch(product, query));

  productsGrid.innerHTML = "";

  if (!filtered.length) {
    productsGrid.innerHTML =
      '<p style="grid-column: 1 / -1; text-align: center; color: #6b7280;">No se encontraron publicaciones.</p>';
    return;
  }

  filtered.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      ${
        ownerSession
          ? `<button class="owner-menu-btn" data-menu-trigger="${product.id}">⋯</button>
          <div class="owner-menu" id="menu-${product.id}">
            <button data-action="delete" data-id="${product.id}">Eliminar</button>
            <button data-action="hide" data-id="${product.id}">Invisible</button>
            <button data-action="show" data-id="${product.id}">Visible</button>
            <button data-action="edit" data-id="${product.id}">Editar</button>
          </div>`
          : ""
      }
      <img src="${product.image || "https://via.placeholder.com/400x240?text=Producto"}" alt="${product.name}" />
      <div class="product-body">
        <div class="product-name">${product.name}</div>
        <div class="product-desc">${product.description}</div>
        <div class="product-desc" style="margin-top: 6px; font-size: 13px; color: #2e8b57;">
          Categoría: ${product.category || "Sin categoría"}
        </div>
        ${
          ownerSession && product.visible === false
            ? '<div class="product-hidden-badge">Solo visible para propietarios</div>'
            : ""
        }
        <div class="product-footer">
          <div class="quantity-wrap">
            <label for="qty-${product.id}">Cant.</label>
            <select id="qty-${product.id}">
              ${Array.from({ length: 50 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("")}
            </select>
          </div>
          <button class="btn" data-buy="${product.id}">Comprar por ${product.value}</button>
        </div>
      </div>`;
    productsGrid.appendChild(card);
  });
}

function showModal(title, bodyHtml, actionsHtml) {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;
  modalActions.innerHTML = actionsHtml;
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  modalBody.innerHTML = "";
  modalActions.innerHTML = "";
}

function openAdminPanel() {
  const ownersHtml = state.propietarios
    .map((email) => `<div class="field"><strong>${email}</strong></div>`)
    .join("");

  const html = `
    <div class="field">
      <strong>Propietarios</strong>
      <div>${ownersHtml || "No hay propietarios."}</div>
    </div>
  `;

  const actions = `
    <button class="btn" id="addOwnerBtn">Añadir propietario</button>
    <button class="btn ghost" id="cancelAdminBtn">Cerrar</button>
  `;

  showModal("Panel Administrativo", html, actions);
  document.getElementById("addOwnerBtn").addEventListener("click", openAddOwnerModal);
  document.getElementById("cancelAdminBtn").addEventListener("click", closeModal);
}

function buildMailtoUrl(email) {
  const subject = encodeURIComponent("Rol de propietario asignado");
  const body = encodeURIComponent(
    `Hola,\n\nSe te ha asignado el rol de propietario en la página web Por Tu Salud.\n\nAccedé aquí: https://tu-sitio.com\n\nSaludos.\n`
  );

  return `mailto:${email}?subject=${subject}&body=${body}`;
}

function openAddOwnerModal() {
  const html = `
    <div class="field">
      <label for="ownerEmail">Gmail del nuevo propietario</label>
      <input id="ownerEmail" type="email" placeholder="nombre@gmail.com" />
    </div>
  `;

  const actions = `
    <button class="btn" id="saveOwnerBtn">Guardar</button>
    <button class="btn ghost" id="cancelOwnerBtn">Cancelar</button>
  `;

  showModal("Añadir propietario", html, actions);

  document.getElementById("saveOwnerBtn").addEventListener("click", () => {
    const email = document.getElementById("ownerEmail").value.trim();

    if (!email) {
      alert("Ingresá un Gmail válido");
      return;
    }

    if (!state.propietarios.includes(email)) {
      state.propietarios.push(email);
    }

    saveState();

    try {
      window.open(buildMailtoUrl(email), "_blank", "noopener,noreferrer");
    } catch (error) {
      window.location.href = buildMailtoUrl(email);
    }

    closeModal();
  });

  document.getElementById("cancelOwnerBtn").addEventListener("click", closeModal);
}

function openCreateCategoryModal() {
  const html = `
    <div class="field">
      <label for="categoryName">Nombre de la categoría</label>
      <input id="categoryName" type="text" placeholder="Ej: Postres" />
    </div>
  `;

  const actions = `
    <button class="btn" id="createCategorySubmit">Crear</button>
    <button class="btn ghost" id="cancelCreateCategory">Cancelar</button>
  `;

  showModal("Crear categoría", html, actions);

  document.getElementById("createCategorySubmit").addEventListener("click", () => {
    const name = document.getElementById("categoryName").value.trim();
    if (!name) {
      alert("Ingresá un nombre para la categoría");
      return;
    }

    if (!state.categories.includes(name)) {
      state.categories.push(name);
    }

    saveState();
    renderCategories();
    closeModal();
  });

  document.getElementById("cancelCreateCategory").addEventListener("click", closeModal);
}

function openCreatePublicationModal() {
  const html = `
    <div class="field">
      <label for="productImage">Foto</label>
      <input id="productImage" type="file" accept="image/*" />
    </div>
    <div class="field">
      <label for="productName">Nombre del producto</label>
      <input id="productName" type="text" placeholder="Ej: Ensalada light" />
    </div>
    <div class="field">
      <label for="productDescription">Descripción</label>
      <textarea id="productDescription" placeholder="Detalles del producto"></textarea>
    </div>
    <div class="field">
      <label for="productValue">Valor</label>
      <input id="productValue" type="number" min="0" step="1" placeholder="1000" />
    </div>
    <div class="field">
      <label for="productCategory">Categoría</label>
      <select id="productCategory">
        ${state.categories
          .map((category) => `<option value="${category}">${category}</option>`)
          .join("")}
      </select>
    </div>
    <div id="imagePreview" class="field"></div>
  `;

  const actions = `
    <button class="btn" id="createPublicationSubmit">Crear</button>
    <button class="btn ghost" id="cancelCreatePublication">Cancelar</button>
  `;

  showModal("Crear publicación", html, actions);

  const preview = document.getElementById("imagePreview");

  document.getElementById("productImage").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `<img src="${e.target.result}" alt="Vista previa" style="max-width:100%; border-radius:12px; border:1px solid #e5e7eb;" />`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("createPublicationSubmit").addEventListener("click", () => {
    const name = document.getElementById("productName").value.trim();
    const description = document.getElementById("productDescription").value.trim();
    const value = document.getElementById("productValue").value.trim();
    const category = document.getElementById("productCategory").value;
    const previewImg = preview.querySelector("img");

    if (!name || !description || !value) {
      alert("Completá nombre, descripción y valor");
      return;
    }

    const product = {
      id: Date.now(),
      name,
      description,
      value: `$${Number(value).toLocaleString("es-AR")}`,
      category,
      image: previewImg ? previewImg.src : "",
      visible: true
    };

    state.products.unshift(product);
    saveState();
    renderProducts();
    closeModal();
  });

  document.getElementById("cancelCreatePublication").addEventListener("click", closeModal);
}

function openEditPublicationModal(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;

  const html = `
    <div class="field">
      <label for="editProductName">Nombre del producto</label>
      <input id="editProductName" type="text" value="${product.name}" />
    </div>
    <div class="field">
      <label for="editProductDescription">Descripción</label>
      <textarea id="editProductDescription">${product.description}</textarea>
    </div>
    <div class="field">
      <label for="editProductValue">Valor</label>
      <input id="editProductValue" type="number" min="0" step="1" value="${parseInt(product.value.replace(/\\D/g, ""), 10) || ""}" />
    </div>
    <div class="field">
      <label for="editProductCategory">Categoría</label>
      <select id="editProductCategory">
        ${state.categories
          .map(
            (category) =>
              `<option value="${category}" ${
                category === product.category ? "selected" : ""
              }>${category}</option>`
          )
          .join("")}
      </select>
    </div>
  `;

  const actions = `
    <button class="btn" id="saveEditPublicationBtn">Editar</button>
    <button class="btn ghost" id="cancelEditPublicationBtn">Cancelar</button>
  `;

  showModal("Editar publicación", html, actions);

  document.getElementById("saveEditPublicationBtn").addEventListener("click", () => {
    const name = document.getElementById("editProductName").value.trim();
    const description = document.getElementById("editProductDescription").value.trim();
    const value = document.getElementById("editProductValue").value.trim();
    const category = document.getElementById("editProductCategory").value;

    if (!name || !description || !value) {
      alert("Completá nombre, descripción y valor");
      return;
    }

    product.name = name;
    product.description = description;
    product.value = `$${Number(value).toLocaleString("es-AR")}`;
    product.category = category;

    saveState();
    renderProducts();
    closeModal();
  });

  document.getElementById("cancelEditPublicationBtn").addEventListener("click", closeModal);
}

function toggleOwnerMenu(productId) {
  document.querySelectorAll(".owner-menu").forEach((menu) => {
    if (menu.id !== `menu-${productId}`) {
      menu.classList.remove("active");
    }
  });

  const menu = document.getElementById(`menu-${productId}`);
  if (menu) {
    menu.classList.toggle("active");
  }
}

roleSelect.addEventListener("change", (e) => {
  state.role = e.target.value;
  saveState();
  renderAll();
});

adminBtn.addEventListener("click", openAdminPanel);
createCategoryBtn.addEventListener("click", openCreateCategoryModal);
createPublicationBtn.addEventListener("click", openCreatePublicationModal);
searchInput.addEventListener("input", renderProducts);

productsGrid.addEventListener("click", (event) => {
  const menuTrigger = event.target.closest("[data-menu-trigger]");
  if (menuTrigger) {
    toggleOwnerMenu(Number(menuTrigger.dataset.menuTrigger));
    return;
  }

  const menuAction = event.target.closest("[data-action]");
  if (menuAction) {
    const id = Number(menuAction.dataset.id);
    const action = menuAction.dataset.action;
    const product = state.products.find((item) => item.id === id);

    if (!product) return;

    if (action === "delete") {
      state.products = state.products.filter((item) => item.id !== id);
      saveState();
      renderProducts();
    } else if (action === "hide") {
      product.visible = false;
      saveState();
      renderProducts();
    } else if (action === "show") {
      product.visible = true;
      saveState();
      renderProducts();
    } else if (action === "edit") {
      openEditPublicationModal(id);
    }

    return;
  }

  const buyButton = event.target.closest("[data-buy]");
  if (!buyButton) return;

  const productId = Number(buyButton.dataset.buy);
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;

  state.pedidos += 1;
  state.pedidosSemana += 1;
  saveState();

  const qtySelect = document.getElementById(`qty-${productId}`);
  const quantity = qtySelect ? qtySelect.value : "1";

  const message = encodeURIComponent(
    `Hola, quiero comprar ${quantity} unidad/es de ${product.name} por ${product.value}.`
  );

  window.open(
    `https://wa.me/5493462619313?text=${message}`,
    "_blank",
    "noopener,noreferrer"
  );

  renderProducts();
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY || event.key === BACKUP_KEY) {
    state = loadState();
    renderAll();
  }
});

if (channel) {
  channel.addEventListener("message", (event) => {
    if (event.data?.type === "state-update") {
      hydrateFromRemote(event.data.state);
    }
  });
}

window.addEventListener("beforeunload", saveState);
window.addEventListener("pagehide", saveState);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveState();
  }
});

initRealtimeSync();
setInterval(saveState, 5000);

renderAll();
