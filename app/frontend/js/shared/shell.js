(function () {
    var collapsed = false;
    var activeFlyout = null;
    var activeFlyoutHeader = null;

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    function currentRoute() {
        var h = (window.location.hash || '').replace(/^#\/?/, '');
        return (h.split('?')[0] || (window.CONFIG && window.CONFIG.ROUTES.DEFAULT) || 'dashboard');
    }

    function routeOfHref(href) {
        if (!href) return '';
        return href.replace(/^#\/?/, '').split('?')[0];
    }

    function openGroup(group, exclusive) {
        if (!group) return;
        if (exclusive) {
            $all('.menu-group.open').forEach(function (g) { if (g !== group) g.classList.remove('open'); });
        }
        group.classList.add('open');
    }

    function toggleGroup(group) {
        if (!group) return;
        var isOpen = group.classList.contains('open');
        $all('.menu-group.open').forEach(function (g) { g.classList.remove('open'); });
        if (!isOpen) group.classList.add('open');
    }

    function syncActiveGroup() {
        var route = currentRoute();
        $all('.menu-group').forEach(function (g) { g.classList.remove('has-active-child'); });

        var match = null;
        $all('.menu-group').some(function (g) {
            var hit = $all('.menu-item', g).some(function (it) {
                return routeOfHref(it.getAttribute('href')) === route;
            });
            if (hit) { match = g; return true; }
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
        items.forEach(function (it) {
            var href = it.getAttribute('href') || '#';
            var label = (it.querySelector('.label') || {}).textContent || it.textContent;
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

        flyout.addEventListener('click', function (e) {
            var item = e.target.closest('.flyout-item');
            if (!item) return;
            e.preventDefault();
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
        var sidebar = $('#sidebar');
        if (sidebar) sidebar.classList.toggle('collapsed', collapsed);
        closeFlyout();
        closeUserPopup();
        if (!collapsed) syncActiveGroup();
    }

    function closeUserPopup() {
        var p = $('#user-menu-popup');
        if (p) p.classList.remove('visible');
    }

    function setupMobile() {
        var menuBtn = $('#mobile-menu-btn');
        var sidebar = $('#sidebar');
        var backdrop = $('#sidebar-backdrop');
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
        var sidebar = $('#sidebar');
        var nav = $('#nav');
        if (!sidebar || !nav) return;

        var collapseBtn = $('#collapse-btn');
        if (collapseBtn) collapseBtn.addEventListener('click', function () { setCollapsed(!collapsed); });

        nav.addEventListener('click', function (e) {
            var header = e.target.closest('.accordion-header');
            if (header) {
                e.preventDefault();
                if (collapsed) {
                    if (activeFlyout && activeFlyoutHeader === header) closeFlyout();
                    else showFlyout(header);
                } else {
                    toggleGroup(header.closest('.menu-group'));
                }
                return;
            }

            if (e.target.closest('a')) {
                sidebar.classList.remove('show');
                var bd = $('#sidebar-backdrop');
                if (bd) bd.classList.remove('show');
            }
        });

        var trigger = $('#user-profile-trigger');
        var popup = $('#user-menu-popup');
        if (trigger && popup) {
            trigger.addEventListener('click', function (e) {
                e.stopPropagation();
                popup.classList.toggle('visible');
            });
        }

        document.addEventListener('click', function (e) {
            if (trigger && popup && !trigger.contains(e.target) && !popup.contains(e.target)) {
                popup.classList.remove('visible');
            }
            if (collapsed && activeFlyout && !activeFlyout.contains(e.target) && !e.target.closest('.accordion-header')) {
                closeFlyout();
            }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { closeUserPopup(); closeFlyout(); }
        });

        window.addEventListener('resize', closeFlyout);

        setupMobile();
        syncActiveGroup();
        window.addEventListener('hashchange', syncActiveGroup);
    };
})();
