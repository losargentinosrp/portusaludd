const STORAGE_KEY = "viandas-state-v1";

const defaultState = {
  role: "Visitante",
  selectedCategory: null,
  categories: [],
  products: [
    {
      id: 1,
      name: "Ensalada light",
      description: "Ensalada fresca con pollo, verduras y aderezo light.",
      value: "$1.800",
      category: "",
      image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80",
      visible: true
    },
    {
      id: 2,
      name: "Vianda de arroz y carne",
      description: "Arroz, carne hervida, vegetales y salsa casera.",
      value: "$2.400",
      category: "",
      image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80",
      visible: true
    }
  ]
};

const categoryRow = document.getElementById("categoryRow");
const productsGrid = document.getElementById("products");
const searchInput = document.getElementById("searchInput");
const roleSelect = document.getElementById("roleSelect");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalActions = document.getElementById("modalActions");
const createCategoryBtn = document.getElementById("createCategoryBtn");
const createPublicationBtn = document.getElementById("createPublicationBtn");
const modalCard = document.getElementById("modalCard");
const modalHeader = document.querySelector(".modal-header");

let state = loadState();
let dragState = null;

function loadState() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  return { ...defaultState, ...(saved || {}) };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function renderCategories() {
  categoryRow.innerHTML = "";

  if (!state.categories.length) {
    categoryRow.innerHTML = '<div class="product-desc">Aún no hay categorías creadas.</div>';
    return;
  }

  state.categories.forEach((cat) => {
    const item = document.createElement("div");
    item.className = "category-item";

    const pill = document.createElement("button");
    pill.className = "category-pill";
    if (state.selectedCategory === cat) pill.classList.add("active");
    pill.textContent = cat;

    pill.addEventListener("click", () => {
      state.selectedCategory = state.selectedCategory === cat ? null : cat;
      saveState();
      renderCategories();
      renderProducts();
    });

    item.appendChild(pill);

    if (state.role === "Propietario") {
      const menuBtn = document.createElement("button");
      menuBtn.className = "category-menu-btn";
      menuBtn.textContent = "⋯";

      const menu = document.createElement("div");
      menu.className = "category-menu";

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Eliminar";
      deleteBtn.dataset.deleteCategory = cat;

      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteCategory(cat);
      });

      menu.appendChild(deleteBtn);

      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".category-menu").forEach((m) => m.classList.remove("active"));
        menu.classList.toggle("active");
      });

      item.appendChild(menuBtn);
      item.appendChild(menu);
    }

    categoryRow.appendChild(item);
  });
}

function deleteCategory(categoryName) {
  if (!categoryName) return;

  const confirmed = confirm(`¿Querés eliminar la categoría "${categoryName}"?`);
  if (!confirmed) return;

  state.categories = state.categories.filter((cat) => cat !== categoryName);

  state.products = state.products.map((product) =>
    product.category === categoryName ? { ...product, category: "" } : product
  );

  if (state.selectedCategory === categoryName) {
    state.selectedCategory = null;
  }

  saveState();
  renderCategories();
  renderProducts();
}

