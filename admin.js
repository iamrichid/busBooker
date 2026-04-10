const adminAccessCodeInput = document.querySelector("#adminAccessCode");
const adminNameInput = document.querySelector("#adminName");
const signInForm = document.querySelector("#adminSignInForm");
const signInButton = document.querySelector("#signInButton");
const refreshBookingsButton = document.querySelector("#refreshBookingsButton");
const logoutButton = document.querySelector("#logoutButton");
const adminMessage = document.querySelector("#adminMessage");
const authPanel = document.querySelector("#authPanel");
const adminWorkspace = document.querySelector("#adminWorkspace");
const activeAdminName = document.querySelector("#activeAdminName");
const requestTableBody = document.querySelector("#requestTableBody");
const requestTableCount = document.querySelector("#requestTableCount");
const rowTemplate = document.querySelector("#requestRowTemplate");

const requestModal = document.querySelector("#requestModal");
const requestModalTitle = document.querySelector("#requestModalTitle");
const requestModalMeta = document.querySelector("#requestModalMeta");
const requestModalDetails = document.querySelector("#requestModalDetails");
const requestModalDecisionPanel = document.querySelector("#requestModalDecisionPanel");
const requestModalProcessedPanel = document.querySelector("#requestModalProcessedPanel");
const requestModalProcessedText = document.querySelector("#requestModalProcessedText");
const requestModalVehicleSelect = document.querySelector("#requestModalVehicleSelect");
const requestModalVehicleError = document.querySelector("#requestModalVehicleError");
const requestModalAdminNote = document.querySelector("#requestModalAdminNote");
const requestModalApproveButton = document.querySelector("#requestModalApproveButton");
const requestModalDeclineButton = document.querySelector("#requestModalDeclineButton");
const closeRequestModalButton = document.querySelector("#closeRequestModalButton");

const summaryNodes = {
  approved: document.querySelector("#summaryApproved"),
  declined: document.querySelector("#summaryDeclined"),
  pending: document.querySelector("#summaryPending"),
};

const state = {
  adminCode: localStorage.getItem("bus-booker-admin-code") || "",
  adminName: localStorage.getItem("bus-booker-admin-name") || "",
  authenticated: false,
  fleet: [],
  bookings: [],
  activeBookingId: null,
};

adminAccessCodeInput.value = state.adminCode;
adminNameInput.value = state.adminName;
setAdminMessage("Sign in to open the approval desk.", "neutral");

signInForm.addEventListener("submit", handleSignIn);
refreshBookingsButton?.addEventListener("click", () => loadBookings());
logoutButton?.addEventListener("click", logout);
closeRequestModalButton?.addEventListener("click", closeRequestModal);
requestModalApproveButton?.addEventListener("click", () => submitModalDecision("approved"));
requestModalDeclineButton?.addEventListener("click", () => submitModalDecision("declined"));

