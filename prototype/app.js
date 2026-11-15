(() => {
 'use strict';
 const devices = window.SIM_DEVICE_PREVIEW;
 if (!Array.isArray(devices) || !devices.length) return;
 const picker = document.querySelector('.device-picker');
 picker.hidden = false;
 picker.querySelectorAll('[data-device]').forEach(button => {
  button.addEventListener('click', () => {
   const device = devices[Number(button.dataset.device)];
   if (!device) return;
   picker.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
   document.getElementById('device-title').textContent = device.name;
   document.getElementById('device-lead').textContent = device.paragraphs[0];
   const image = document.getElementById('device-image');
   image.className = `device-art scene-${device.imageIndex}`;
   image.setAttribute('aria-label', `${device.name} — пример внешнего вида`);
   const content = document.getElementById('device-full');
   content.replaceChildren();
   device.paragraphs.slice(1).forEach(text => { const p = document.createElement('p'); p.textContent = text; content.append(p); });
  });
 });
})();
