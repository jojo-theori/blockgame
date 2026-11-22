import { t } from "../i18n.js";

// Shared components translate the plain-string text they are given.
export const tr = (x) => (typeof x === "string" ? t(x) : x);
