// Configurações
let pdfData = [];
let pdfLoaded = false;
let currentResults = [];
let currentQuery = '';
let currentSources = [];

// ⚠️ CONFIGURE SUA API KEY DO GOOGLE GEMINI AQUI:
// Obtenha em: https://aistudio.google.com/app/api-keys
let geminiApiKey = CONFIG.geminiApiKey;

// Lista de possíveis nomes para o PDF do manual
const possiblePdfNames = [
    'Data/Manual PROCESSOS TCI.pdf',
    'manual_tci.pdf',
    'manual-processos.pdf',
    'manual_processos.pdf',
    'manual.pdf',
    'tci-manual.pdf',
    'tci_manual.pdf',
    'processos.pdf',
    'manual-procedimentos.pdf',
    'manual_procedimentos.pdf'
];

// Configurar PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ========== FUNÇÕES DE INICIALIZAÇÃO ==========

function startSearch() {
    const welcomeScreen = document.getElementById('welcomeScreen');
    welcomeScreen.classList.add('fade-out');

    setTimeout(() => {
        welcomeScreen.style.display = 'none';
        document.getElementById('searchInput').focus();
    }, 500);
}

async function tryLoadPdf() {
    for (const pdfName of possiblePdfNames) {
        try {
            const response = await fetch(pdfName);

            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);

                await loadPDF(uint8Array, pdfName);
                console.log(`PDF carregado: ${pdfName}`);
                return true;
            }
        } catch (error) {
            continue;
        }
    }

    console.log('Nenhum PDF encontrado - usando busca simulada');
    return false;
}

// ========== FUNÇÕES DE CARREGAMENTO DO PDF ==========

async function loadPDF(data, fileName) {
    try {
        const pdf = await pdfjsLib.getDocument(data).promise;
        pdfData = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            const pageText = textContent.items
                .map(item => item.str)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();

            if (pageText.length > 20) {
                const sections = splitIntoSections(pageText, pageNum);
                pdfData.push(...sections);
            }
        }

        pdfLoaded = true;
        console.log(`PDF processado: ${pdfData.length} seções extraídas`);

    } catch (error) {
        console.error('Erro ao processar PDF:', error);
    }
}

function splitIntoSections(text, pageNum) {
    const sections = [];
    const words = text.split(' ');
    const chunkSize = 200;

    for (let i = 0; i < words.length; i += chunkSize) {
        const chunk = words.slice(i, i + chunkSize).join(' ');
        if (chunk.trim().length > 50) {
            sections.push({
                content: chunk,
                page: pageNum,
                section: Math.floor(i / chunkSize) + 1
            });
        }
    }

    return sections;
}

// ========== FUNÇÕES DE BUSCA ==========

function performSearch() {
    const welcomeScreen = document.getElementById('welcomeScreen');
    if (welcomeScreen.style.display !== 'none') {
        startSearch();
        setTimeout(() => {
            executeSearch();
        }, 600);
    } else {
        executeSearch();
    }
}

function executeSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    showResults();
    showLoading();
    disableSearchButton();

    setTimeout(() => {
        let results = [];
        if (pdfLoaded) {
            results = searchInPDF(query);
        } else {
            results = simulateSearch(query);
        }

        currentResults = results;
        currentQuery = query;

        displayResults(results, query);
        enableSearchButton();

        // ✅ CHAMADA AUTOMÁTICA DA IA APÓS A BUSCA
        if (results.length > 0) {
            askAI(query, results.slice(0, 5));
        }
    }, 300);
}

function searchInPDF(query) {
    const results = [];
    const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);

    pdfData.forEach(section => {
        const content = section.content.toLowerCase();
        let relevance = 0;
        let hasMatch = false;

        // Busca exata
        if (content.includes(query.toLowerCase())) {
            relevance += 20;
            hasMatch = true;
        }

        // Busca por palavras individuais
        queryWords.forEach(word => {
            const wordCount = (content.match(new RegExp(word, 'g')) || []).length;
            if (wordCount > 0) {
                relevance += wordCount * 3;
                hasMatch = true;
            }
        });

        // Busca proximidade das palavras
        if (queryWords.length > 1) {
            let allWordsFound = true;
            queryWords.forEach(word => {
                if (!content.includes(word)) {
                    allWordsFound = false;
                }
            });
            if (allWordsFound) relevance += 10;
        }

        if (hasMatch) {
            results.push({
                content: section.content,
                page: section.page,
                section: section.section,
                relevance: relevance
            });
        }
    });

    return results
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 15);
}

