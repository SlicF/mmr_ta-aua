/**
 * Sistema de tooltips ao clicar para dispositivos móveis
 * Mostra o atributo 'title' em um tooltip quando se clica em elementos
 */

let activeTooltip = null;

function isMobileTooltipContext() {
    if (typeof window.isMobileDevice === 'function') {
        return window.isMobileDevice();
    }

    return window.matchMedia('(max-width: 768px)').matches ||
        'ontouchstart' in window ||
        (navigator.maxTouchPoints || 0) > 0;
}

/**
 * Cria e mostra um tooltip com o texto do título
 */
function showMobileTooltip(element, text) {
    // Remove tooltip anterior se existir
    if (activeTooltip) {
        activeTooltip.remove();
    }

    // Cria o elemento do tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'mobile-tooltip';
    tooltip.textContent = text;
    document.body.appendChild(tooltip);

    // Posiciona o tooltip perto do elemento clicado
    const rect = element.getBoundingClientRect();
    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    tooltip.style.top = (rect.top - 10) + 'px';

    // Trigger reflow para ativar animação
    tooltip.offsetHeight;
    tooltip.classList.add('show');

    activeTooltip = tooltip;

    // Remove o tooltip após 3 segundos ou ao clicar noutro elemento
    setTimeout(() => {
        if (activeTooltip === tooltip) {
            tooltip.classList.remove('show');
            setTimeout(() => tooltip.remove(), 300);
            activeTooltip = null;
        }
    }, 3000);
}

/**
 * Inicializa os listeners para tooltips ao clicar em mobile
 */
function initMobileTooltips() {
    // Apenas em dispositivos móveis
    if (!isMobileTooltipContext()) {
        return;
    }

    // Adiciona listener a todos os elementos com atributo title
    document.addEventListener('click', function (e) {
        const target = e.target.closest('[title]');

        if (target && target.title) {
            e.preventDefault();
            e.stopPropagation();
            showMobileTooltip(target, target.title);
        }
    }, true);

    // Fecha o tooltip ao clicar fora
    document.addEventListener('click', function (e) {
        if (activeTooltip && !e.target.closest('[title]')) {
            activeTooltip.classList.remove('show');
            setTimeout(() => {
                if (activeTooltip) {
                    activeTooltip.remove();
                    activeTooltip = null;
                }
            }, 300);
        }
    });

    // Fecha o tooltip ao fazer scroll
    window.addEventListener('scroll', function () {
        if (activeTooltip) {
            activeTooltip.classList.remove('show');
            setTimeout(() => {
                if (activeTooltip) {
                    activeTooltip.remove();
                    activeTooltip = null;
                }
            }, 300);
        }
    }, true);
}

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileTooltips);
} else {
    initMobileTooltips();
}
