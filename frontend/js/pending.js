// Keep the live announcement outside the region marked busy.
export function pending(region, status, text) {
  const controls = [...region.querySelectorAll('button, input, select, textarea')]
    .filter(control => !control.disabled);
  controls.forEach(control => { control.disabled = true; });
  region.setAttribute('aria-busy', 'true');
  status.textContent = text;
  return () => {
    controls.forEach(control => { control.disabled = false; });
    region.removeAttribute('aria-busy');
    status.textContent = '';
  };
}
