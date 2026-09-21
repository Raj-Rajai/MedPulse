/**
 * MedPulse Universal Authentication & Route Guard
 * Enforces zero-trust page access, session management, and automated API authentication headers.
 */
(function() {
  'use strict';

  var PUBLIC_PATHS = ['/login.html', '/register.html'];

  function normalizePath(pathname) {
    if (!pathname || pathname === '/') return '/index.html';
    // Remove query / hash / trailing slashes if present
    var clean = pathname.split('?')[0].split('#')[0];
    if (clean === '' || clean === '/') return '/index.html';
    return clean;
  }

  function getStoredUser() {
    try {
      var raw = localStorage.getItem('medpulse_user');
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && (parsed.id || parsed.roll_number)) {
        return parsed;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function getStoredAdmin() {
    try {
      var raw = localStorage.getItem('medpulse_admin');
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && (parsed.id || parsed.username)) {
        return parsed;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  var currentPath = normalizePath(window.location.pathname);
  var isPublicPage = PUBLIC_PATHS.indexOf(currentPath) !== -1;
  var isAdminPage = currentPath === '/admin.html';
  var user = getStoredUser();
  var admin = getStoredAdmin();

  // 1. Anti-FOUC Route Protection
  // A) Admin page protection: requires active admin session
  if (isAdminPage && !admin) {
    var style = document.createElement('style');
    style.id = 'medpulse-auth-block';
    style.textContent = 'html, body { display: none !important; visibility: hidden !important; opacity: 0 !important; }';
    if (document.head) document.head.appendChild(style);
    else document.documentElement.appendChild(style);

    var adminRedirect = '/login.html?admin=1&redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(adminRedirect);
    return;
  }

  // B) Standard portal pages protection: requires student user OR faculty admin
  if (!isPublicPage && !isAdminPage && !user && !admin) {
    var style = document.createElement('style');
    style.id = 'medpulse-auth-block';
    style.textContent = 'html, body { display: none !important; visibility: hidden !important; opacity: 0 !important; }';
    if (document.head) document.head.appendChild(style);
    else document.documentElement.appendChild(style);

    var redirectUrl = '/login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(redirectUrl);
    return;
  }

  // 2. Expose Global Helpers
  window.MedPulseAuth = {
    getUser: function() {
      return getStoredUser();
    },
    setUser: function(userData) {
      if (userData) {
        localStorage.setItem('medpulse_user', JSON.stringify(userData));
      } else {
        localStorage.removeItem('medpulse_user');
      }
    },
    logout: function() {
      localStorage.removeItem('medpulse_user');
      window.location.replace('/login.html');
    },
    isAuthenticated: function() {
      return !!getStoredUser();
    },
    getAdmin: function() {
      return getStoredAdmin();
    },
    setAdmin: function(adminData) {
      if (adminData) {
        localStorage.setItem('medpulse_admin', JSON.stringify(adminData));
      } else {
        localStorage.removeItem('medpulse_admin');
      }
    },
    logoutAdmin: function() {
      localStorage.removeItem('medpulse_admin');
      window.location.replace('/login.html?admin=1');
    },
    isAdminAuthenticated: function() {
      return !!getStoredAdmin();
    }
  };

  // Backwards-compatible aliases
  window.getMedPulseUser = window.MedPulseAuth.getUser;
  window.logoutUser = window.MedPulseAuth.logout;
  window.logoutAdmin = window.MedPulseAuth.logoutAdmin;

  // 3. Intercept window.fetch to automatically inject authentication headers
  if (typeof window.fetch === 'function') {
    var originalFetch = window.fetch;
    window.fetch = function(input, init) {
      init = init || {};
      var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      var activeUser = getStoredUser();
      var activeAdmin = getStoredAdmin();

      // Create or copy headers
      var headers;
      if (init.headers instanceof Headers) {
        headers = new Headers(init.headers);
      } else if (Array.isArray(init.headers)) {
        headers = new Headers(init.headers);
      } else {
        headers = new Headers(Object.assign({}, init.headers));
      }

      // Inject Admin headers for /api/admin/ calls
      if (activeAdmin && url.indexOf('/api/admin/') !== -1) {
        if (!headers.has('X-Admin-Id') && activeAdmin.id) {
          headers.set('X-Admin-Id', String(activeAdmin.id));
        }
        if (!headers.has('X-Admin-Token')) {
          headers.set('X-Admin-Token', 'admin-' + activeAdmin.id);
        }
        init.headers = headers;
      }
      // Inject Student headers for standard /api/ calls
      else if (activeUser && (url.indexOf('/api/') !== -1 || (typeof input === 'string' && input.indexOf('/api/') !== -1))) {
        if (!headers.has('X-Student-Id') && activeUser.id) {
          headers.set('X-Student-Id', String(activeUser.id));
        }
        if (!headers.has('X-Roll-Number') && activeUser.roll_number) {
          headers.set('X-Roll-Number', String(activeUser.roll_number));
        }
        init.headers = headers;
      }

      return originalFetch.call(this, input, init).then(function(response) {
        // Handle 401 on admin requests
        if (response.status === 401 && url.indexOf('/api/admin/') !== -1 && url.indexOf('/api/admin/login') === -1) {
          console.warn('[MedPulse Auth] Admin session expired or invalid. Redirecting to admin login.');
          localStorage.removeItem('medpulse_admin');
          if (isAdminPage) {
            window.location.replace('/login.html?admin=1&session_expired=1');
          }
        }
        // Handle 401 on student requests
        else if (response.status === 401 && !isPublicPage && !isAdminPage && url.indexOf('/api/auth/login') === -1) {
          console.warn('[MedPulse Auth] Session invalidated or unauthorized. Redirecting to login.');
          localStorage.removeItem('medpulse_user');
          window.location.replace('/login.html?session_expired=1');
        }
        return response;
      });
    };
  }

  // 4. Universal Sidebar User Badge Initializer
  function renderSidebarUserBadge() {
    var authArea = document.getElementById('authNavArea');
    if (!authArea) return;

    var currentAdmin = getStoredAdmin();
    var currentUser = getStoredUser();

    // If on admin.html or if only admin is logged in
    if (isAdminPage || (currentAdmin && !currentUser)) {
      if (currentAdmin) {
        var adminName = currentAdmin.name || 'Faculty Administrator';
        var adminRole = currentAdmin.role || 'Super Admin';

        authArea.innerHTML = [
          '<div class="sidebar-user" style="border-color: rgba(234, 179, 8, 0.35); background: rgba(234, 179, 8, 0.08);" data-tooltip="Admin (' + adminName + ')" onclick="handleSidebarAdminClick(event)" title="' + adminName + ' (' + adminRole + ')">',
          '  <div class="user-avatar-badge" style="background: linear-gradient(135deg, #eab308, #ca8a04); color: #000;">',
          '    👑',
          '    <span class="role-dot" style="background: #eab308; box-shadow: 0 0 8px #eab308;" title="Active Faculty Session"></span>',
          '  </div>',
          '  <div class="user-info-text">',
          '    <span style="font-size: 0.72rem; color: #fde047; font-weight: 700; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">' + adminRole + '</span>',
          '    <span style="font-weight: 750; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;" title="' + adminName + '">' + adminName + '</span>',
          '  </div>',
          '  <button class="logout-btn" onclick="event.stopPropagation(); window.logoutAdmin();" title="Sign Out Admin">',
          '    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
          '      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
          '      <polyline points="16 17 21 12 16 7"/>',
          '      <line x1="21" y1="12" x2="9" y2="12"/>',
          '    </svg>',
          '  </button>',
          '</div>'
        ].join('\n');
      } else {
        authArea.innerHTML = [
          '<a href="/login.html?admin=1" class="sidebar-login-link" title="Faculty Sign In">',
          '  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
          '    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>',
          '    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
          '  </svg>',
          '  <span class="login-label">Admin Sign In</span>',
          '</a>'
        ].join('\n');
      }
      return;
    }

    // Otherwise standard student badge
    if (currentUser) {
      var displayName = currentUser.name || ('Roll ' + currentUser.roll_number);
      var displayRole = currentUser.batch_year ? currentUser.batch_year.split(' ')[0] + ' MBBS' : 'Medical Cadet';
      var rollNum = currentUser.roll_number || '235';

      authArea.innerHTML = [
        '<div class="sidebar-user" data-tooltip="Roll ' + rollNum + ' (' + displayName + ')" onclick="handleSidebarUserClick(event)" title="' + displayName + ' (Roll ' + rollNum + ')">',
        '  <div class="user-avatar-badge">',
        '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
        '      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>',
        '      <circle cx="12" cy="7" r="4"/>',
        '    </svg>',
        '    <span class="role-dot" title="Active Cadet Session"></span>',
        '  </div>',
        '  <div class="user-info-text">',
        '    <span style="font-size: 0.72rem; color: rgba(255,255,255,0.55); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">' + displayRole + '</span>',
        '    <span style="font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;" title="' + displayName + '">Roll ' + rollNum + '</span>',
        '  </div>',
        '  <button class="logout-btn" onclick="event.stopPropagation(); window.logoutUser();" title="Sign Out">',
        '    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
        '      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
        '      <polyline points="16 17 21 12 16 7"/>',
        '      <line x1="21" y1="12" x2="9" y2="12"/>',
        '    </svg>',
        '  </button>',
        '</div>'
      ].join('\n');
    } else {
      authArea.innerHTML = [
        '<a href="/login.html" class="sidebar-login-link" title="Sign In">',
        '  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
        '    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>',
        '    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        '  </svg>',
        '  <span class="login-label">Sign In</span>',
        '</a>'
      ].join('\n');
    }
  }

  window.handleSidebarUserClick = function(event) {
    var isCollapsed = document.documentElement.classList.contains('sidebar-collapsed') ||
                       document.body.classList.contains('sidebar-collapsed');
    if (isCollapsed) {
      window.logoutUser();
    } else {
      window.location.href = '/profile.html';
    }
  };

  window.handleSidebarAdminClick = function(event) {
    var isCollapsed = document.documentElement.classList.contains('sidebar-collapsed') ||
                       document.body.classList.contains('sidebar-collapsed');
    if (isCollapsed) {
      window.logoutAdmin();
    } else {
      window.location.href = '/admin.html';
    }
  };

  window.refreshSidebarUser = renderSidebarUserBadge;

  // Auto-render on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSidebarUserBadge);
  } else {
    renderSidebarUserBadge();
  }
})();
