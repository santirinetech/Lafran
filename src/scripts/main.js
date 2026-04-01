import { products } from './data.js';
import { buscarCEP } from './viacep.js';

let cart = [];

document.addEventListener('DOMContentLoaded', () => {
    renderProducts();
    initRevealAnimations();
    initCart();
    initCheckout();
});

// PRODUCT RENDERING
function renderProducts() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    grid.innerHTML = products.map((product) => {
        return `
            <div class="product-card" data-reveal>
                <div class="product-image-container">
                    <img src="${product.image}" alt="${product.name}" class="product-image">
                </div>
                <div class="product-info">
                    <span class="product-tag">${product.collection}</span>
                    <h3 class="product-title">${product.name}</h3>
                    <p class="product-price">${product.price}</p>
                    <button class="btn-primary" onclick="addToCart(${product.id})" style="margin-top: 15px; width: 100%;">
                        ADICIONAR À BAG
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function initParallax() {
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        document.querySelectorAll('.bento-parallax').forEach(img => {
            const speed = 0.05;
            img.style.transform = `translateY(${scrolled * speed}px)`;
        });
    });
}

// CART LOGIC
function initCart() {
    const overlay = document.getElementById('cart-overlay');
    const sidebar = document.getElementById('cart-sidebar');
    const closeBtn = document.getElementById('cart-close');
    const cartBtn = document.querySelector('.header-actions a[href="#"]:last-child'); // Cart icon

    const toggleCart = () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    };

    cartBtn.onclick = (e) => { e.preventDefault(); toggleCart(); };
    closeBtn.onclick = toggleCart;
    overlay.onclick = toggleCart;

    // Toast element
    const toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
    window.toast = toast;

    window.addToCart = (productId) => {
        const product = products.find(p => p.id === productId);
        const existing = cart.find(item => item.id === productId);

        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push({ ...product, quantity: 1 });
        }

        updateCartUI();
        showToast(`${product.name} ADICIONADO!`);
    };

    window.updateQty = (id, delta) => {
        const item = cart.find(i => i.id === id);
        if (item) {
            item.quantity += delta;
            if (item.quantity <= 0) {
                cart = cart.filter(i => i.id !== id);
            }
        }
        updateCartUI();
    };
}

function updateCartUI() {
    const container = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total-value');
    const badge = document.getElementById('cart-count');

    // Update Badge
    badge.innerText = cart.reduce((acc, i) => acc + i.quantity, 0);
    badge.style.opacity = cart.length > 0 ? '1' : '0';

    // Render Items
    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-img"><img src="${item.image}"></div>
            <div class="cart-item-info">
                <div class="cart-item-title">${item.name}</div>
                <div class="cart-item-price">${item.price}</div>
                <div class="cart-item-qty">
                    <div class="qty-btn" onclick="updateQty(${item.id}, -1)">-</div>
                    <span>${item.quantity}</span>
                    <div class="qty-btn" onclick="updateQty(${item.id}, 1)">+</div>
                </div>
            </div>
        </div>
    `).join('');

    // Calculate Total
    const total = cart.reduce((acc, item) => {
        const price = parseFloat(item.price.replace('R$ ', '').replace(',', '.'));
        return acc + (price * item.quantity);
    }, 0);

    totalEl.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

function showToast(msg) {
    const toast = window.toast;
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// CHECKOUT LOGIC
function initCheckout() {
    const openBtn = document.getElementById('open-checkout');
    const modal = document.getElementById('checkout-modal');
    const nextToAddressBtn = document.getElementById('next-to-address');
    const nextToPaymentBtn = document.getElementById('next-to-payment');
    const confirmBtn = document.getElementById('confirm-order');

    openBtn.onclick = () => {
        if (cart.length === 0) return alert("Seu carrinho está vazio!");
        document.getElementById('cart-sidebar').classList.remove('active');
        document.getElementById('cart-overlay').classList.remove('active');
        modal.classList.add('active');
    };

    // Step 1 -> 2: Personal Data -> Address
    nextToAddressBtn.onclick = () => {
        const nome = document.getElementById('checkout-nome').value;
        const email = document.getElementById('checkout-email').value;
        const tel = document.getElementById('checkout-tel').value;

        if (!nome || !email || !tel) return alert("Por favor, preencha todos os dados pessoais!");
        if (!email.includes('@')) return alert("E-mail inválido!");

        document.getElementById('step-1').classList.remove('active');
        document.getElementById('step-2').classList.add('active');
        document.getElementById('step-1-indicator').classList.remove('active');
        document.getElementById('step-2-indicator').classList.add('active');
    };

    // ViaCEP Integration
    const cepInput = document.getElementById('checkout-cep');
    cepInput.addEventListener('blur', async () => {
        const data = await buscarCEP(cepInput.value);
        if (data) {
            document.getElementById('checkout-rua').value = data.logradouro;
            document.getElementById('checkout-complemento').value = data.bairro + " - " + data.localidade;
        }
    });

    // Step 2 -> 3: Address -> Payment
    nextToPaymentBtn.onclick = () => {
        if (!document.getElementById('checkout-numero').value) return alert("Informe o número!");
        
        document.getElementById('step-2').classList.remove('active');
        document.getElementById('step-3').classList.add('active');
        document.getElementById('step-2-indicator').classList.remove('active');
        document.getElementById('step-3-indicator').classList.add('active');
    };

    // Payment Selection
    const options = document.querySelectorAll('.payment-option');
    options.forEach(opt => {
        opt.onclick = () => {
            options.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            
            const method = opt.dataset.method;
            document.getElementById('payment-pix-details').style.display = method === 'pix' ? 'block' : 'none';
        };
    });

    // Step 3 -> 4: Payment -> Success
    confirmBtn.onclick = () => {
        const selected = document.querySelector('.payment-option.active');
        if (!selected) return alert("Selecione um método de pagamento!");

        const nome = document.getElementById('checkout-nome').value;
        const email = document.getElementById('checkout-email').value;

        // Custom success message
        document.getElementById('success-message').innerText = `Obrigado, ${nome.split(' ')[0]}! Seu pedido foi processado com sucesso. Enviamos uma confirmação para ${email}.`;

        document.getElementById('step-3').classList.remove('active');
        document.getElementById('step-4').classList.add('active');
        document.getElementById('step-3-indicator').classList.remove('active');
        document.getElementById('step-4-indicator').classList.add('active');
        
        // Clear cart
        cart = [];
        updateCartUI();
    };
}

// ANIMATIONS
function initRevealAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
}
