import { hasScheduleConflict } from "./bookings.js";

const defaultFleet = [
  {
    id: "church-bus-1",
    label: "Church Bus",
    number: "PCG-001",
  },
];

export function getFleet() {
  const source = String(process.env.BUS_FLEET || "").trim();

  if (!source) {
    return defaultFleet;
  }

  const fleet = source
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const [labelPart, numberPart] = entry.split("|").map((part) => part.trim());
      const label = labelPart || `Church Bus ${index + 1}`;
      const number = numberPart || `PCG-${String(index + 1).padStart(3, "0")}`;

      return {
        id: slugify(`${label}-${number}`),
        label,
        number,
      };
    });

  return fleet.length > 0 ? fleet : defaultFleet;
}

export function findVehicleById(vehicleId, fleet = getFleet()) {
  return fleet.find((vehicle) => vehicle.id === vehicleId) || null;
}

export function getAvailableVehicles(bookings, candidate, fleet = getFleet(), options = {}) {
  const excludeId = options.excludeId || null;

  return fleet.filter((vehicle) => {
    return !bookings.some((booking) => {
      if (booking.id === excludeId) {
        return false;
      }

      if (booking.status !== "approved") {
        return false;
      }

      if (!hasScheduleConflict(booking, candidate)) {
        return false;
      }

      // Older approved records may not have a vehicle assignment yet.
      // We conservatively treat them as occupying the slot until an admin reassigns them.
      if (!booking.assignedVehicleId) {
        return true;
      }

      return booking.assignedVehicleId === vehicle.id;
    });
  });
}

export function getVehicleDisplay(vehicle) {
  return `${vehicle.label} (${vehicle.number})`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
