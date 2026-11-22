// toast(text): a short word at the foot of the screen that something
// happened ("Link copied"). <Toaster /> (overlays.jsx) shows it.
let show = null;
export function toast(text) {
  show?.(text);
}
// The Toaster hands in how to show one, and takes it back when it goes.
export function onToast(fn) {
  show = fn;
}
