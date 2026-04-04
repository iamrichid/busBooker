const adminAccessCodeInput = document.querySelector("#adminAccessCode");
const adminNameInput = document.querySelector("#adminName");
const loadBookingsButton = document.querySelector("#loadBookingsButton");
const adminMessage = document.querySelector("#adminMessage");
const template = document.querySelector("#bookingCardTemplate");

const lists = {
  approved: document.querySelector("#approvedList"),
  declined: document.querySelector("#declinedList"),
  pending: document.querySelector("#pendingList"),
};

const countNodes = {
  approved: document.querySelector("#approvedCount"),
  declined: document.querySelector("#declinedCount"),
  pending: document.querySelector("#pendingCount"),
};

adminAccessCodeInput.value = localStorage.getItem("bus-booker-admin-code") || "";
adminNameInput.value = localStorage.getItem("bus-booker-admin-name") || "";
setAdminMessage("Enter the access code to review requests.", "neutral");

loadBookingsButton.addEventListener("click", loadBookings);

async function loadBookings() {
  const adminAccessCode = adminAccessCodeInput.value.trim();
  const adminName = adminNameInput.value.trim();

  localStorage.setItem("bus-booker-admin-code", adminAccessCode);
  localStorage.setItem("bus-booker-admin-name", adminName);

  if (!adminAccessCode) {
    setAdminMessage("Please enter the admin access code.", "error");
    return;
  }

  loadBookingsButton.disabled = true;
  setAdminMessage("Loading booking requests...", "neutral");

  try {
    const response = await fetch("/api/admin/bookings", {
      headers: {
        "x-admin-key": adminAccessCode,
      },
    });
    const result = await response.json();

    if (!response.ok) {
      setAdminMessage(result.error || "Could not load requests.", "error");
      return;
    }

    renderBookings(result.bookings);
    setAdminMessage("Requests loaded successfully.", "success");
  } catch (error) {
    setAdminMessage(error.message || "The server could not be reached.", "error");
  } finally {
    loadBookingsButton.disabled = false;
  }
}

function renderBookings(bookings) {
  const groups = {
    approved: [],
    declined: [],
    pending: [],
  };

  bookings.forEach((booking) => {
    groups[booking.status]?.push(booking);
  });

  for (const status of Object.keys(groups)) {
    const target = lists[status];
    target.replaceChildren();
    countNodes[status].textContent = String(groups[status].length);

    if (groups[status].length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = `No ${status} requests right now.`;
      target.append(empty);
      continue;
    }

    groups[status].forEach((booking) => {
      target.append(buildCard(booking));
    });
  }
}

function buildCard(booking) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".booking-card");
  const meta = fragment.querySelector(".booking-meta");
  const title = fragment.querySelector("h3");
  const badge = fragment.querySelector(".status-badge");
  const details = fragment.querySelector(".booking-details");
  const decisionBlock = fragment.querySelector(".decision-block");
  const noteField = fragment.querySelector("textarea");
  const approveButton = fragment.querySelector('[data-action="approve"]');
  const declineButton = fragment.querySelector('[data-action="decline"]');

  meta.textContent = `${formatDate(booking.travelDate)} • ${formatSlot(booking)}`;
  title.textContent = booking.eventName;
  badge.textContent = booking.status;
  badge.dataset.status = booking.status;

  const detailPairs = [
    ["Member", booking.requesterName],
    ["Ministry", booking.ministryName],
    ["Email", booking.requesterEmail],
    ["Phone", booking.phone],
    ["Pickup", booking.pickupLocation],
    ["Destination", booking.destination],
    ["Passengers", String(booking.passengerCount)],
    ["Purpose", booking.purpose],
    ["Notes", booking.notes || "None"],
    ["Submitted", formatDateTime(booking.submittedAt)],
  ];

  if (booking.processedAt) {
    detailPairs.push(["Processed by", booking.processedBy || "Unknown"]);
    detailPairs.push(["Processed at", formatDateTime(booking.processedAt)]);
    detailPairs.push(["Admin note", booking.adminNotes || "None"]);
  }

  for (const [term, value] of detailPairs) {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = value;
    details.append(dt, dd);
  }

  if (booking.status !== "pending") {
    decisionBlock.remove();
    return card;
  }

  approveButton.addEventListener("click", () => processDecision(booking.id, "approved", noteField.value));
  declineButton.addEventListener("click", () => processDecision(booking.id, "declined", noteField.value));
  return card;
}

async function processDecision(id, decision, adminNotes) {
  const adminAccessCode = adminAccessCodeInput.value.trim();
  const adminName = adminNameInput.value.trim();

  if (!adminAccessCode) {
    setAdminMessage("The admin access code is required before a decision can be made.", "error");
    return;
  }

  if (!adminName) {
    setAdminMessage("Please enter the admin name for the approval record.", "error");
    return;
  }

  setAdminMessage(`Saving ${decision} decision...`, "neutral");

  try {
    const response = await fetch(`/api/admin/bookings/decision?id=${encodeURIComponent(id)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminAccessCode,
      },
      body: JSON.stringify({
        adminName,
        adminNotes,
        decision,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setAdminMessage(result.error || "The decision could not be saved.", "error");
      return;
    }

    const notificationNotes = (result.notifications?.results || [])
      .map((entry) => `${entry.channel}: ${entry.status}`)
      .join(" | ");

    setAdminMessage(
      `${result.message}${notificationNotes ? ` Notification status: ${notificationNotes}.` : ""}`,
      "success",
    );
    await loadBookings();
  } catch (error) {
    setAdminMessage(error.message || "The server could not be reached.", "error");
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatSlot(booking) {
  if (booking.bookingType === "full_day") {
    return "Full day";
  }

  return booking.timeSlot === "morning" ? "Half day • morning" : "Half day • afternoon";
}

function setAdminMessage(message, tone) {
  adminMessage.textContent = message;

  if (tone === "neutral") {
    adminMessage.removeAttribute("data-tone");
    return;
  }

  adminMessage.dataset.tone = tone;
}
