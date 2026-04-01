export async function buscarCEP(cepInput) {
    const cep = cepInput.replace(/\D/g, '');
    if (cep.length !== 8) return null;

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (data.erro) return null;
        return data;
    } catch (err) {
        console.error("Erro ao buscar CEP:", err);
        return null;
    }
}
