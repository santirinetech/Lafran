import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { buscarCEP } from './viacep.js';

let cart = [];
let supabase;
let products = [];

document.addEventListener('DOMContentLoaded', async () => {
    // @ts-ignore
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    await loadProducts();
    initRevealAnimations();
    initCart();
    initCheckout();
});

// PRODUCT FETCHING
async function loadProducts() {
    const grid = document.getElementById('product-grid');

    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;

        products = data;
        renderProducts(products);
    } catch (err) {
        console.error("Erro ao carregar produtos:", err);
        grid.innerHTML = '<p class="section-tag" style="color: #ff4d4d;">Erro ao carregar coleção. Verifique as credenciais do Supabase.</p>';
    }
}

// PRODUCT RENDERING
function renderProducts(productsList) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    if (productsList.length === 0) {
        grid.innerHTML = '<p class="section-tag">Nenhum produto na coleção no momento.</p>';
        return;
    }

    grid.innerHTML = productsList.map((product) => {
        return `
            <div class="product-card" data-reveal>
                <div class="product-image-container">
                    <img src="${product.image_url}" alt="${product.name}" class="product-image">
                </div>
                <div class="product-info">
                    <span class="product-tag">${product.collection}</span>
                    <h3 class="product-title">${product.name}</h3>
                    <p class="product-price">${product.price}</p>
                    
                    <div class="size-selector" id="size-selector-${product.id}" style="display: flex; gap: 8px; margin-top: 15px; justify-content: center;">
                        <div class="size-btn active" onclick="selectSize(${product.id}, 'P')">P</div>
                        <div class="size-btn" onclick="selectSize(${product.id}, 'M')">M</div>
                        <div class="size-btn" onclick="selectSize(${product.id}, 'G')">G</div>
                        <div class="size-btn" onclick="selectSize(${product.id}, 'GG')">GG</div>
                    </div>

                    <button class="btn-primary" onclick="addToCartWithSelectedSize(${product.id})" style="margin-top: 15px; width: 100%;">
                        ADICIONAR À BAG
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Re-verify reveal animations for new items
    initRevealAnimations();
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

    window.selectSize = (productId, size) => {
        const container = document.getElementById(`size-selector-${productId}`);
        if (!container) return;
        container.querySelectorAll('.size-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.innerText === size) btn.classList.add('active');
        });
    };

    window.addToCartWithSelectedSize = (productId) => {
        const container = document.getElementById(`size-selector-${productId}`);
        const activeSize = container ? container.querySelector('.size-btn.active').innerText : 'P';
        addToCart(productId, activeSize);
    };

    window.addToCart = (productId, size = 'P') => {
        const product = products.find(p => p.id === productId);
        const itemKey = `${productId}-${size}`;
        const existing = cart.find(item => `${item.id}-${item.size}` === itemKey);

        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push({ ...product, quantity: 1, size });
        }

        updateCartUI();
        showToast(`${product.name} (${size}) ADICIONADO!`);
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
            <div class="cart-item-img"><img src="${item.image_url}"></div>
            <div class="cart-item-info">
                <div class="cart-item-title">${item.name} <span style="font-size: 0.7rem; color: var(--accent-blue);">(${item.size})</span></div>
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
    let shippingCost = 0;
    let deliveryType = 'entrega';

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
        if (deliveryType === 'retirada') return;
        const data = await buscarCEP(cepInput.value);
        if (data) {
            document.getElementById('checkout-rua').value = data.logradouro;
            document.getElementById('checkout-complemento').value = data.bairro + " - " + data.localidade;

            // Calculate shipping
            shippingCost = calculateShipping(data);
            const shippingResult = document.getElementById('shipping-result');
            const shippingValue = document.getElementById('shipping-value');

            shippingResult.style.display = 'block';
            shippingValue.innerText = shippingCost === 0 ? 'GRÁTIS' : `R$ ${shippingCost.toFixed(2).replace('.', ',')}`;
        }
    });

    // Delivery Type Toggle
    const deliveryOptions = document.querySelectorAll('.delivery-option');
    deliveryOptions.forEach(opt => {
        opt.onclick = () => {
            deliveryOptions.forEach(o => {
                o.classList.remove('active');
                o.style.borderColor = 'rgba(255,255,255,0.1)';
            });
            opt.classList.add('active');
            opt.style.borderColor = 'var(--accent-blue)';

            deliveryType = opt.dataset.type;
            const addressFields = document.getElementById('address-fields');
            const cashMethodText = document.getElementById('cash-method-text');

            if (deliveryType === 'retirada') {
                addressFields.style.opacity = '0.3';
                addressFields.style.pointerEvents = 'none';
                shippingCost = 0;
                document.getElementById('shipping-result').style.display = 'none';
                cashMethodText.innerText = 'retirada';
            } else {
                addressFields.style.opacity = '1';
                addressFields.style.pointerEvents = 'all';
                cashMethodText.innerText = 'entrega';
            }
        };
    });

    function calculateShipping(data) {
        const localidade = data.localidade.toLowerCase();
        const uf = data.uf.toUpperCase();

        if (localidade === 'aracruz') return 0; // Grátis em Aracruz
        if (uf === 'ES') return 15.00; // Resto do ES
        return 35.00; // Brasil
    }

    // Step 2 -> 3: Address -> Payment
    nextToPaymentBtn.onclick = () => {
        if (deliveryType === 'entrega' && !document.getElementById('checkout-numero').value) {
            return alert("Por favor, informe o número da residência!");
        }

        document.getElementById('step-2').classList.remove('active');
        document.getElementById('step-3').classList.add('active');
        document.getElementById('step-2-indicator').classList.remove('active');
        document.getElementById('step-3-indicator').classList.add('active');

        updateOrderSummary();
    };

    function updateOrderSummary() {
        const itemsList = document.getElementById('summary-items-list');
        const subtotalEl = document.getElementById('summary-subtotal');
        const shippingEl = document.getElementById('summary-shipping');
        const totalEl = document.getElementById('summary-total');

        const subtotal = cart.reduce((acc, item) => {
            const price = parseFloat(item.price.replace('R$ ', '').replace(',', '.'));
            return acc + (price * item.quantity);
        }, 0);

        itemsList.innerHTML = cart.map(item => `
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 5px; opacity: 0.8;">
                <span>${item.quantity}x ${item.name} (${item.size})</span>
                <span>${item.price}</span>
            </div>
        `).join('');

        subtotalEl.innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
        shippingEl.innerText = shippingCost === 0 ? 'GRÁTIS' : `R$ ${shippingCost.toFixed(2).replace('.', ',')}`;
        totalEl.innerText = `R$ ${(subtotal + shippingCost).toFixed(2).replace('.', ',')}`;
    }

    // Payment Selection
    const options = document.querySelectorAll('.payment-option');
    options.forEach(opt => {
        opt.onclick = () => {
            options.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');

            const method = opt.dataset.method;
            document.getElementById('payment-pix-details').style.display = method === 'pix' ? 'block' : 'none';
            document.getElementById('payment-card-details').style.display = method === 'card' ? 'block' : 'none';
            document.getElementById('payment-cash-details').style.display = method === 'cash' ? 'block' : 'none';
        };
    });

    confirmBtn.onclick = () => {
        const selected = document.querySelector('.payment-option.active');
        if (!selected) return alert("Selecione um método de pagamento!");

        const method = selected.dataset.method;
        const nome = document.getElementById('checkout-nome').value;
        const email = document.getElementById('checkout-email').value;

        if (method === 'card') {
            confirmBtn.innerText = "REDIRECIONANDO...";
            confirmBtn.style.opacity = "0.5";
            confirmBtn.disabled = true;

            // Simulation of Mercado Pago Redirect
            setTimeout(() => {
                window.open('https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=SIMULATED_ID', '_blank');
                showSuccess();
            }, 1500);
        } else {
            showSuccess();
        }

        function showSuccess() {
            // Custom success message
            document.getElementById('success-message').innerText = `Obrigado, ${nome.split(' ')[0]}! Seu pedido foi processado com sucesso. Enviamos uma confirmação para ${email}.`;

            document.getElementById('step-3').classList.remove('active');
            document.getElementById('step-4').classList.add('active');
            document.getElementById('step-3-indicator').classList.remove('active');
            document.getElementById('step-4-indicator').classList.add('active');

            // Send notifications (EmailJS / Webhook)
            sendOrderConfirmation({
                nome,
                email,
                metodo: method,
                entrega: deliveryType,
                total: cart.reduce((acc, item) => {
                    const price = parseFloat(item.price.replace('R$ ', '').replace(',', '.'));
                    return acc + (price * item.quantity);
                }, 0) + shippingCost,
                itens: cart
            });

            // Clear cart
            cart = [];
            updateCartUI();
        }
    };
}

async function sendOrderConfirmation(orderData) {
    console.log("🚀 Enviando pedido para processamento:", orderData);

    // 🔗 INTEGRAÇÃO WEBHOOK (n8n / Evolution API)
    // Para conectar, basta substituir o link abaixo pelo seu Webhook do n8n:
    const WEBHOOK_URL = 'https://n8n.santirine.com.br/webhook/4f7264a7-feff-4010-87a2-af79a12a0a9c';

    if (WEBHOOK_URL !== 'https://n8n.santirine.com.br/webhook/4f7264a7-feff-4010-87a2-af79a12a0a9c') {
        try {
            await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
            console.log("✅ Webhook disparado com sucesso!");
        } catch (err) {
            console.error("❌ Erro ao disparar webhook:", err);
        }
    }

    // 2. EmailJS Integration boilerplate
    /*
    emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", {
        to_name: orderData.nome,
        to_email: orderData.email,
        order_details: orderData.itens.map(i => `${i.quantity}x ${i.name} (${i.size})`).join(', '),
        total_value: `R$ ${orderData.total.toFixed(2)}`
    }).then(() => console.log("E-mail enviado!"), (err) => console.error("Erro e-mail:", err));
    */
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
