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
const notificationSettingsForm = document.querySelector("#notificationSettingsForm");
const adminContactPhones = document.querySelector("#adminContactPhones");
const financeContactPhones = document.querySelector("#financeContactPhones");
const adminContactPhonesError = document.querySelector("#adminContactPhonesError");
const financeContactPhonesError = document.querySelector("#financeContactPhonesError");
const saveNotificationSettingsButton = document.querySelector("#saveNotificationSettingsButton");

const requestModal = document.querySelector("#requestModal");
const requestModalTitle = document.querySelector("#requestModalTitle");
const requestModalMeta = document.querySelector("#requestModalMeta");
const requestModalDetails = document.querySelector("#requestModalDetails");
const requestModalDecisionPanel = document.querySelector("#requestModalDecisionPanel");
const requestModalProcessedPanel = document.querySelector("#requestModalProcessedPanel");
const requestModalProcessedText = document.querySelector("#requestModalProcessedText");
const requestModalVehicleSelect = document.querySelector("#requestModalVehicleSelect");
const requestModalVehicleError = document.querySelector("#requestModalVehicleError");
const requestModalDriverName = document.querySelector("#requestModalDriverName");
const requestModalDriverNameError = document.querySelector("#requestModalDriverNameError");
const requestModalDriverPhone = document.querySelector("#requestModalDriverPhone");
const requestModalDriverPhoneError = document.querySelector("#requestModalDriverPhoneError");
const requestModalApprovingAuthority = document.querySelector("#requestModalApprovingAuthority");
const requestModalApprovingAuthorityError = document.querySelector("#requestModalApprovingAuthorityError");
const requestModalAdminNote = document.querySelector("#requestModalAdminNote");
const requestModalApproveButton = document.querySelector("#requestModalApproveButton");
const requestModalDeclineButton = document.querySelector("#requestModalDeclineButton");
const closeRequestModalButton = document.querySelector("#closeRequestModalButton");

const summaryNodes = {
  approved: document.querySelector("#summaryApproved"),
  awaiting_payment: document.querySelector("#summaryAwaitingPayment"),
  declined: document.querySelector("#summaryDeclined"),
  pending: document.querySelector("#summaryPending"),
};

const state = {
  adminName: localStorage.getItem("bus-booker-admin-name") || "",
  authenticated: false,
  fleet: [],
  bookings: [],
  activeBookingId: null,
  notificationSettings: {
    adminPhones: [],
    financePhones: [],
  },
};

adminNameInput.value = state.adminName;
setAdminMessage("Sign in to open the approval desk.", "neutral");

signInForm.addEventListener("submit", handleSignIn);
refreshBookingsButton?.addEventListener("click", () => loadBookings());
logoutButton?.addEventListener("click", logout);
notificationSettingsForm?.addEventListener("submit", handleSaveNotificationSettings);
closeRequestModalButton?.addEventListener("click", closeRequestModal);
requestModalApproveButton?.addEventListener("click", () => submitModalDecision(getActiveApprovalDecision()));
requestModalDeclineButton?.addEventListener("click", () => submitModalDecision("declined"));
requestModalDriverPhone?.addEventListener("input", () => {
  requestModalDriverPhone.value = requestModalDriverPhone.value.replace(/\D/g, "").slice(0, 10);
  requestModalDriverPhoneError.textContent = "";
});

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

restoreSession();

async function handleSignIn(event) {
  event.preventDefault();
  await signIn();
}