function renderProducts() {
  const query = normalizeText(searchInput.value);

  const filtered = state.products.filter((product) => {
    const matchesCategory =
      !state.selectedCategory ||
      normalizeText(product.category) === normalizeText(state.selectedCategory);

    const matchesText =
      !query ||
      [product.name, product.description, product.category, product.value].some((field) =>
        normalizeText(field).includes(query)
      );

    return matchesCategory && matchesText;
  });

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
      <img src="${product.image || "https://via.placeholder.com/400x240?text=Producto"}" alt="${product.name}" />
      <div class="product-body">
        <div class="product-name">${product.name}</div>
        <div class="product-desc">${product.description}</div>
        <div class="product-desc" style="margin-top: 6px; font-size: 13px; color: #2e8b57;">
          Categoría: ${product.category || "Sin categoría"}
        </div>
        <div class="product-footer" style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
          <strong>${product.value}</strong>
          <button class="btn" data-buy="${product.id}">Comprar</button>
        </div>
      </div>
    `;
    productsGrid.appendChild(card);
  });
}

function showModal(title, bodyHtml, actionsHtml) {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;
  modalActions.innerHTML = actionsHtml;
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");

  modalCard.style.top = "0px";
  modalCard.style.left = "0px";
  modalCard.classList.remove("dragging");
}

function closeModal() {
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  modalBody.innerHTML = "";
  modalActions.innerHTML = "";
  modalCard.style.top = "0px";
  modalCard.style.left = "0px";
  modalCard.classList.remove("dragging");
}

function startDrag(event) {
  dragState = {
    startX: event.clientX,
    startY: event.clientY,
    startTop: parseInt(modalCard.style.top || "0", 10),
    startLeft: parseInt(modalCard.style.left || "0", 10)
  };

  modalCard.classList.add("dragging");
  document.body.style.userSelect = "none";
  event.preventDefault();
}

function onDrag(event) {
  if (!dragState) return;

  const deltaX = event.clientX - dragState.startX;
  const deltaY = event.clientY - dragState.startY;

  modalCard.style.top = `${dragState.startTop + deltaY}px`;
  modalCard.style.left = `${dragState.startLeft + deltaX}px`;
}

function stopDrag() {
  if (!dragState) return;
  dragState = null;
  modalCard.classList.remove("dragging");
  document.body.style.userSelect = "";
}

modalHeader.addEventListener("pointerdown", startDrag);
window.addEventListener("pointermove", onDrag);
window.addEventListener("pointerup", stopDrag);
window.addEventListener("pointercancel", stopDrag);

function openCreateCategoryModal() {
  const html = `
    <div class="field">
      <label for="categoryName">Nombre de la categoría</label>
      <input id="categoryName" type="text" placeholder="Ej: Postres" />
    </div>
  `;

  const actions = `
    <button class="btn" id="saveCategoryBtn">Crear</button>
    <button class="btn secondary" id="cancelCategoryBtn">Cancelar</button>
  `;

  showModal("Crear categoría", html, actions);

  document.getElementById("saveCategoryBtn").addEventListener("click", () => {
    const name = document.getElementById("categoryName").value.trim();
    if (!name) return;
    if (!state.categories.includes(name)) state.categories.push(name);

    saveState();
    renderCategories();
    closeModal();
  });

  document.getElementById("cancelCategoryBtn").addEventListener("click", closeModal);
}

function openCreatePublicationModal() {
  const options = state.categories.length
    ? state.categories.map((c) => `<option value="${c}">${c}</option>`).join("")
    : '<option value="">Sin categoría</option>';

  const html = `
    <div class="field">
      <label for="productName">Nombre</label>
      <input id="productName" type="text" placeholder="Ej: Ensalada light" />
    </div>
    <div class="field">
      <label for="productDescription">Descripción</label>
      <textarea id="productDescription"></textarea>
    </div>
    <div class="field">
      <label for="productValue">Valor</label>
      <input id="productValue" type="text" placeholder="$1.800" />
    </div>
    <div class="field">
      <label for="productCategory">Categoría</label>
      <select id="productCategory">${options}</select>
    </div>
  `;

  const actions = `
    <button class="btn" id="savePublicationBtn">Crear</button>
    <button class="btn secondary" id="cancelPublicationBtn">Cancelar</button>
  `;

  showModal("Crear publicación", html, actions);

  document.getElementById("savePublicationBtn").addEventListener("click", () => {
    const name = document.getElementById("productName").value.trim();
    const description = document.getElementById("productDescription").value.trim();
    const value = document.getElementById("productValue").value.trim();
    const category = document.getElementById("productCategory").value;

    if (!name || !description || !value) return;

    state.products.unshift({
      id: Date.now(),
      name,
      description,
      value,
      category,
      image: "",
      visible: true
    });

    saveState();
    renderProducts();
    closeModal();
  });

  document.getElementById("cancelPublicationBtn").addEventListener("click", closeModal);
}

createCategoryBtn.addEventListener("click", openCreateCategoryModal);
createPublicationBtn.addEventListener("click", openCreatePublicationModal);
searchInput.addEventListener("input", renderProducts);

roleSelect.addEventListener("change", (event) => {
  state.role = event.target.value;
  saveState();
  renderCategories();
  renderProducts();
});

productsGrid.addEventListener("click", (event) => {
  const buyButton = event.target.closest("[data-buy]");
  if (!buyButton) return;

  const productId = Number(buyButton.dataset.buy);
  const product = state.products.find((item) => item.id === productId);

  if (!product) return;

  const message = encodeURIComponent(`Hola, quiero comprar ${product.name} por ${product.value}.`);
  window.open(`https://wa.me/5493462619313?text=${message}`, "_blank", "noopener,noreferrer");
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".category-item")) {
    document.querySelectorAll(".category-menu").forEach((menu) => menu.classList.remove("active"));
  }
});

function renderAll() {
  renderCategories();
  renderProducts();
}

renderAll();
initRealtimeSync();
setInterval(saveState, 5000);

renderAll();
