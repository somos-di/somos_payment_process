(function () {
    var collapsed = false;
    var activeFlyout = null;
    var activeFlyoutHeader = null;

    function selectElement(selector, root) { return (root || document).querySelector(selector); }
    function $all(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

    function currentRoute() {
        var h = (window.location.hash || '').replace(/^#\/?/, '');
        return (h.split('?')[0] || (window.CONFIG && window.CONFIG.ROUTES.DEFAULT) || 'consulta');
    }

    function routeOfHref(href) {
        if (!href) return '';
        return href.replace(/^#\/?/, '').split('?')[0];
    }

    function openGroup(group, exclusive) {
        if (!group) return;
        if (exclusive) {
            $all('.menu-group.open').forEach(function (item) { if (item !== group) item.classList.remove('open'); });
        }
        group.classList.add('open');
    }

    function toggleGroup(group) {
        if (!group) return;
        var isOpen = group.classList.contains('open');
        $all('.menu-group.open').forEach(function (item) { item.classList.remove('open'); });
        if (!isOpen) group.classList.add('open');
    }

    function syncActiveGroup() {
        var route = currentRoute();
        $all('.menu-group').forEach(function (item) { item.classList.remove('has-active-child'); });

        var match = null;
        $all('.menu-group').some(function (menuGroup) {
            var matchedItem = $all('.menu-item', menuGroup).some(function (menuItem) {
                return routeOfHref(menuItem.getAttribute('href')) === route;
            });
            if (matchedItem) { match = menuGroup; return true; }
            return false;
        });

        if (match) {
            match.classList.add('has-active-child');
            if (!collapsed) openGroup(match, true);
        }
    }

    function closeFlyout() {
        if (activeFlyout) { activeFlyout.remove(); activeFlyout = null; }
        if (activeFlyoutHeader) { activeFlyoutHeader.classList.remove('flyout-open'); activeFlyoutHeader = null; }
    }

    function showFlyout(header) {
        closeFlyout();
        var group = header.closest('.menu-group');
        if (!group) return;
        var groupName = header.getAttribute('data-group-name') || '';
        var items = $all('.menu-item', group);
        if (!items.length) return;

        activeFlyoutHeader = header;
        header.classList.add('flyout-open');

        var route = currentRoute();
        var flyout = document.createElement('div');
        flyout.className = 'flyout-menu';
        var html = '<div class="flyout-title">' + escapeText(groupName) + '</div>';
        items.forEach(function (item) {
            var href = item.getAttribute('href') || '#';
            var label = (item.querySelector('.label') || {}).textContent || item.textContent;
            var isActive = routeOfHref(href) === route ? ' active' : '';
            html += '<a class="flyout-item' + isActive + '" href="' + href + '">' + escapeText(label.trim()) + '</a>';
        });
        flyout.innerHTML = html;
        document.body.appendChild(flyout);

        var rect = header.getBoundingClientRect();
        flyout.style.left = (rect.right + 10) + 'px';
        flyout.style.top = rect.top + 'px';

        requestAnimationFrame(function () {
            flyout.classList.add('visible');
            var fr = flyout.getBoundingClientRect();
            if (fr.bottom > window.innerHeight - 8) {
                flyout.style.top = (rect.top - (fr.bottom - window.innerHeight + 8)) + 'px';
            }
        });

        activeFlyout = flyout;

        flyout.addEventListener('click', function (event) {
            var item = event.target.closest('.flyout-item');
            if (!item) return;
            event.preventDefault();
            var href = item.getAttribute('href');
            if (href) window.location.hash = href;
            closeFlyout();
        });
    }

    function escapeText(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function setCollapsed(next) {
        collapsed = next;
        var sidebar = selectElement('#sidebar');
        if (sidebar) sidebar.classList.toggle('collapsed', collapsed);
        closeFlyout();
        closeUserPopup();
        if (!collapsed) syncActiveGroup();
    }

    function closeUserPopup() {
        var p = selectElement('#user-menu-popup');
        if (p) p.classList.remove('visible');
    }

    function setupMobile() {
        var menuBtn = selectElement('#mobile-menu-btn');
        var sidebar = selectElement('#sidebar');
        var backdrop = selectElement('#sidebar-backdrop');
        if (!menuBtn || !sidebar || !backdrop) return;
        menuBtn.addEventListener('click', function () {
            sidebar.classList.add('show');
            backdrop.classList.add('show');
        });
        backdrop.addEventListener('click', function () {
            sidebar.classList.remove('show');
            backdrop.classList.remove('show');
        });
    }

    window.setupShell = function () {
        var sidebar = selectElement('#sidebar');
        var navigationElement = selectElement('#nav');
        if (!sidebar || !navigationElement) return;

        var collapseBtn = selectElement('#collapse-btn');
        if (collapseBtn) collapseBtn.addEventListener('click', function () { setCollapsed(!collapsed); });

        navigationElement.addEventListener('click', function (event) {
            var header = event.target.closest('.accordion-header');
            if (header) {
                event.preventDefault();
                if (collapsed) {
                    if (activeFlyout && activeFlyoutHeader === header) closeFlyout();
                    else showFlyout(header);
                } else {
                    toggleGroup(header.closest('.menu-group'));
                }
                return;
            }

            if (event.target.closest('a')) {
                sidebar.classList.remove('show');
                var backdropElement = selectElement('#sidebar-backdrop');
                if (backdropElement) backdropElement.classList.remove('show');
            }
        });

        var trigger = selectElement('#user-profile-trigger');
        var popup = selectElement('#user-menu-popup');
        if (trigger && popup) {
            trigger.addEventListener('click', function (event) {
                event.stopPropagation();
                popup.classList.toggle('visible');
            });
        }

        document.addEventListener('click', function (event) {
            if (trigger && popup && !trigger.contains(event.target) && !popup.contains(event.target)) {
                popup.classList.remove('visible');
            }
            if (collapsed && activeFlyout && !activeFlyout.contains(event.target) && !event.target.closest('.accordion-header')) {
                closeFlyout();
            }
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') { closeUserPopup(); closeFlyout(); }
        });

        window.addEventListener('resize', closeFlyout);

        setupMobile();
        syncActiveGroup();
        window.addEventListener('hashchange', syncActiveGroup);
    };
})();