function simulateSearch(query) {
    const simulatedResults = [{
            content: `Processo de ${query}: Documentação necessária para abertura de processo relacionado a ${query}. Este procedimento deve ser seguido conforme as diretrizes estabelecidas no manual de processos da organização.`,
            page: 1,
            section: 1,
            relevance: 15
        },
        {
            content: `Procedimentos para ${query}: Fluxo detalhado das etapas necessárias para execução de ${query}. Importante verificar todos os requisitos antes de iniciar o processo.`,
            page: 2,
            section: 1,
            relevance: 12
        },
        {
            content: `Aprovação de ${query}: Critérios e responsáveis pela aprovação de processos relacionados a ${query}. O tempo médio de aprovação é de 5 a 10 dias úteis.`,
            page: 3,
            section: 2,
            relevance: 10
        },
        {
            content: `Documentação para ${query}: Lista completa de documentos necessários para solicitações de ${query}. Verifique se todos os documentos estão atualizados e válidos.`,
            page: 4,
            section: 1,
            relevance: 9
        }
    ];
    return simulatedResults;
}

function searchSuggestion(suggestion) {
    document.getElementById('searchInput').value = suggestion;
    performSearch();
}

// ========== FUNÇÕES DE EXIBIÇÃO ==========

function displayResults(results, query, showAll = false) {
    hideLoading();
    const resultsDiv = document.getElementById('results');

    if (results.length === 0) {
        resultsDiv.innerHTML = `
            <div class="tci-no-results">
                <h4>Nenhum resultado encontrado</h4>
                <p>Tente usar termos diferentes ou palavras-chave mais específicas</p>
            </div>
        `;
        return;
    }

    const resultsPerPage = 5;
    const resultsToShow = showAll ? results.length : Math.min(results.length, resultsPerPage);
    const displayResults = results.slice(0, resultsToShow);

    resultsDiv.innerHTML = displayResults.map((result, index) => {
        const snippet = extractRelevantSnippet(result.content, query);

        return `
            <div class="tci-result-item" onclick="showDetailModal(${index})">
                <div class="tci-result-title">Resultado ${index + 1}</div>
                <div class="tci-result-content">${highlightTerms(snippet, query)}</div>
                <div class="tci-result-page">Página ${result.page}, Seção ${result.section}</div>
            </div>
        `;
    }).join('');

    // Adicionar botão "Ver mais" se houver mais resultados
    if (results.length > resultsPerPage && !showAll) {
        const moreButton = document.createElement('div');
        moreButton.style.textAlign = 'center';
        moreButton.style.marginTop = '16px';
        moreButton.innerHTML = `
            <button onclick="displayResults(currentResults, currentQuery, true)" 
                    style="background: #f1f5f9; border: 2px solid #cbd5e1; border-radius: 8px; 
                           padding: 12px 24px; cursor: pointer; font-weight: 500;">
                Ver mais ${results.length - resultsPerPage} resultados
            </button>
        `;
        resultsDiv.appendChild(moreButton);
    }
}