if (requestModal) {
  requestModal.addEventListener("click", (event) => {
    if (event.target === requestModal) {
      closeRequestModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && requestModal?.open) {
    closeRequestModal();
  }
});

if (state.adminCode && state.adminName) {
  signIn({ restoreSession: true });
}

async function handleSignIn(event) {
  event.preventDefault();
  await signIn();
}

async function signIn({ restoreSession = false } = {}) {
  const adminCode = adminAccessCodeInput.value.trim();
  const adminName = adminNameInput.value.trim();

  if (!adminCode) {
    setAdminMessage("Please enter the admin access code.", "error");
    return;
  }

  if (!adminName) {
    setAdminMessage("Please enter the admin name for this session.", "error");
    return;
  }

  setAuthBusy(true);
  setAdminMessage(restoreSession ? "Restoring admin session..." : "Signing in...", "neutral");

  try {
    const response = await fetch("/api/admin/bookings", {
      headers: {
        "x-admin-key": adminCode,
      },
    });
    const result = await response.json();

    if (!response.ok) {
      setAdminMessage(result.error || "Could not sign in to the approval desk.", "error");

      if (restoreSession) {
        clearStoredSession();
      }
      return;
    }

    state.adminCode = adminCode;
    state.adminName = adminName;
    state.authenticated = true;
    state.fleet = result.fleet || [];
    state.bookings = result.bookings || [];

    localStorage.setItem("bus-booker-admin-code", adminCode);
    localStorage.setItem("bus-booker-admin-name", adminName);

    authPanel.hidden = true;
    adminWorkspace.hidden = false;
    activeAdminName.textContent = adminName;
    renderBookings(state.bookings);
    setAdminMessage(`Signed in as ${adminName}.`, "success");
  } catch (error) {
    setAdminMessage(error.message || "The server could not be reached.", "error");
  } finally {
    setAuthBusy(false);
  }
}

async function loadBookings() {
  if (!state.authenticated) {
    return;
  }

  refreshBookingsButton.disabled = true;
  setAdminMessage("Refreshing booking requests...", "neutral");

  try {
    const response = await fetch("/api/admin/bookings", {
      headers: {
        "x-admin-key": state.adminCode,
      },
    });
    const result = await response.json();

    if (!response.ok) {
      setAdminMessage(result.error || "Could not load requests.", "error");
      return;
    }

    state.fleet = result.fleet || [];
    state.bookings = result.bookings || [];
    renderBookings(state.bookings);
    setAdminMessage("Requests loaded successfully.", "success");

    if (state.activeBookingId) {
      const activeBooking = state.bookings.find((booking) => booking.id === state.activeBookingId);

      if (activeBooking) {
        openRequestModal(activeBooking.id);
      } else {
        closeRequestModal();
      }
    }
  } catch (error) {
    setAdminMessage(error.message || "The server could not be reached.", "error");
  } finally {
    refreshBookingsButton.disabled = false;
  }
}

function logout() {
  clearStoredSession();
  state.adminCode = "";
  state.adminName = "";
  state.authenticated = false;
  state.fleet = [];
  state.bookings = [];
  state.activeBookingId = null;

  adminAccessCodeInput.value = "";
  adminNameInput.value = "";
  authPanel.hidden = false;
  adminWorkspace.hidden = true;
  activeAdminName.textContent = "";
  requestTableBody.replaceChildren();
  requestTableCount.textContent = "0";
  Object.values(summaryNodes).forEach((node) => {
    node.textContent = "0";
  });
  closeRequestModal();

  setAdminMessage("Signed out of the approval desk.", "neutral");
}

function renderBookings(bookings) {
  requestTableBody.replaceChildren();
  requestTableCount.textContent = String(bookings.length);

  const counts = {
    approved: 0,
    declined: 0,
    pending: 0,
  };

  bookings.forEach((booking) => {
    counts[booking.status] = (counts[booking.status] || 0) + 1;
    requestTableBody.append(buildRow(booking));
  });

  Object.keys(summaryNodes).forEach((status) => {
    summaryNodes[status].textContent = String(counts[status] || 0);
  });

  if (bookings.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.className = "table-empty";
    cell.textContent = "No requests found yet.";
    row.append(cell);
    requestTableBody.append(row);
  }
}

function buildRow(booking) {
  const fragment = rowTemplate.content.cloneNode(true);
  const row = fragment.querySelector("tr");
  const dateCell = fragment.querySelector('[data-col="date"]');
  const memberCell = fragment.querySelector('[data-col="member"]');
  const ministryCell = fragment.querySelector('[data-col="ministry"]');
  const bookingCell = fragment.querySelector('[data-col="booking"]');
  const statusCell = fragment.querySelector('[data-col="status"]');
  const vehicleCell = fragment.querySelector('[data-col="vehicle"]');
  const actionsCell = fragment.querySelector('[data-col="actions"]');

  row.dataset.status = booking.status;

  const fromDate = getFromDate(booking);
  const toDate = getToDate(booking);

  dateCell.innerHTML = `
    <div class="table-primary">${formatDateRange(fromDate, toDate)}</div>
    <div class="table-secondary">${formatSlot(booking)}</div>
  `;
  memberCell.innerHTML = `
    <div class="table-primary">${escapeHtml(booking.requesterName)}</div>
    <div class="table-secondary">${escapeHtml(booking.membershipNumber || "No membership number")}</div>
  `;
  ministryCell.textContent = booking.ministryName || "Not provided";
  bookingCell.textContent = booking.eventName || "Untitled request";

  const badge = document.createElement("span");
  badge.className = "status-badge";
  badge.dataset.status = booking.status;
  badge.textContent = booking.status;
  statusCell.append(badge);

  vehicleCell.textContent =
    booking.assignedVehicleLabel ||
    (booking.status === "pending" ? `${booking.availableVehicles?.length || 0} available` : "Not assigned");

  const actionWrap = document.createElement("div");
  actionWrap.className = "row-actions";

  const viewButton = document.createElement("button");
  viewButton.type = "button";
  viewButton.className = "ghost-button row-button";
  viewButton.textContent = "Open";
  viewButton.addEventListener("click", () => openRequestModal(booking.id));
  actionWrap.append(viewButton);

  if (booking.status === "pending") {
    const approveButton = document.createElement("button");
    approveButton.type = "button";
    approveButton.className = "primary-button row-button";
    approveButton.textContent = "Approve";
    approveButton.addEventListener("click", () => openRequestModal(booking.id, { focusDecision: true }));

    const declineButton = document.createElement("button");
    declineButton.type = "button";
    declineButton.className = "ghost-button row-button";
    declineButton.textContent = "Decline";
    declineButton.addEventListener("click", () => quickDecline(booking.id));

    actionWrap.append(approveButton, declineButton);
  }

  actionsCell.append(actionWrap);
  return row;
}

function openRequestModal(bookingId, options = {}) {
  const booking = state.bookings.find((item) => item.id === bookingId);

  if (!booking) {
    return;
  }

  state.activeBookingId = bookingId;
  const fromDate = getFromDate(booking);
  const toDate = getToDate(booking);
  requestModalTitle.textContent = booking.eventName || "Booking request";
  requestModalMeta.textContent = `${formatDateRange(fromDate, toDate)} • ${formatSlot(booking)} • ${booking.requesterName}`;
  requestModalDetails.replaceChildren();
  requestModalVehicleError.textContent = "";
  requestModalAdminNote.value = booking.adminNotes || "";

  const detailPairs = [
    ["Member", booking.requesterName],
    ["Membership no.", booking.membershipNumber || "Not provided"],
    ["Ministry", booking.ministryName],
    ["Email", booking.requesterEmail || "Not provided"],
    ["Phone", booking.phone || "Not provided"],
    ["From date", formatDate(fromDate)],
    ["To date", formatDate(toDate)],
    ["Pickup", booking.pickupLocation],
    ["Destination", booking.destination],
    ["Purpose", booking.purpose],
    ["Notes", booking.notes || "None"],
    ["Submitted", formatDateTime(booking.submittedAt)],
    ["Status", booking.status],
  ];

  if (booking.assignedVehicleLabel) {
    detailPairs.push(["Assigned bus", booking.assignedVehicleLabel]);
  }

  if (booking.processedAt) {
    detailPairs.push(["Processed by", booking.processedBy || "Unknown"]);
    detailPairs.push(["Processed at", formatDateTime(booking.processedAt)]);
    detailPairs.push(["Admin note", booking.adminNotes || "None"]);
  }

  detailPairs.forEach(([term, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = value;
    requestModalDetails.append(dt, dd);
  });

  if (booking.status === "pending") {
    requestModalDecisionPanel.hidden = false;
    requestModalProcessedPanel.hidden = true;
    populateVehicleSelect(requestModalVehicleSelect, booking.availableVehicles || []);
    requestModalApproveButton.disabled = false;
    requestModalDeclineButton.disabled = false;
  } else {
    requestModalDecisionPanel.hidden = true;
    requestModalProcessedPanel.hidden = false;
    requestModalProcessedText.textContent = booking.processedAt
      ? `Processed by ${booking.processedBy || "Unknown"} on ${formatDateTime(booking.processedAt)}.`
      : "This request has already been processed.";
  }

  if (requestModal?.showModal) {
    requestModal.showModal();
  } else {
    requestModal.setAttribute("open", "");
  }

  document.body.classList.add("dialog-open");

  if (options.focusDecision && !requestModalDecisionPanel.hidden) {
    requestModalVehicleSelect.focus();
  }
}

function closeRequestModal() {
  state.activeBookingId = null;

  if (requestModal?.close && requestModal.open) {
    requestModal.close();
  } else if (requestModal) {
    requestModal.removeAttribute("open");
  }

  document.body.classList.remove("dialog-open");
}

async function submitModalDecision(decision) {
  const booking = state.bookings.find((item) => item.id === state.activeBookingId);

  if (!booking) {
    return;
  }

  requestModalVehicleError.textContent = "";
  requestModalApproveButton.disabled = true;
  requestModalDeclineButton.disabled = true;

  try {
    const response = await fetch(`/api/admin/bookings/decision?id=${encodeURIComponent(booking.id)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": state.adminCode,
      },
      body: JSON.stringify({
        adminName: state.adminName,
        adminNotes: requestModalAdminNote.value,
        decision,
        selectedVehicleId: requestModalVehicleSelect.value,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      if (result.fields?.selectedVehicleId) {
        requestModalVehicleError.textContent = result.fields.selectedVehicleId;
      }
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
  } finally {
    requestModalApproveButton.disabled = false;
    requestModalDeclineButton.disabled = false;
  }
}

async function quickDecline(bookingId) {
  state.activeBookingId = bookingId;
  requestModalAdminNote.value = "";
  requestModalVehicleSelect.value = "";
  await submitModalDecision("declined");
}

function clearStoredSession() {
  localStorage.removeItem("bus-booker-admin-code");
  localStorage.removeItem("bus-booker-admin-name");
}

function setAuthBusy(isBusy) {
  signInButton.disabled = isBusy;
  adminAccessCodeInput.disabled = isBusy;
  adminNameInput.disabled = isBusy;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateRange(fromDate, toDate) {
  if (fromDate === toDate) {
    return formatDate(fromDate);
  }

  return `${formatDate(fromDate)} to ${formatDate(toDate)}`;
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

function getFromDate(booking) {
  return booking.fromDate || booking.travelDate;
}

function getToDate(booking) {
  return booking.toDate || booking.travelDate;
}

function setAdminMessage(message, tone) {
  adminMessage.textContent = message;

  if (tone === "neutral") {
    adminMessage.removeAttribute("data-tone");
    return;
  }

  adminMessage.dataset.tone = tone;
}

function populateVehicleSelect(selectNode, vehicles) {
  selectNode.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent =
    vehicles.length > 0 ? "Select available bus" : "No available buses for this request";
  selectNode.append(placeholder);

  vehicles.forEach((vehicle) => {
    const option = document.createElement("option");
    option.value = vehicle.id;
    option.textContent = `${vehicle.label} (${vehicle.number})`;
    selectNode.append(option);
  });

  selectNode.disabled = vehicles.length === 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
