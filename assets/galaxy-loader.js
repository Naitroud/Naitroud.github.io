'use strict';
(() => {
    const node = document.getElementById('galaxy-data'),
    fallback = JSON.parse(node.textContent),
    root = new URL('../', document.currentScript.src),
    keys = ['systems', 'events', 'fleets', 'groups', 'commanders', 'territories', 'meta'];
    window.GalDataReady = (async() => {
        let data = fallback;
        try {
            const parts = await Promise.all(keys.map(async key => {
                        const response = await fetch(new URL('assets/galaxy/' + key + '.json', root), {
                            cache: 'no-store'
                        });
                        if (!response.ok)
                            throw Error(key + ': ' + response.status);
                        return response.json();
                    }));
            const files = Object.fromEntries(keys.map((key, i) => [key, parts[i]]));
            for (const key of keys.slice(0, 5))
                if (!Array.isArray(files[key]))
                    throw Error('Invalid ' + key);
            if (!files.meta || typeof files.meta !== 'object' || Array.isArray(files.meta))
                throw Error('Invalid metadata');
            data = {
                ...files.meta,
                ...Object.fromEntries(keys.slice(0, 6).map(key => [key, files[key]]))
            };
            window.GalaxyDataSource = 'external';
        } catch (error) {
            window.GalaxyDataSource = 'embedded';
            window.GalaxyDataLoadError = String(error);
            if (location.protocol !== 'file:')
                console.warn('Galaxy JSON unavailable; using complete embedded fallback.', error);
        }
        node.textContent = JSON.stringify(data);
        window.GalaxyPublishedBase = JSON.parse(JSON.stringify(data));
        return data;
    })();
    window.GalDataReady.then(() => {
        const script = document.createElement('script');
        script.src = new URL('assets/app.js', root).href;
        script.onerror = () => console.error('Unable to load galaxy application bundle');
        document.body.append(script);
    });
    /* ==== ДОБАВЛЕНО: индикатор источника данных. Выше — исходный код без изменений. ==== */
    const draftKeys = ['ugalaxy-draft-v7', 'ugalaxy-draft-v6', 'ugalaxy-draft-v4'];
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.id = 'galaxy-source-badge';
    badge.className = 'galaxy-source-badge';
    const badgeDot = document.createElement('span');
    badgeDot.className = 'dot';
    badgeDot.setAttribute('aria-hidden', 'true');
    const badgeLabel = document.createElement('span');
    badgeLabel.className = 'label';
    badge.append(badgeDot, badgeLabel);
    badge.setAttribute('aria-live', 'polite');
    const badgeStyle = document.createElement('style');
    badgeStyle.textContent = '.galaxy-source-badge{position:fixed;left:16px;bottom:54px;z-index:60;display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 12px;background:rgba(10,19,28,.97);border:1px solid #273b4c;border-radius:4px;font:11px "SFMono-Regular",Consolas,monospace;letter-spacing:.4px;color:#bdcbd6;box-shadow:0 5px 20px rgba(0,0,0,.25);cursor:pointer;transition:color .16s,border-color .16s}.galaxy-source-badge:hover{color:#e4eef6;border-color:#527887}.galaxy-source-badge .dot{width:7px;height:7px;border-radius:50%;background:#5a6c7c;flex:none;transition:background .2s}.galaxy-source-badge[data-state="external"] .dot{background:#59d68f}.galaxy-source-badge[data-state="embedded"] .dot{background:#ffb66a}.galaxy-source-badge[data-state="draft"] .dot{background:#78dfea}@media (max-width:700px){.galaxy-source-badge{left:12px;bottom:58px}}';
function badgeAppend(){if(!badgeStyle.isConnected)document.head.append(badgeStyle);if(document.body){if(!badge.isConnected)document.body.append(badge);}else document.addEventListener('DOMContentLoaded',badgeAppend,{once:true});}

    function activeDraftKey() {
        for (const key of draftKeys) {
            try {
                if (localStorage.getItem(key) !== null)
                    return key;
            } catch (error) {}
        }
        return null;
    }
    function badgeRender() {
        let state,
        title;
        const dk = activeDraftKey();
        if (dk) {
            state = 'draft';
            title = 'Локальный черновик редактора (' + dk + ') перекрывает опубликованные данные. Клик — вывести черновик в консоль.';
        } else if (!window.GalaxyDataSource) {
            state = 'loading';
            title = 'Идёт загрузка данных…';
        } else if (window.GalaxyDataSource === 'external') {
            state = 'external';
            title = 'Данные загружены из assets/galaxy/*.json. Клик — подробности в консоли.';
        } else {
            state = 'embedded';
            title = 'Внешние JSON недоступны, работает встроенный резерв. Причина: ' + (window.GalaxyDataLoadError || 'неизвестна') + '. Клик — подробности в консоли.';
        }
        badge.dataset.state = state;
        badgeLabel.textContent = {
            loading: 'загрузка данных…',
            external: 'внешние данные',
            embedded: 'встроенные данные',
            draft: 'локальный черновик'
        }
        [state];
        badge.title = title;
        badge.setAttribute('aria-label', title);
    }
    badge.addEventListener('click', () => {
        const dk = activeDraftKey();
        if (dk) {
            try {
                console.info('[Голокарта] Локальный черновик (' + dk + '):', JSON.parse(localStorage.getItem(dk)));
            } catch (error) {
                console.info('[Голокарта] Черновик (' + dk + ') не читается:', error);
            }
            return;
        }
        if (window.GalaxyDataSource === 'external')
            console.info('[Голокарта] Источник: внешние файлы assets/galaxy/*.json.');
        else
            console.info('[Голокарта] Источник: встроенный резерв. Причина fallback:', window.GalaxyDataLoadError);
    });
    document.addEventListener('galaxy-data-changed', badgeRender);
    window.addEventListener('storage', event => {
        if (event.key === null || draftKeys.includes(event.key))
            badgeRender();
    });
    badgeAppend();
    badgeRender();
    window.GalDataReady.then(() => {
        badgeRender();
        // Подстраховка: черновик применяется в app.js после загрузки бандла — перепроверяем ещё несколько раз
        setTimeout(badgeRender, 400);
        setTimeout(badgeRender, 1500);
        setTimeout(badgeRender, 4000);
    });
})();