function extractRelevantSnippet(text, query, maxLength = 300) {
    const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
    const lowerText = text.toLowerCase();

    let bestPosition = 0;
    let bestScore = 0;

    queryWords.forEach(word => {
        const position = lowerText.indexOf(word);
        if (position !== -1) {
            let score = 0;
            const window = lowerText.substring(Math.max(0, position - 50), position + 150);
            queryWords.forEach(w => {
                if (window.includes(w)) score++;
            });

            if (score > bestScore) {
                bestScore = score;
                bestPosition = position;
            }
        }
    });

    const start = Math.max(0, bestPosition - 50);
    const end = Math.min(text.length, start + maxLength);

    let snippet = text.substring(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
}

function highlightTerms(text, query) {
    const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
    let highlightedText = text;

    queryWords.forEach(word => {
        const regex = new RegExp(`(${word})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<span class="tci-highlight">$1</span>');
    });

    return highlightedText;
}

// ========== FUNÇÕES DE UI ==========

function showResults() {
    document.getElementById('resultsContainer').classList.add('show');
}

function showLoading() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('results').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('results').style.display = 'block';
}

function disableSearchButton() {
    const btn = document.getElementById('searchBtn');
    btn.disabled = true;
    document.getElementById('btnIcon').textContent = '⏳';
}

function enableSearchButton() {
    const btn = document.getElementById('searchBtn');
    btn.disabled = false;
    document.getElementById('btnIcon').textContent = '🔎';
}

// ========== MODAL DE DETALHES ==========

function showDetailModal(resultIndex) {
    const result = currentResults[resultIndex];
    if (!result) return;

    document.getElementById('detailTitle').textContent = `Resultado ${resultIndex + 1}`;
    document.getElementById('detailText').innerHTML = highlightTerms(result.content, currentQuery);
    document.getElementById('detailPageInfo').innerHTML = `
        <strong>Localização:</strong> 
        <span>Página ${result.page}, Seção ${result.section}</span>
    `;

    document.getElementById('detailModal').style.display = 'flex';
}

function closeDetailModal() {
    document.getElementById('detailModal').style.display = 'none';
}

// ========== INTEGRAÇÃO COM GOOGLE GEMINI AI ==========

async function askAI(query, sources) {
    // Verificar se a API Key está configurada
    if (!geminiApiKey || geminiApiKey === 'SUA_API_KEY_AQUI') {
        console.warn('API Key não configurada - IA desabilitada');
        return;
    }

    currentSources = sources;

    const modal = document.getElementById('aiModal');
    const responseDiv = document.getElementById('aiResponse');

    // Abrir modal automaticamente
    modal.style.display = 'flex';
    responseDiv.innerHTML = `
        <div class="tci-ai-loading">
            <div class="tci-ai-spinner"></div>
            <p>Analisando documentos e gerando resposta...</p>
        </div>
    `;

    try {
        // Preparar contexto das fontes
        const context = sources.map((source, idx) =>
            `[Fonte ${idx + 1} - Página ${source.page}]\n${source.content}`
        ).join('\n\n');

        // Fazer chamada para a API do Google Gemini
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Você é um assistente especializado em analisar documentos e responder perguntas com base em informações fornecidas.

CONTEXTO DO MANUAL (extraído de PDF):
${context}

PERGUNTA DO USUÁRIO: ${query}

Por favor, analise o contexto fornecido e responda à pergunta do usuário de forma clara, objetiva e em português. 

Suas diretrizes:
1. Base sua resposta EXCLUSIVAMENTE nas informações do contexto fornecido
2. Se a informação não estiver no contexto, diga claramente que não encontrou
3. Cite as páginas relevantes quando possível (ex: "Conforme a página 3...")
4. Organize a resposta de forma estruturada e fácil de ler
5. Seja conciso mas completo
6. Use linguagem profissional mas acessível`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2000,
                }
            })
        });

        const data = await response.json();

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const aiText = data.candidates[0].content.parts[0].text;
            responseDiv.innerHTML = formatAIResponse(aiText);
        } else if (data.error) {
            throw new Error(data.error.message || 'Erro na API do Gemini');
        } else {
            throw new Error('Resposta inválida da API');
        }

    } catch (error) {
        console.error('Erro ao consultar IA:', error);
        responseDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <p style="font-size: 18px; margin-bottom: 12px;">⚠️ Erro ao consultar IA</p>
                <p style="font-size: 14px; color: #64748b;">
                    ${error.message || 'Não foi possível obter uma resposta do assistente.'}<br><br>
                    Verifique se sua API Key está correta e válida.<br>
                    Obtenha uma nova em: <a href="https://aistudio.google.com/app/api-keys" target="_blank" style="color: #3b82f6;">Google AI Studio</a>
                </p>
            </div>
        `;
    }
}

function formatAIResponse(text) {
    // Formatar a resposta da IA com parágrafos e listas
    let formatted = text
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    // Adicionar tags de parágrafo
    formatted = '<p>' + formatted + '</p>';

    // Destacar negrito
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    return formatted;
}

function closeAIModal() {
    document.getElementById('aiModal').style.display = 'none';
}

function showSources() {
    if (currentSources.length === 0) return;

    const sourcesText = currentSources.map((source, idx) =>
        `Fonte ${idx + 1} (Página ${source.page}):\n${source.content}`
    ).join('\n\n---\n\n');

    alert('FONTES CONSULTADAS:\n\n' + sourcesText);
}

// ========== EVENT LISTENERS ==========

document.addEventListener('DOMContentLoaded', async function() {
    // Tentar carregar PDF automaticamente
    await tryLoadPdf();
});

document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        performSearch();
    }
});

// Fechar modais ao clicar fora
document.addEventListener('click', function(e) {
    const detailModal = document.getElementById('detailModal');
    const aiModal = document.getElementById('aiModal');

    if (e.target === detailModal) {
        closeDetailModal();
    }
    if (e.target === aiModal) {
        closeAIModal();
    }
});

// Fechar modais com ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeDetailModal();
        closeAIModal();
    }
});