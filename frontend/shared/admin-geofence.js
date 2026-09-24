document.addEventListener('DOMContentLoaded', async () => {
    const panel = document.createElement('section');
    panel.className = 'card';
    panel.style.cssText = 'padding:20px;margin:20px 0';
    panel.innerHTML = `<h2>Student field location</h2>
        <p>Set the village centre and permitted radius. Students must allow location access and be inside this area to enter and save field records. GPS accuracy must be within 100 metres and the reported accuracy circle must fit inside the boundary.</p>
        <p data-scope></p>
        <form style="display:flex;gap:16px;flex-wrap:wrap;align-items:end">
          <label>Village name<input class="form-control" name="name" required maxlength="120"></label>
          <label>Latitude<input class="form-control" name="latitude" type="number" min="-90" max="90" step="any" required></label>
          <label>Longitude<input class="form-control" name="longitude" type="number" min="-180" max="180" step="any" required></label>
          <label>Radius (metres)<input class="form-control" name="radius" type="number" min="25" max="50000" step="any" required></label>
          <button class="btn btn-primary" type="submit">Save village boundary</button>
        </form><p role="status" aria-live="polite" data-status></p>`;
    document.querySelector('main').appendChild(panel);
    const form = panel.querySelector('form');
    const status = panel.querySelector('[data-status]');
    form.onsubmit = async event => {
        event.preventDefault();
        const button = form.querySelector('button');
        button.disabled = true;
        try {
            const area = Object.fromEntries(new FormData(form));
            for (const key of ['latitude', 'longitude', 'radius']) area[key] = Number(area[key]);
            const response = await fetch('/api/admin/geofence', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(area) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to save boundary.');
            status.textContent = 'Village boundary saved. It applies to the next student location check and submission.';
        } catch (error) { status.textContent = error.message; }
        finally { button.disabled = false; }
    };
    try {
        const response = await fetch('/api/admin/geofence', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load boundary.');
        panel.querySelector('[data-scope]').textContent = `Applies to: ${data.scope}. College-specific boundaries override the default.`;
        if (data.area) for (const key of ['name', 'latitude', 'longitude', 'radius']) form.elements[key].value = data.area[key];
        else status.textContent = 'No boundary configured. Student field submissions are blocked until you save one.';
    } catch (error) { status.textContent = error.message; }
});
