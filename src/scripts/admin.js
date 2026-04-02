import { SUPABASE_URL, SUPABASE_KEY, ADMIN_PIN } from './config.js';

let supabase;
let currentProducts = [];

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    if (localStorage.getItem('lafran_admin_auth') === 'true') {
        showDashboard();
    }
});

// AUTH LOGIC
function initAuth() {
    const inputs = document.querySelectorAll('.pin-digit');
    const errorEl = document.getElementById('login-error');

    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
            checkPin();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });
    });

    function checkPin() {
        const pin = Array.from(inputs).map(i => i.value).join('');
        if (pin.length === 4) {
            if (pin === ADMIN_PIN) {
                localStorage.setItem('lafran_admin_auth', 'true');
                showDashboard();
            } else {
                errorEl.style.opacity = '1';
                inputs.forEach(i => { i.value = ''; i.style.borderColor = '#ff4d4d'; });
                inputs[0].focus();
                setTimeout(() => {
                    errorEl.style.opacity = '0';
                    inputs.forEach(i => i.style.borderColor = 'var(--admin-border)');
                }, 2000);
            }
        }
    }

    document.getElementById('btn-logout').onclick = () => {
        localStorage.removeItem('lafran_admin_auth');
        location.reload();
    };
}

// DASHBOARD LOGIC
async function showDashboard() {
    document.body.classList.add('logged-in');
    
    // @ts-ignore
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    
    loadProducts();
    initModal();
}

async function loadProducts() {
    const grid = document.getElementById('admin-grid');
    grid.innerHTML = '<p class="section-tag">CARREGANDO...</p>';

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error(error);
        grid.innerHTML = '<p style="color: #ff4d4d;">ERRO AO CARREGAR: ' + error.message + '</p>';
        return;
    }

    currentProducts = data;
    renderAdminProducts(data);
}

function renderAdminProducts(products) {
    const grid = document.getElementById('admin-grid');
    if (products.length === 0) {
        grid.innerHTML = '<p class="section-tag">NENHUM PRODUTO ENCONTRADO NA COLEÇÃO.</p>';
        return;
    }

    grid.innerHTML = products.map(p => `
        <div class="admin-card">
            <img src="${p.image_url}" class="admin-card-img">
            <div class="admin-card-info">
                <p style="font-weight: 700; font-size: 0.9rem; margin-bottom: 5px;">${p.name}</p>
                <p style="font-size: 0.7rem; color: var(--accent-blue); letter-spacing: 1px;">${p.price} | ${p.collection}</p>
            </div>
            <div class="admin-card-actions">
                <button class="btn-primary" onclick="window.editProduct(${p.id})" style="flex: 1; padding: 12px; font-size: 0.6rem;">EDITAR</button>
                <button class="btn-primary" onclick="window.deleteProduct(${p.id})" style="flex: 1; padding: 12px; font-size: 0.6rem; background: #ff4d4d; border-color: #ff4d4d;">EXCLUIR</button>
            </div>
        </div>
    `).join('');
}

// MODAL & FORM LOGIC
function initModal() {
    const modal = document.getElementById('admin-modal');
    const form = document.getElementById('product-form');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const preview = document.getElementById('preview');

    window.closeModal = () => {
        modal.classList.remove('active');
        form.reset();
        preview.src = '';
        preview.style.display = 'none';
        document.getElementById('edit-id').value = '';
        document.getElementById('modal-title').innerText = 'NOVO PRODUTO';
    };

    document.getElementById('btn-add-product').onclick = () => {
        modal.classList.add('active');
    };

    dropzone.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const btnSave = document.getElementById('btn-save');
        const status = document.getElementById('upload-status');
        
        btnSave.disabled = true;
        btnSave.innerText = 'SALVANDO...';
        status.innerText = 'Preparando arquivos...';

        try {
            const id = document.getElementById('edit-id').value;
            const name = document.getElementById('p-name').value;
            const collection = document.getElementById('p-collection').value;
            const price = document.getElementById('p-price').value;
            const description = document.getElementById('p-desc').value;
            const color = document.getElementById('p-color').value;
            const accent = document.getElementById('p-accent').value;
            const file = fileInput.files[0];

            let image_url = preview.src;

            // If new file uploaded
            if (file) {
                status.innerText = 'Enviando imagem para o Storage...';
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `products/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('product-images')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabase.storage
                    .from('product-images')
                    .getPublicUrl(filePath);
                
                image_url = publicUrlData.publicUrl;
            }

            const productData = {
                name, collection, price, description, color, accent, image_url
            };

            if (id) {
                status.innerText = 'Atualizando dados...';
                const { error } = await supabase
                    .from('products')
                    .update(productData)
                    .eq('id', id);
                if (error) throw error;
            } else {
                status.innerText = 'Criando novo produto...';
                const { error } = await supabase
                    .from('products')
                    .insert([productData]);
                if (error) throw error;
            }

            status.innerText = 'Sucesso!';
            window.closeModal();
            loadProducts();
            
        } catch (err) {
            alert('Erro: ' + err.message);
            status.innerText = 'Erro ao salvar.';
        } finally {
            btnSave.disabled = false;
            btnSave.innerText = 'SALVAR PRODUTO';
        }
    };
}

// Global Actions for Dynamic Buttons
window.editProduct = (id) => {
    const p = currentProducts.find(item => item.id === id);
    if (!p) return;

    document.getElementById('modal-title').innerText = 'EDITAR PRODUTO';
    document.getElementById('edit-id').value = p.id;
    document.getElementById('p-name').value = p.name;
    document.getElementById('p-collection').value = p.collection;
    document.getElementById('p-price').value = p.price;
    document.getElementById('p-desc').value = p.description || '';
    document.getElementById('p-color').value = p.color || '';
    document.getElementById('p-accent').value = p.accent || '#00d4ff';
    
    const preview = document.getElementById('preview');
    preview.src = p.image_url;
    preview.style.display = 'block';

    document.getElementById('admin-modal').classList.add('active');
};

window.deleteProduct = async (id) => {
    if (!confirm('Deseja realmente excluir este produto?')) return;

    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

    if (error) {
        alert('Erro ao excluir: ' + error.message);
    } else {
        loadProducts();
    }
};
