/**
 * MedPulse — iPhone-Style Smooth Sliding Active Nav Glider
 * Enables continuous, distance-covering active pill glide between navigation tabs.
 */
(function() {
  function getLinkMetrics(link, nav) {
    if (!link || !nav) return null;
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    // DOM rectangles include CSS zoom; absolute positioning uses local CSS pixels.
    const scale = navRect.width / parseFloat(getComputedStyle(nav).width) || 1;
    return {
      top: (linkRect.top - navRect.top) / scale + nav.scrollTop - nav.clientTop,
      left: (linkRect.left - navRect.left) / scale + nav.scrollLeft - nav.clientLeft,
      width: linkRect.width / scale,
      height: linkRect.height / scale
    };
  }

  function getOrCreateGlider(nav) {
    let glider = document.getElementById('sidebarGlider');
    if (!glider) {
      glider = document.createElement('div');
      glider.id = 'sidebarGlider';
      glider.className = 'sidebar-glider';
      nav.insertBefore(glider, nav.firstChild);
    }
    return glider;
  }

  function initGlider() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;

    const glider = getOrCreateGlider(nav);
    const activeLink = nav.querySelector('.sidebar-link.active');
    if (!activeLink) {
      glider.style.opacity = '0';
      glider.style.pointerEvents = 'none';
      return;
    }

    const targetMetrics = getLinkMetrics(activeLink, nav);
    if (!targetMetrics || targetMetrics.width === 0 || targetMetrics.height === 0) {
      requestAnimationFrame(initGlider);
      return;
    }

    const prevPosStr = sessionStorage.getItem('medpulse_glider_pos');

    if (prevPosStr) {
      try {
        const prevPos = JSON.parse(prevPosStr);
        sessionStorage.removeItem('medpulse_glider_pos');

        // Start at previous position with transition disabled
        glider.style.transition = 'none';
        glider.style.top = `${prevPos.top}px`;
        glider.style.left = `${prevPos.left}px`;
        glider.style.width = `${prevPos.width}px`;
        glider.style.height = `${prevPos.height}px`;
        glider.style.opacity = '1';

        // Force layout paint
        void glider.offsetHeight;

        // Animate smoothly to new active position (covers the physical distance)
        requestAnimationFrame(() => {
          glider.style.transition = 'top 0.44s cubic-bezier(0.25, 1, 0.35, 1), left 0.44s cubic-bezier(0.25, 1, 0.35, 1), width 0.44s cubic-bezier(0.25, 1, 0.35, 1), height 0.44s cubic-bezier(0.25, 1, 0.35, 1), opacity 0.2s ease';
          glider.style.top = `${targetMetrics.top}px`;
          glider.style.left = `${targetMetrics.left}px`;
          glider.style.width = `${targetMetrics.width}px`;
          glider.style.height = `${targetMetrics.height}px`;
        });
      } catch (e) {
        setDirect(glider, targetMetrics);
      }
    } else {
      setDirect(glider, targetMetrics);
    }

    // Attach click listeners to all links for instant sliding on click
    nav.querySelectorAll('.sidebar-link').forEach(link => {
      link.removeEventListener('click', handleLinkClick);
      link.addEventListener('click', handleLinkClick);
    });
  }

  function setDirect(glider, metrics) {
    glider.style.transition = 'none';
    glider.style.top = `${metrics.top}px`;
    glider.style.left = `${metrics.left}px`;
    glider.style.width = `${metrics.width}px`;
    glider.style.height = `${metrics.height}px`;
    glider.style.opacity = '1';
    requestAnimationFrame(() => {
      glider.style.transition = 'top 0.44s cubic-bezier(0.25, 1, 0.35, 1), left 0.44s cubic-bezier(0.25, 1, 0.35, 1), width 0.44s cubic-bezier(0.25, 1, 0.35, 1), height 0.44s cubic-bezier(0.25, 1, 0.35, 1), opacity 0.2s ease';
    });
  }

  function handleLinkClick(e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const link = this;
    const nav = document.querySelector('.sidebar-nav');
    const glider = document.getElementById('sidebarGlider');
    if (!glider || !nav) return;

    if (link.classList.contains('active')) return;

    const targetMetrics = getLinkMetrics(link, nav);
    if (!targetMetrics) return;

    // Capture the current live position of glider before moving
    const currentMetrics = getLinkMetrics(glider, nav);

    // Store departure position for destination page
    sessionStorage.setItem('medpulse_glider_pos', JSON.stringify(currentMetrics));

    // Immediately slide the glider across the distance!
    glider.style.transition = 'top 0.44s cubic-bezier(0.25, 1, 0.35, 1), left 0.44s cubic-bezier(0.25, 1, 0.35, 1), width 0.44s cubic-bezier(0.25, 1, 0.35, 1), height 0.44s cubic-bezier(0.25, 1, 0.35, 1), opacity 0.2s ease';
    glider.style.top = `${targetMetrics.top}px`;
    glider.style.left = `${targetMetrics.left}px`;
    glider.style.width = `${targetMetrics.width}px`;
    glider.style.height = `${targetMetrics.height}px`;

    // Immediately update active styling
    nav.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    const href = link.getAttribute('href');
    if (href && href !== '#' && !href.startsWith('javascript')) {
      e.preventDefault();
      // Smoothly navigate after brief visual launch
      setTimeout(() => {
        window.location.href = href;
      }, 140);
    }
  }

  function updateGlider() {
    const nav = document.querySelector('.sidebar-nav');
    const glider = document.getElementById('sidebarGlider');
    if (!nav || !glider) return;
    const activeLink = nav.querySelector('.sidebar-link.active');
    if (!activeLink) {
      glider.style.opacity = '0';
      return;
    }
    const metrics = getLinkMetrics(activeLink, nav);
    if (metrics && metrics.width > 0 && metrics.height > 0) {
      glider.style.top = `${metrics.top}px`;
      glider.style.left = `${metrics.left}px`;
      glider.style.width = `${metrics.width}px`;
      glider.style.height = `${metrics.height}px`;
      glider.style.opacity = '1';
    }
  }

  // Record mid-flight coordinate on unload if user navigates away mid-glide
  window.addEventListener('beforeunload', () => {
    const glider = document.getElementById('sidebarGlider');
    const nav = document.querySelector('.sidebar-nav');
    if (glider && nav) {
      const metrics = getLinkMetrics(glider, nav);
      if (metrics && metrics.width > 0 && metrics.height > 0) {
        sessionStorage.setItem('medpulse_glider_pos', JSON.stringify(metrics));
      }
    }
  });

  window.addEventListener('resize', updateGlider);

  if (window.ResizeObserver) {
    const nav = document.querySelector('.sidebar-nav');
    if (nav) {
      const ro = new ResizeObserver(() => updateGlider());
      ro.observe(nav);
    }
  }

  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'width') {
        updateGlider();
      }
    });
  }

  window.updateSidebarGlider = updateGlider;

  if (document.querySelector('.sidebar-nav')) {
    initGlider();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlider);
  } else {
    initGlider();
  }
})();
