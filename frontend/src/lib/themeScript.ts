/**
 * The theme decision from lib/theme.ts, as a string the root layout inlines
 * in the head. It runs before the first paint, so a dark page never flashes
 * white. Kept out of theme.ts because that module is client-only and the
 * layout is a server component.
 */
export const THEME_BOOT_SCRIPT =
  'try{var t=localStorage.getItem("signal-theme");' +
  'if(t!=="light"&&t!=="dark"&&t!=="system")t="dark";' +
  'if(t!=="system")document.documentElement.setAttribute("data-theme",t)}' +
  'catch(e){document.documentElement.setAttribute("data-theme","dark")}';
