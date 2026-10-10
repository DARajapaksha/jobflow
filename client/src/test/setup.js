import '@testing-library/jest-dom/vitest';

// jsdom does not implement the native <dialog> methods that our Modal uses
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ||= function showModal() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ||= function close() { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
}