async function signIn({ restoreSession = false } = {}) {
  const adminCode = adminAccessCodeInput.value.trim();
  const adminName = adminNameInput.value.trim();

  if (!restoreSession) {
    if (!adminCode) {
      setAdminMessage("Please enter the admin access code.", "error");
      return;
    }

    if (!adminName) {
      setAdminMessage("Please enter the admin name for this session.", "error");
      return;
    }
  }

  setAuthBusy(true);
  setAdminMessage(restoreSession ? "Restoring admin session..." : "Signing in...", "neutral");

  try {
    if (restoreSession) {
      const sessionResponse = await fetch("/api/admin/session");
      const sessionResult = await sessionResponse.json();

      if (!sessionResponse.ok) {
        clearStoredSession();
        setAdminMessage("Sign in to open the approval desk.", "neutral");
        return;
      }

      state.adminName = sessionResult.adminName || state.adminName || "";
    } else {
      const sessionResponse = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessCode: adminCode,
          adminName,
        }),
      });
      const sessionResult = await sessionResponse.json();

      if (!sessionResponse.ok) {
        setAdminMessage(sessionResult.error || "Could not sign in to the approval desk.", "error");
        return;
      }

      state.adminName = sessionResult.adminName || adminName;
    }

    const [bookingsResponse, settingsResponse] = await Promise.all([
      fetch("/api/admin/bookings"),
      fetch("/api/admin/notification-settings"),
    ]);
    const result = await bookingsResponse.json();
    const settingsResult = await settingsResponse.json();

    if (!bookingsResponse.ok) {
      setAdminMessage(result.error || "Could not load admin bookings.", "error");
      return;
    }

    if (!settingsResponse.ok) {
      setAdminMessage(settingsResult.error || "Could not load notification contacts.", "error");
      return;
    }

    state.authenticated = true;
    state.fleet = result.fleet || [];
    state.bookings = result.bookings || [];
    state.notificationSettings = settingsResult.settings || state.notificationSettings;

    localStorage.setItem("bus-booker-admin-name", state.adminName);

    authPanel.hidden = true;
    adminWorkspace.hidden = false;
    activeAdminName.textContent = state.adminName;
    renderBookings(state.bookings);
    renderNotificationSettings();
    setAdminMessage(`Signed in as ${state.adminName}.`, "success");
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
    const response = await fetch("/api/admin/bookings");
    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        await logout({ silent: true });
        setAdminMessage("Your admin session has expired. Please sign in again.", "error");
        return;
      }

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

async function handleSaveNotificationSettings(event) {
  event.preventDefault();

  if (!state.authenticated) {
    return;
  }

  adminContactPhonesError.textContent = "";
  financeContactPhonesError.textContent = "";
  saveNotificationSettingsButton.disabled = true;
  setAdminMessage("Saving notification contacts...", "neutral");

  try {
    const response = await fetch("/api/admin/notification-settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        adminPhones: adminContactPhones.value,
        financePhones: financeContactPhones.value,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        await logout({ silent: true });
        setAdminMessage("Your admin session has expired. Please sign in again.", "error");
        return;
      }

      if (result.fields?.adminPhones) {
        adminContactPhonesError.textContent = result.fields.adminPhones;
      }

      if (result.fields?.financePhones) {
        financeContactPhonesError.textContent = result.fields.financePhones;
      }

      setAdminMessage(result.error || "Could not save notification contacts.", "error");
      return;
    }

    state.notificationSettings = result.settings || state.notificationSettings;
    renderNotificationSettings();
    setAdminMessage(result.message || "Notification contacts saved.", "success");
  } catch (error) {
    setAdminMessage(error.message || "The server could not be reached.", "error");
  } finally {
    saveNotificationSettingsButton.disabled = false;
  }
}

async function logout(options = {}) {
  const { silent = false } = options;

  try {
    await fetch("/api/admin/session", {
      method: "DELETE",
    });
  } catch {
    // ignore network errors on logout cleanup
  }

  clearStoredSession();
  state.adminName = "";
  state.authenticated = false;
  state.fleet = [];
  state.bookings = [];
  state.activeBookingId = null;
  state.notificationSettings = {
    adminPhones: [],
    financePhones: [],
  };

  adminAccessCodeInput.value = "";
  adminNameInput.value = "";
  authPanel.hidden = false;
  adminWorkspace.hidden = true;
  activeAdminName.textContent = "";
  requestTableBody.replaceChildren();
  requestTableCount.textContent = "0";
  adminContactPhones.value = "";
  financeContactPhones.value = "";
  adminContactPhonesError.textContent = "";
  financeContactPhonesError.textContent = "";
  Object.values(summaryNodes).forEach((node) => {
    node.textContent = "0";
  });
  closeRequestModal();

  if (!silent) {
    setAdminMessage("Signed out of the approval desk.", "neutral");
  }
}

