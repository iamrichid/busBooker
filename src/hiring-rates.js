/**
 * Church bus hiring rates (Accra base → destination).
 * Source: Christ Congregation Adenta — BUS HIRING RATES.xlsx
 * Active rates load from storage at startup; admins may update GH¢ / km via the admin desk.
 */

import { readHiringRatesDocument } from "./storage.js";

export const HIRING_ORIGIN = {
  id: "accra",
  label: "Accra (church bus base)",
};

/** Canonical defaults (ids, labels, groups). Admins may only change numeric rate and km. */
export const DEFAULT_HIRING_ROUTES = [
  { id: "accra-local", group: "Greater Accra & vicinity", label: "Accra (within Greater Accra)", km: null, rateGhs: 900 },
  { id: "tema", group: "Greater Accra & vicinity", label: "Tema", km: 26, rateGhs: 1000 },
  { id: "ningo-prampram", group: "Greater Accra & vicinity", label: "Ningo Prampram", km: 41, rateGhs: 1000 },
  { id: "ada", group: "Greater Accra & vicinity", label: "Ada", km: 98, rateGhs: 2000 },
  { id: "akosombo", group: "Greater Accra & vicinity", label: "Akosombo", km: 64, rateGhs: 1500 },
  { id: "sogakope", group: "Greater Accra & vicinity", label: "Sogakope", km: 82, rateGhs: 2000 },
  { id: "keta", group: "Volta Region", label: "Keta", km: 103, rateGhs: 2000 },
  { id: "ho", group: "Volta Region", label: "Ho", km: 139, rateGhs: 2400 },
  { id: "hohoe", group: "Volta Region", label: "Hohoe", km: 139, rateGhs: 2400 },
  { id: "afadzato", group: "Volta Region", label: "Afadzato", km: 166, rateGhs: 2500 },
  { id: "somanya", group: "Volta Region", label: "Somanya", km: 193, rateGhs: 2800 },
  { id: "aflao", group: "Volta Region", label: "Aflao", km: 176, rateGhs: 2800 },
  { id: "aburi", group: "Eastern Region", label: "Aburi", km: 32, rateGhs: 1000 },
  { id: "mamfe", group: "Eastern Region", label: "Mamfe", km: 43, rateGhs: 1000 },
  { id: "akropong", group: "Eastern Region", label: "Akropong", km: 48, rateGhs: 1000 },
  { id: "adukrom", group: "Eastern Region", label: "Adukrom", km: 52, rateGhs: 1500 },
  { id: "koforidua", group: "Eastern Region", label: "Koforidua", km: 59, rateGhs: 1500 },
  { id: "begoro", group: "Eastern Region", label: "Begoro", km: 59, rateGhs: 1500 },
  { id: "suhum", group: "Eastern Region", label: "Suhum", km: 93, rateGhs: 2000 },
  { id: "bunso", group: "Eastern Region", label: "Bunso", km: null, rateGhs: 2000 },
  { id: "nkawkaw", group: "Eastern Region", label: "Nkawkaw", km: 124, rateGhs: 2400 },
  { id: "konongo", group: "Ashante Region", label: "Konongo", km: 160, rateGhs: 2500 },
  { id: "kumasi", group: "Ashante Region", label: "Kumasi", km: 202, rateGhs: 3000 },
  { id: "obuasi", group: "Ashante Region", label: "Obuasi", km: 175, rateGhs: 2800 },
  { id: "kasoa", group: "Central Region", label: "Kasoa", km: 22, rateGhs: 1000 },
  { id: "winneba", group: "Central Region", label: "Winneba", km: 51, rateGhs: 1500 },
  { id: "apam", group: "Central Region", label: "Apam", km: 64, rateGhs: 1500 },
  { id: "mankesim", group: "Central Region", label: "Mankesim", km: 68, rateGhs: 1600 },
  { id: "capecoast", group: "Central Region", label: "Cape Coast", km: 126, rateGhs: 2400 },
];

function cloneDefaultRoutes() {
  return JSON.parse(JSON.stringify(DEFAULT_HIRING_ROUTES));
}

let activeRoutes = cloneDefaultRoutes();
let routeById = new Map(activeRoutes.map((route) => [route.id, route]));

function setActiveHiringRoutes(routes) {
  activeRoutes = routes;
  routeById = new Map(routes.map((route) => [route.id, route]));
}

export function getHiringRouteById(id) {
  return routeById.get(String(id || "").trim()) || null;
}

export function listHiringRatesForApi() {
  return {
    origin: HIRING_ORIGIN,
    routes: activeRoutes.map(({ id, group, label, km, rateGhs }) => ({ id, group, label, km, rateGhs })),
  };
}

/**
 * Merge admin-submitted rows with canonical defaults (only rateGhs / km are taken from input).
 * @returns {{ ok: boolean, errors: Record<string, string>, routes: typeof DEFAULT_HIRING_ROUTES | null }}
 */
export function mergeHiringRatesSubmission(routesInput) {
  const errors = {};

  if (!Array.isArray(routesInput)) {
    return { ok: false, errors: { routes: "Expected a routes array." }, routes: null };
  }

  const byId = new Map(routesInput.map((row) => [String(row?.id || "").trim(), row]));

  for (const def of DEFAULT_HIRING_ROUTES) {
    const sub = byId.get(def.id);
    if (!sub) {
      errors[`missing_${def.id}`] = "Missing row.";
      continue;
    }

    const rateGhs = Number.parseInt(String(sub.rateGhs), 10);
    if (!Number.isInteger(rateGhs) || rateGhs < 1 || rateGhs > 9_999_999) {
      errors[`rate_${def.id}`] = "Use a whole number between 1 and 9,999,999.";
    }

    const kmRaw = sub.km;
    if (kmRaw !== undefined && kmRaw !== null && String(kmRaw).trim() !== "") {
      const kmNum = Number.parseInt(String(kmRaw), 10);
      if (!Number.isInteger(kmNum) || kmNum < 0 || kmNum > 3000) {
        errors[`km_${def.id}`] = "Use 0–3000 km, or leave blank for the default.";
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, routes: null };
  }

  const normalized = DEFAULT_HIRING_ROUTES.map((def) => {
    const sub = byId.get(def.id);
    const rateGhs = Number.parseInt(String(sub.rateGhs), 10);
    let km = def.km;
    const kmRaw = sub.km;
    if (kmRaw !== undefined && kmRaw !== null && String(kmRaw).trim() !== "") {
      km = Number.parseInt(String(kmRaw), 10);
    }

    return { ...def, rateGhs, km };
  });

  return { ok: true, errors: {}, routes: normalized };
}

export function resetActiveHiringRatesToDefault() {
  setActiveHiringRoutes(cloneDefaultRoutes());
}

export async function loadHiringRatesAtStartup() {
  try {
    const doc = await readHiringRatesDocument();
    if (doc?.routes?.length) {
      const merged = mergeHiringRatesSubmission(doc.routes);
      if (merged.ok && merged.routes) {
        setActiveHiringRoutes(merged.routes);
        return;
      }
    }
  } catch (error) {
    console.warn("Could not load hiring rates; using defaults.", error);
  }

  resetActiveHiringRatesToDefault();
}

/** Apply routes already validated (e.g. after save). */
export function applyHiringRatesSnapshot(routes) {
  setActiveHiringRoutes(JSON.parse(JSON.stringify(routes)));
}
