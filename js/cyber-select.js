/* ============================================
   InfiNet Cyber Custom Select Component
   Replaces native OS <select> menus with themed
   dark-cyber dropdowns matching site styling.
   ============================================ */

(function () {
    function closeAllCyberSelects(except) {
        document.querySelectorAll('.cyber-select.open').forEach(wrap => {
            if (wrap === except) return;
            wrap.classList.remove('open');
            const trig = wrap.querySelector('.cyber-select-trigger');
            if (trig) trig.setAttribute('aria-expanded', 'false');
            const host = wrap.closest('.form-group, .dash-form-row, .form-row');
            if (host) host.classList.remove('cyber-select-host-open');
        });
    }

    function enhanceSelect(select) {
        if (!select || select.dataset.cyberSelectInit === '1') return;
        select.dataset.cyberSelectInit = '1';

        select.classList.add('cyber-select-native');

        const wrap = document.createElement('div');
        wrap.className = 'cyber-select';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'cyber-select-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');

        const labelSpan = document.createElement('span');
        labelSpan.className = 'cyber-select-label';

        const arrowIcon = document.createElement('i');
        arrowIcon.className = 'fas fa-chevron-down cyber-select-arrow';

        trigger.appendChild(labelSpan);
        trigger.appendChild(arrowIcon);

        const menu = document.createElement('div');
        menu.className = 'cyber-select-menu';
        menu.setAttribute('role', 'listbox');

        wrap.appendChild(trigger);
        wrap.appendChild(menu);

        select.parentNode.insertBefore(wrap, select.nextSibling);

        function syncSelectedUI() {
            const selectedOpt = select.options[select.selectedIndex] || select.options[0];
            labelSpan.textContent = selectedOpt ? selectedOpt.textContent : 'Выберите...';

            menu.querySelectorAll('.cyber-select-option').forEach((item, idx) => {
                const isSel = idx === select.selectedIndex;
                item.classList.toggle('selected', isSel);
                item.setAttribute('aria-selected', isSel ? 'true' : 'false');
            });
        }

        function rebuildOptions() {
            menu.innerHTML = '';
            Array.from(select.options).forEach((opt, idx) => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'cyber-select-option';
                item.setAttribute('role', 'option');
                item.dataset.value = opt.value;

                const txt = document.createElement('span');
                txt.textContent = opt.textContent;

                const check = document.createElement('i');
                check.className = 'fas fa-check cyber-select-check';

                item.appendChild(txt);
                item.appendChild(check);

                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    select.selectedIndex = idx;
                    select.value = opt.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    syncSelectedUI();
                    closeAllCyberSelects();
                });

                menu.appendChild(item);
            });
            syncSelectedUI();
        }

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = !wrap.classList.contains('open');
            closeAllCyberSelects(wrap);
            wrap.classList.toggle('open', willOpen);
            trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            const host = wrap.closest('.form-group, .dash-form-row, .form-row');
            if (host) host.classList.toggle('cyber-select-host-open', willOpen);
        });

        select.addEventListener('change', syncSelectedUI);

        if (select.form) {
            select.form.addEventListener('reset', () => {
                setTimeout(syncSelectedUI, 0);
            });
        }

        const observer = new MutationObserver(() => {
            rebuildOptions();
        });
        observer.observe(select, { childList: true, subtree: true, characterData: true });

        rebuildOptions();
    }

    function initCyberSelects() {
        document.querySelectorAll('select').forEach(enhanceSelect);
    }

    document.addEventListener('click', () => closeAllCyberSelects());
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllCyberSelects();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCyberSelects);
    } else {
        initCyberSelects();
    }

    window.initCyberSelects = initCyberSelects;
})();
