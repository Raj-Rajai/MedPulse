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

  function getStoredPatient() {
    try {
      var raw = localStorage.getItem('medpulse_patient');
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && (parsed.id || parsed.patient_uid)) {
        return parsed;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function getStoredHospitalAdmin() {
    try {
      var raw = localStorage.getItem('medpulse_hospital_admin');
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
  var isPatientPage = currentPath === '/patient.html';
  var isHospitalPage = currentPath === '/hospital.html';
  var user = getStoredUser();
  var admin = getStoredAdmin();
  var patient = getStoredPatient();
  var hospitalAdmin = getStoredHospitalAdmin();

  // 1. Anti-FOUC Route Protection
  // A) Admin page protection: requires active university faculty admin session
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

  // B) Patient portal page protection: requires active patient session
  if (isPatientPage && !patient && !admin) {
    var style = document.createElement('style');
    style.id = 'medpulse-auth-block';
    style.textContent = 'html, body { display: none !important; visibility: hidden !important; opacity: 0 !important; }';
    if (document.head) document.head.appendChild(style);
    else document.documentElement.appendChild(style);

    var patientRedirect = '/login.html?patient=1&redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(patientRedirect);
    return;
  }

  // C) Hospital Command Center protection: requires active hospital staff session
  if (isHospitalPage && !hospitalAdmin && !admin) {
    var style = document.createElement('style');
    style.id = 'medpulse-auth-block';
    style.textContent = 'html, body { display: none !important; visibility: hidden !important; opacity: 0 !important; }';
    if (document.head) document.head.appendChild(style);
    else document.documentElement.appendChild(style);

    var hospRedirect = '/login.html?hospital=1&redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(hospRedirect);
    return;
  }

  // D) Standard cadet portal pages protection: requires student user OR faculty admin
  if (!isPublicPage && !isAdminPage && !isPatientPage && !isHospitalPage && !user && !admin) {
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
    },
    getPatient: function() {
      return getStoredPatient();
    },
    setPatient: function(patientData) {
      if (patientData) {
        localStorage.setItem('medpulse_patient', JSON.stringify(patientData));
      } else {
        localStorage.removeItem('medpulse_patient');
      }
    },
    logoutPatient: function() {
      localStorage.removeItem('medpulse_patient');
      window.location.replace('/login.html?patient=1');
    },
    isPatientAuthenticated: function() {
      return !!getStoredPatient();
    },
    getHospitalAdmin: function() {
      return getStoredHospitalAdmin();
    },
    setHospitalAdmin: function(hospData) {
      if (hospData) {
        localStorage.setItem('medpulse_hospital_admin', JSON.stringify(hospData));
      } else {
        localStorage.removeItem('medpulse_hospital_admin');
      }
    },
    logoutHospitalAdmin: function() {
      localStorage.removeItem('medpulse_hospital_admin');
      window.location.replace('/login.html?hospital=1');
    },
    isHospitalAdminAuthenticated: function() {
      return !!getStoredHospitalAdmin();
    }
  };

  // Backwards-compatible aliases
  window.getMedPulseUser = window.MedPulseAuth.getUser;
  window.logoutUser = window.MedPulseAuth.logout;
  window.logoutAdmin = window.MedPulseAuth.logoutAdmin;
  window.getMedPulsePatient = window.MedPulseAuth.getPatient;
  window.logoutPatient = window.MedPulseAuth.logoutPatient;
  window.getMedPulseHospitalAdmin = window.MedPulseAuth.getHospitalAdmin;
  window.logoutHospitalAdmin = window.MedPulseAuth.logoutHospitalAdmin;

  // 3. Intercept window.fetch to automatically inject authentication headers
  if (typeof window.fetch === 'function') {
    var originalFetch = window.fetch;
    window.fetch = function(input, init) {
      init = init || {};
      var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      var activeUser = getStoredUser();
      var activeAdmin = getStoredAdmin();
      var activePatient = getStoredPatient();
      var activeHospitalAdmin = getStoredHospitalAdmin();

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
      // Inject Hospital Admin headers for /api/hospital/ calls
      else if (activeHospitalAdmin && url.indexOf('/api/hospital/') !== -1) {
        if (!headers.has('X-Hospital-Admin-Id') && activeHospitalAdmin.id) {
          headers.set('X-Hospital-Admin-Id', String(activeHospitalAdmin.id));
        }
        if (!headers.has('Authorization')) {
          headers.set('Authorization', 'Bearer hosp-' + activeHospitalAdmin.id);
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
      // Inject Patient headers for /api/patient/ or patient session calls
      else if (activePatient && (url.indexOf('/api/patient/') !== -1 || (!activeAdmin && !activeUser && !activeHospitalAdmin && url.indexOf('/api/') !== -1))) {
        if (!headers.has('X-Patient-Id') && activePatient.id) {
          headers.set('X-Patient-Id', String(activePatient.id));
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
        // Handle 401 on hospital requests
        else if (response.status === 401 && isHospitalPage) {
          console.warn('[MedPulse Auth] Hospital session expired. Redirecting to hospital login.');
          localStorage.removeItem('medpulse_hospital_admin');
          window.location.replace('/login.html?hospital=1&session_expired=1');
        }
        // Handle 401 on patient requests
        else if (response.status === 401 && isPatientPage) {
          console.warn('[MedPulse Auth] Patient session expired. Redirecting to patient login.');
          localStorage.removeItem('medpulse_patient');
          window.location.replace('/login.html?patient=1&session_expired=1');
        }
        // Handle 401 on student requests
        else if (response.status === 401 && !isPublicPage && !isAdminPage && !isPatientPage && !isHospitalPage && url.indexOf('/api/auth/login') === -1) {
          console.warn('[MedPulse Auth] Session invalidated or unauthorized. Redirecting to login.');
          localStorage.removeItem('medpulse_user');
          window.location.replace('/login.html?session_expired=1');
        }
        return response;
      });
    };
  }

  // Gracefully handle HTML error responses for all res.json() calls across the entire app
  if (typeof Response !== 'undefined' && Response.prototype && Response.prototype.json) {
    var nativeJson = Response.prototype.json;
    Response.prototype.json = async function() {
      try {
        return await nativeJson.call(this);
      } catch (err) {
        if (err && err.name === 'SyntaxError' && (err.message.indexOf('Unexpected token') !== -1 || err.message.indexOf('is not valid JSON') !== -1)) {
          var status = this.status;
          var statusText = this.statusText || '';
          if (status === 404) {
            throw new Error('API endpoint not found (HTTP 404). If you just added new routes or features, please restart your server process.');
          } else if (status >= 500) {
            throw new Error('Server error (HTTP ' + status + '). The server returned an HTML error page instead of JSON.');
          } else {
            throw new Error('Server returned an unexpected HTML page instead of JSON (HTTP ' + status + ' ' + statusText + '). Please restart your server process.');
          }
        }
        throw err;
      }
    };
  }

  // 4. Universal Sidebar User Badge Initializer
  function renderSidebarUserBadge() {
    var authArea = document.getElementById('authNavArea');
    if (!authArea) return;

    var currentAdmin = getStoredAdmin();
    var currentUser = getStoredUser();
    var currentPatient = getStoredPatient();
    var currentHospitalAdmin = getStoredHospitalAdmin();

    // If on hospital.html or if only hospital admin is logged in
    if (isHospitalPage || (currentHospitalAdmin && !currentUser && !currentAdmin && !currentPatient)) {
      if (currentHospitalAdmin) {
        var hName = currentHospitalAdmin.name || currentHospitalAdmin.username;
        var hRole = currentHospitalAdmin.role || 'Hospital Staff';
        var hHosp = currentHospitalAdmin.hospital_name || 'Civil Hospital';
        authArea.innerHTML = [
          '<div class="sidebar-user" style="border-color: rgba(13, 148, 136, 0.35); background: rgba(13, 148, 136, 0.08);" data-tooltip="' + hName + '" onclick="if(document.documentElement.classList.contains(\'sidebar-collapsed\')||document.body.classList.contains(\'sidebar-collapsed\')) window.logoutHospitalAdmin(); else window.location.href=\'/hospital.html\';" title="' + hName + ' (' + hRole + ' - ' + hHosp + ')">',
          '  <div class="user-avatar-badge" style="background: linear-gradient(135deg, #0d9488, #0f766e); color: #fff;">',
          '    🏥',
          '    <span class="role-dot" style="background: #2dd4bf; box-shadow: 0 0 8px #2dd4bf;" title="Active Hospital Session"></span>',
          '  </div>',
          '  <div class="user-info-text">',
          '    <span style="font-size: 0.72rem; color: #5eead4; font-weight: 700; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">' + hRole + '</span>',
          '    <span style="font-weight: 750; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;" title="' + hName + '">' + hName + '</span>',
          '  </div>',
          '  <button class="logout-btn" onclick="event.stopPropagation(); window.logoutHospitalAdmin();" title="Sign Out Hospital Staff">',
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
          '<a href="/login.html?hospital=1" class="sidebar-login-link" title="Hospital Sign In">',
          '  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
          '    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>',
          '    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
          '  </svg>',
          '  <span class="login-label">Hospital Sign In</span>',
          '</a>'
        ].join('\n');
      }
      return;
    }

    // If on patient.html or if only patient is logged in
    if (isPatientPage || (currentPatient && !currentUser && !currentAdmin)) {
      if (currentPatient) {
        var pName = currentPatient.name || currentPatient.patient_uid;
        var pModel = currentPatient.model_type || 'Patient';
        authArea.innerHTML = [
          '<div class="sidebar-user" style="border-color: rgba(14, 165, 233, 0.35); background: rgba(14, 165, 233, 0.08);" data-tooltip="' + pName + '" onclick="if(document.documentElement.classList.contains(\'sidebar-collapsed\')||document.body.classList.contains(\'sidebar-collapsed\')) window.logoutPatient(); else window.location.href=\'/patient.html\';" title="' + pName + ' (' + pModel + ')">',
          '  <div class="user-avatar-badge" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff;">',
          '    🏥',
          '    <span class="role-dot" style="background: #38bdf8; box-shadow: 0 0 8px #38bdf8;" title="Active Patient Session"></span>',
          '  </div>',
          '  <div class="user-info-text">',
          '    <span style="font-size: 0.72rem; color: #7dd3fc; font-weight: 700; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">' + pModel + '</span>',
          '    <span style="font-weight: 750; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;" title="' + pName + '">' + pName + '</span>',
          '  </div>',
          '  <button class="logout-btn" onclick="event.stopPropagation(); window.logoutPatient();" title="Sign Out Patient">',
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
          '<a href="/login.html?patient=1" class="sidebar-login-link" title="Patient Sign In">',
          '  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
          '    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>',
          '    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
          '  </svg>',
          '  <span class="login-label">Patient Sign In</span>',
          '</a>'
        ].join('\n');
      }
      return;
    }

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