function renderBookings(bookings) {
  requestTableBody.replaceChildren();
  requestTableCount.textContent = String(bookings.length);

  const counts = {
    approved: 0,
    awaiting_payment: 0,
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
  badge.textContent = getStatusLabel(booking.status);
  statusCell.append(badge);

  vehicleCell.textContent = getStageNote(booking);

  const actionWrap = document.createElement("div");
  actionWrap.className = "row-actions";

  const viewButton = document.createElement("button");
  viewButton.type = "button";
  viewButton.className = "ghost-button row-button";
  viewButton.textContent = "Open";
  viewButton.addEventListener("click", () => openRequestModal(booking.id));
  actionWrap.append(viewButton);

  if (booking.status === "pending" || booking.status === "awaiting_payment") {
    const approveButton = document.createElement("button");
    approveButton.type = "button";
    approveButton.className = "primary-button row-button";
    approveButton.textContent =
      booking.status === "pending"
        ? "Approve to pay"
        : booking.paymentStatus === "confirmed"
          ? "Release bus"
          : "Waiting for payment";
    approveButton.disabled = booking.status === "awaiting_payment" && booking.paymentStatus !== "confirmed";
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
  requestModalDriverNameError.textContent = "";
  requestModalDriverPhoneError.textContent = "";
  requestModalApprovingAuthorityError.textContent = "";
  requestModalAdminNote.value = booking.adminNotes || "";
  requestModalDriverName.value = booking.driverName || "";
  requestModalDriverPhone.value = booking.driverPhone || "";
  requestModalApprovingAuthority.value = booking.approvingAuthorityName || state.adminName || "";

  const detailPairs = [
    ["Member", booking.requesterName],
    ["Membership no.", booking.membershipNumber || "Not provided"],
    ["Ministry", booking.ministryName],
    ["Email", booking.requesterEmail || "Not provided"],
    ["Phone", booking.phone || "Not provided"],
    ["From date", formatDate(fromDate)],
    ["Start time", booking.startTime || "Not provided"],
    ["To date", formatDate(toDate)],
    ["End time", booking.endTime || "Not provided"],
    ["Pickup", booking.pickupLocation],
    ["End location", booking.endLocation || booking.pickupLocation || "Not provided"],
    ["Destination", booking.destination],
    ["Passengers", String(booking.passengerCount || 0)],
    ["Purpose", booking.purpose],
    ["Notes", booking.notes || "None"],
    ["Terms accepted", booking.termsAccepted ? "Yes" : "No"],
    ["Amount charged", formatMoney(booking.amountCharged)],
    ["Amount paid", formatMoney(booking.amountPaid)],
    ["Balance", formatMoney(booking.balance)],
    ["Payment status", booking.paymentStatus || "pending"],
    ["Tracking code", booking.trackingCode || "Not available"],
    ["Submitted", formatDateTime(booking.submittedAt)],
    ["Status", getStatusLabel(booking.status)],
  ];

  if (booking.assignedVehicleLabel) {
    detailPairs.push(["Assigned bus", booking.assignedVehicleLabel]);
  }

  if (booking.processedAt) {
    detailPairs.push(["Approving authority", booking.approvingAuthorityName || "Not provided"]);
    detailPairs.push(["Vehicle reg. no.", booking.vehicleRegNo || "Not assigned"]);
    detailPairs.push(["Driver", booking.driverName || "Not assigned"]);
    detailPairs.push(["Driver phone", booking.driverPhone || "Not assigned"]);
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

  if (booking.status === "pending" || booking.status === "awaiting_payment") {
    requestModalDecisionPanel.hidden = false;
    requestModalProcessedPanel.hidden = true;
    populateVehicleSelect(requestModalVehicleSelect, booking.availableVehicles || []);
    configureDecisionPanel(booking);
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
  requestModalDriverNameError.textContent = "";
  requestModalDriverPhoneError.textContent = "";
  requestModalApprovingAuthorityError.textContent = "";
  requestModalApproveButton.disabled = true;
  requestModalDeclineButton.disabled = true;

  try {
    const response = await fetch(`/api/admin/bookings/decision?id=${encodeURIComponent(booking.id)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        adminNotes: requestModalAdminNote.value,
        approvingAuthorityName: requestModalApprovingAuthority.value,
        decision,
        driverName: requestModalDriverName.value,
        driverPhone: requestModalDriverPhone.value,
        selectedVehicleId: requestModalVehicleSelect.value,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        await logout({ silent: true });
        setAdminMessage("Your admin session has expired. Please sign in again.", "error");
        return;
      }

      if (result.fields?.selectedVehicleId) {
        requestModalVehicleError.textContent = result.fields.selectedVehicleId;
      }
      if (result.fields?.driverName) {
        requestModalDriverNameError.textContent = result.fields.driverName;
      }
      if (result.fields?.driverPhone) {
        requestModalDriverPhoneError.textContent = result.fields.driverPhone;
      }
      if (result.fields?.approvingAuthorityName) {
        requestModalApprovingAuthorityError.textContent = result.fields.approvingAuthorityName;
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
    const currentBooking = state.bookings.find((item) => item.id === state.activeBookingId);
    if (currentBooking && (currentBooking.status === "pending" || currentBooking.status === "awaiting_payment")) {
      configureDecisionPanel(currentBooking);
    } else {
      requestModalApproveButton.disabled = false;
    }
    requestModalDeclineButton.disabled = false;
  }
}

function getActiveApprovalDecision() {
  const booking = state.bookings.find((item) => item.id === state.activeBookingId);

  if (booking?.status === "pending") {
    return "awaiting_payment";
  }

  return "approved";
}

async function quickDecline(bookingId) {
  state.activeBookingId = bookingId;
  requestModalAdminNote.value = "";
  requestModalVehicleSelect.value = "";
  requestModalDriverName.value = "";
  requestModalDriverPhone.value = "";
  requestModalApprovingAuthority.value = state.adminName || "";
  await submitModalDecision("declined");
}

function clearStoredSession() {
  localStorage.removeItem("bus-booker-admin-name");
}

async function restoreSession() {
  if (state.adminName) {
    adminNameInput.value = state.adminName;
  }

  await signIn({ restoreSession: true });
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

function renderNotificationSettings() {
  adminContactPhones.value = formatPhoneList(state.notificationSettings.adminPhones);
  financeContactPhones.value = formatPhoneList(state.notificationSettings.financePhones);
}

function formatPhoneList(list) {
  return Array.isArray(list) ? list.join("\n") : "";
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

function configureDecisionPanel(booking) {
  const isReleaseStage = booking.status === "awaiting_payment" && booking.paymentStatus === "confirmed";
  const isWaitingForPayment = booking.status === "awaiting_payment" && booking.paymentStatus !== "confirmed";
  const releaseFields = [
    requestModalVehicleSelect.closest("label"),
    requestModalDriverName.closest("label"),
    requestModalDriverPhone.closest("label"),
    requestModalApprovingAuthority.closest("label"),
  ].filter(Boolean);

  releaseFields.forEach((node) => {
    node.hidden = !isReleaseStage;
  });

  requestModalApproveButton.textContent =
    booking.status === "pending"
      ? "Approve to pay"
      : isReleaseStage
        ? "Release bus"
        : "Waiting for payment";
  requestModalApproveButton.disabled = isWaitingForPayment;

  if (isWaitingForPayment) {
    requestModalVehicleError.textContent = "Finance must confirm payment before release.";
  }
}

function getStatusLabel(status) {
  if (status === "awaiting_payment") {
    return "Awaiting payment";
  }

  if (status === "approved") {
    return "Released";
  }

  if (status === "declined") {
    return "Declined";
  }

  return "Pending review";
}

function getStageNote(booking) {
  if (booking.status === "pending") {
    return `${booking.availableVehicles?.length || 0} available for review`;
  }

  if (booking.status === "awaiting_payment") {
    return booking.paymentStatus === "confirmed" ? "Payment confirmed, ready to release" : "Waiting for finance";
  }

  if (booking.status === "approved") {
    return booking.assignedVehicleLabel || "Bus released";
  }

  if (booking.status === "declined") {
    return "Not released";
  }

  return "Review needed";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(value) {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `GH₵ ${safeAmount.toFixed(2)}`;
}
