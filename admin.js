const adminAccessCodeInput = document.querySelector("#adminAccessCode");
const adminNameInput = document.querySelector("#adminName");
const signInForm = document.querySelector("#adminSignInForm");
const signInButton = document.querySelector("#signInButton");
const openSmsCreditsButton = document.querySelector("#openSmsCreditsButton");
const openContactsButton = document.querySelector("#openContactsButton");
const openTermsButton = document.querySelector("#openTermsButton");
const refreshBookingsButton = document.querySelector("#refreshBookingsButton");
const logoutButton = document.querySelector("#logoutButton");
const adminMessage = document.querySelector("#adminMessage");
const authPanel = document.querySelector("#authPanel");
const adminWorkspace = document.querySelector("#adminWorkspace");
const activeAdminName = document.querySelector("#activeAdminName");
const requestTableBody = document.querySelector("#requestTableBody");
const requestTableCount = document.querySelector("#requestTableCount");
const requestStatusFilter = document.querySelector("#requestStatusFilter");
const rowTemplate = document.querySelector("#requestRowTemplate");
const notificationSettingsForm = document.querySelector("#notificationSettingsForm");
const adminContactPhones = document.querySelector("#adminContactPhones");
const financeContactPhones = document.querySelector("#financeContactPhones");
const adminContactPhonesError = document.querySelector("#adminContactPhonesError");
const financeContactPhonesError = document.querySelector("#financeContactPhonesError");
const saveNotificationSettingsButton = document.querySelector("#saveNotificationSettingsButton");
const termsDocumentForm = document.querySelector("#termsDocumentForm");
const termsDocumentFile = document.querySelector("#termsDocumentFile");
const termsDocumentFileHelp = document.querySelector("#termsDocumentFileHelp");
const termsDocumentContent = document.querySelector("#termsDocumentContent");
const termsDocumentContentError = document.querySelector("#termsDocumentContentError");
const saveTermsDocumentButton = document.querySelector("#saveTermsDocumentButton");
const smsCreditsModal = document.querySelector("#smsCreditsModal");
const closeSmsCreditsModalButton = document.querySelector("#closeSmsCreditsModalButton");
const contactsModal = document.querySelector("#contactsModal");
const closeContactsModalButton = document.querySelector("#closeContactsModalButton");
const termsModal = document.querySelector("#termsModal");
const closeTermsModalButton = document.querySelector("#closeTermsModalButton");

const requestModal = document.querySelector("#requestModal");
const requestModalTitle = document.querySelector("#requestModalTitle");
const requestModalMeta = document.querySelector("#requestModalMeta");
const requestModalDetails = document.querySelector("#requestModalDetails");
const requestModalDecisionPanel = document.querySelector("#requestModalDecisionPanel");
const requestModalStageSummary = document.querySelector("#requestModalStageSummary");
const requestModalProcessedPanel = document.querySelector("#requestModalProcessedPanel");
const requestModalProcessedLabel = document.querySelector("#requestModalProcessedLabel");
const requestModalProcessedText = document.querySelector("#requestModalProcessedText");
const markReturnedButton = document.querySelector("#markReturnedButton");
const returnConfirmModal = document.querySelector("#returnConfirmModal");
const returnConfirmModalMeta = document.querySelector("#returnConfirmModalMeta");
const returnConfirmModalText = document.querySelector("#returnConfirmModalText");
const closeReturnConfirmModalButton = document.querySelector("#closeReturnConfirmModalButton");
const confirmReturnButton = document.querySelector("#confirmReturnButton");
const cancelReturnButton = document.querySelector("#cancelReturnButton");
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
const smsCreditBalance = document.querySelector("#smsCreditBalance");
const smsCreditCost = document.querySelector("#smsCreditCost");
const smsCreditUpdated = document.querySelector("#smsCreditUpdated");
const smsCreditWarning = document.querySelector("#smsCreditWarning");

const state = {
  adminName: localStorage.getItem("bus-booker-admin-name") || "",
  authenticated: false,
  fleet: [],
  bookings: [],
  requestStatusFilter: "all",
  activeBookingId: null,
  activeReturnBookingId: null,
  pendingBookingId: readRequestedBookingId(),
  notificationSettings: {
    adminPhones: [],
    financePhones: [],
  },
  termsDocument: {
    content: "",
    fileName: "",
    updatedAt: "",
    updatedBy: "",
  },
  smsCredits: null,
};

adminNameInput.value = state.adminName;
requestStatusFilter.value = state.requestStatusFilter;
setAdminMessage("Sign in to open the approval desk.", "neutral");

signInForm.addEventListener("submit", handleSignIn);
openSmsCreditsButton?.addEventListener("click", () => openUtilityModal(smsCreditsModal));
openContactsButton?.addEventListener("click", () => openUtilityModal(contactsModal));
openTermsButton?.addEventListener("click", () => openUtilityModal(termsModal));
refreshBookingsButton?.addEventListener("click", () => loadBookings());
logoutButton?.addEventListener("click", logout);
requestStatusFilter?.addEventListener("change", () => {
  state.requestStatusFilter = requestStatusFilter.value;
  renderBookings(state.bookings);
});
notificationSettingsForm?.addEventListener("submit", handleSaveNotificationSettings);
termsDocumentForm?.addEventListener("submit", handleSaveTermsDocument);
closeSmsCreditsModalButton?.addEventListener("click", () => closeUtilityModal(smsCreditsModal));
closeContactsModalButton?.addEventListener("click", () => closeUtilityModal(contactsModal));
closeTermsModalButton?.addEventListener("click", () => closeUtilityModal(termsModal));
closeRequestModalButton?.addEventListener("click", closeRequestModal);
closeReturnConfirmModalButton?.addEventListener("click", closeReturnConfirmModal);
confirmReturnButton?.addEventListener("click", markBusReturned);
cancelReturnButton?.addEventListener("click", closeReturnConfirmModal);
requestModalApproveButton?.addEventListener("click", () => submitModalDecision(getActiveApprovalDecision()));
requestModalDeclineButton?.addEventListener("click", () => submitModalDecision("declined"));
markReturnedButton?.addEventListener("click", () => openReturnConfirmModal(state.activeBookingId, { closeRequest: true }));
requestModalDriverPhone?.addEventListener("input", () => {
  requestModalDriverPhone.value = requestModalDriverPhone.value.replace(/\D/g, "").slice(0, 10);
  requestModalDriverPhoneError.textContent = "";
});
termsDocumentFile?.addEventListener("change", handleTermsFileSelection);

if (requestModal) {
  requestModal.addEventListener("click", (event) => {
    if (event.target === requestModal) {
      closeRequestModal();
    }
  });
}

[smsCreditsModal, contactsModal, termsModal].forEach((modal) => {
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeUtilityModal(modal);
    }
  });
});

if (returnConfirmModal) {
  returnConfirmModal.addEventListener("click", (event) => {
    if (event.target === returnConfirmModal) {
      closeReturnConfirmModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && requestModal?.open) {
    closeRequestModal();
    return;
  }

  if (event.key === "Escape" && returnConfirmModal?.open) {
    closeReturnConfirmModal();
    return;
  }

  if (event.key === "Escape") {
    [smsCreditsModal, contactsModal, termsModal].forEach((modal) => {
      if (modal?.open) {
        closeUtilityModal(modal);
      }
    });
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

    const [bookingsResponse, settingsResponse, termsResponse] = await Promise.all([
      fetch("/api/admin/bookings"),
      fetch("/api/admin/notification-settings"),
      fetch("/api/admin/terms"),
    ]);
    const result = await bookingsResponse.json();
    const settingsResult = await settingsResponse.json();
    const termsResult = await termsResponse.json();

    if (!bookingsResponse.ok) {
      setAdminMessage(result.error || "Could not load admin bookings.", "error");
      return;
    }

    if (!settingsResponse.ok) {
      setAdminMessage(settingsResult.error || "Could not load notification contacts.", "error");
      return;
    }

    if (!termsResponse.ok) {
      setAdminMessage(termsResult.error || "Could not load the terms document.", "error");
      return;
    }

    state.authenticated = true;
    state.fleet = result.fleet || [];
    state.bookings = result.bookings || [];
    state.notificationSettings = settingsResult.settings || state.notificationSettings;
    state.termsDocument = termsResult.terms || state.termsDocument;
    state.smsCredits = result.smsCredits || null;

    localStorage.setItem("bus-booker-admin-name", state.adminName);

    authPanel.hidden = true;
    adminWorkspace.hidden = false;
    activeAdminName.textContent = state.adminName;
    renderBookings(state.bookings);
    renderNotificationSettings();
    renderTermsDocument();
    renderSmsCredits();
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
    state.smsCredits = result.smsCredits || state.smsCredits;
    renderBookings(state.bookings);
    renderSmsCredits();
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

async function handleSaveTermsDocument(event) {
  event.preventDefault();

  if (!state.authenticated) {
    return;
  }

  termsDocumentContentError.textContent = "";
  saveTermsDocumentButton.disabled = true;
  setAdminMessage("Saving terms and conditions...", "neutral");

  try {
    const response = await fetch("/api/admin/terms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: termsDocumentContent.value,
        fileName: termsDocumentFile?.files?.[0]?.name || state.termsDocument.fileName || "uploaded-terms.txt",
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        await logout({ silent: true });
        setAdminMessage("Your admin session has expired. Please sign in again.", "error");
        return;
      }

      if (result.fields?.content) {
        termsDocumentContentError.textContent = result.fields.content;
      }

      setAdminMessage(result.error || "Could not save the terms document.", "error");
      return;
    }

    state.termsDocument = result.terms || state.termsDocument;
    renderTermsDocument();
    setAdminMessage(result.message || "Terms document saved.", "success");
  } catch (error) {
    setAdminMessage(error.message || "The server could not be reached.", "error");
  } finally {
    saveTermsDocumentButton.disabled = false;
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
  state.termsDocument = {
    content: "",
    fileName: "",
    updatedAt: "",
    updatedBy: "",
  };
  state.smsCredits = null;

  adminAccessCodeInput.value = "";
  adminNameInput.value = "";
  authPanel.hidden = false;
  adminWorkspace.hidden = true;
  activeAdminName.textContent = "";
  requestTableBody.replaceChildren();
  requestTableCount.textContent = "0";
  adminContactPhones.value = "";
  financeContactPhones.value = "";
  termsDocumentContent.value = "";
  termsDocumentFile.value = "";
  termsDocumentFileHelp.textContent = "No file selected yet.";
  adminContactPhonesError.textContent = "";
  financeContactPhonesError.textContent = "";
  termsDocumentContentError.textContent = "";
  Object.values(summaryNodes).forEach((node) => {
    node.textContent = "0";
  });
  renderSmsCredits();
  closeRequestModal();

  if (!silent) {
    setAdminMessage("Signed out of the approval desk.", "neutral");
  }
}

function renderBookings(bookings) {
  const visibleBookings = bookings.filter((booking) => matchesRequestStatusFilter(booking, state.requestStatusFilter));
  requestTableBody.replaceChildren();
  requestTableCount.textContent = String(visibleBookings.length);

  const counts = {
    approved: 0,
    awaiting_payment: 0,
    declined: 0,
    pending: 0,
  };

  bookings.forEach((booking) => {
    counts[booking.status] = (counts[booking.status] || 0) + 1;
  });

  visibleBookings.forEach((booking) => {
    requestTableBody.append(buildRow(booking));
  });

  Object.keys(summaryNodes).forEach((status) => {
    summaryNodes[status].textContent = String(counts[status] || 0);
  });

  if (visibleBookings.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.className = "table-empty";
    cell.textContent =
      state.requestStatusFilter === "all"
        ? "No requests found yet."
        : "No requests match the selected status.";
    row.append(cell);
    requestTableBody.append(row);
  }

  if (state.pendingBookingId) {
    const requestedBooking = bookings.find((booking) => booking.id === state.pendingBookingId);
    if (requestedBooking) {
      const bookingId = state.pendingBookingId;
      state.pendingBookingId = null;
      openRequestModal(bookingId, { focusDecision: true });
    }
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
  const membershipLabel = booking.membershipNumber || "No membership number";

  dateCell.innerHTML = `
    <div class="table-inline-detail">
      <span class="table-primary">${formatDateRange(fromDate, toDate)}</span>
      <span class="table-secondary">• ${formatSlot(booking)}</span>
    </div>
  `;
  memberCell.innerHTML = `
    <div class="table-inline-detail">
      <span class="table-primary">${escapeHtml(booking.requesterName)}</span>
      <span class="table-secondary">• ${escapeHtml(membershipLabel)}</span>
    </div>
  `;
  ministryCell.textContent = booking.ministryName || "Not provided";
  bookingCell.textContent = booking.eventName || "Untitled request";

  const badge = document.createElement("span");
  badge.className = "status-badge";
  badge.dataset.status = booking.status;
  badge.textContent = getStatusLabel(booking);
  statusCell.append(badge);

  vehicleCell.innerHTML = `<span class="table-note">${escapeHtml(getStageNote(booking))}</span>`;

  const actionWrap = document.createElement("div");
  actionWrap.className = "row-actions";

  const viewButton = document.createElement("button");
  viewButton.type = "button";
  viewButton.className = "ghost-button row-button";
  viewButton.textContent = getRowActionLabel(booking);
  viewButton.addEventListener("click", () => {
    if (booking.status === "approved" && !booking.returnedAt) {
      openReturnConfirmModal(booking.id);
      return;
    }

    openRequestModal(booking.id);
  });
  actionWrap.append(viewButton);

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
  const modalPresentation = getRequestModalPresentation(booking);
  requestModalTitle.textContent = modalPresentation.title;
  requestModalMeta.textContent = `${booking.requesterName} • ${formatDateRange(fromDate, toDate)} • ${formatSlot(booking)}`;
  requestModalStageSummary.textContent = modalPresentation.summary;
  requestModalProcessedLabel.textContent = modalPresentation.processedLabel;
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
    ["Status", getStatusLabel(booking)],
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

  if (booking.returnedAt) {
    detailPairs.push(["Returned at", formatDateTime(booking.returnedAt)]);
    detailPairs.push(["Returned by", booking.returnedBy || "Unknown"]);
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
    requestModalProcessedText.textContent = getProcessedPanelText(booking);
    markReturnedButton.hidden = booking.status !== "approved" || Boolean(booking.returnedAt);
    markReturnedButton.disabled = false;
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

  if (!returnConfirmModal?.open && !smsCreditsModal?.open && !contactsModal?.open && !termsModal?.open) {
    document.body.classList.remove("dialog-open");
  }
}

function openReturnConfirmModal(bookingId, options = {}) {
  const booking = state.bookings.find((item) => item.id === bookingId);

  if (!booking) {
    return;
  }

  state.activeReturnBookingId = booking.id;
  const fromDate = getFromDate(booking);
  const toDate = getToDate(booking);
  returnConfirmModalMeta.textContent = `${booking.requesterName} • ${formatDateRange(fromDate, toDate)} • ${formatSlot(booking)}`;
  returnConfirmModalText.textContent = `Confirm that ${booking.assignedVehicleLabel || "the assigned bus"} has returned from ${booking.eventName || "this trip"} and is ready to be marked available again.`;

  if (options.closeRequest) {
    closeRequestModal();
  }

  if (returnConfirmModal?.showModal) {
    returnConfirmModal.showModal();
  } else {
    returnConfirmModal.setAttribute("open", "");
  }

  document.body.classList.add("dialog-open");
}

function closeReturnConfirmModal() {
  state.activeReturnBookingId = null;

  if (returnConfirmModal?.close && returnConfirmModal.open) {
    returnConfirmModal.close();
  } else if (returnConfirmModal) {
    returnConfirmModal.removeAttribute("open");
  }

  if (!requestModal?.open && !returnConfirmModal?.open && !smsCreditsModal?.open && !contactsModal?.open && !termsModal?.open) {
    document.body.classList.remove("dialog-open");
  }
}

function openUtilityModal(modal) {
  if (!modal) {
    return;
  }

  if (modal.showModal) {
    modal.showModal();
  } else {
    modal.setAttribute("open", "");
  }

  document.body.classList.add("dialog-open");
}

function closeUtilityModal(modal) {
  if (!modal) {
    return;
  }

  if (modal.close && modal.open) {
    modal.close();
  } else {
    modal.removeAttribute("open");
  }

  if (!requestModal?.open && !returnConfirmModal?.open && !smsCreditsModal?.open && !contactsModal?.open && !termsModal?.open) {
    document.body.classList.remove("dialog-open");
  }
}

function readRequestedBookingId() {
  try {
    return new URLSearchParams(window.location.search).get("booking") || null;
  } catch {
    return null;
  }
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
    const response = await fetch(`/api/admin/bookings?action=decision&id=${encodeURIComponent(booking.id)}`, {
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

    if (decision === "awaiting_payment") {
      closeRequestModal();
    }

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

async function markBusReturned() {
  const booking = state.bookings.find((item) => item.id === state.activeReturnBookingId);

  if (!booking) {
    return;
  }

  confirmReturnButton.disabled = true;
  cancelReturnButton.disabled = true;

  try {
    const response = await fetch(`/api/admin/bookings?action=return&id=${encodeURIComponent(booking.id)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        await logout({ silent: true });
        setAdminMessage("Your admin session has expired. Please sign in again.", "error");
        return;
      }

      setAdminMessage(result.error || "Could not mark the bus as returned.", "error");
      return;
    }

    setAdminMessage(result.message || "Bus marked as returned.", "success");
    closeReturnConfirmModal();
    await loadBookings();
  } catch (error) {
    setAdminMessage(error.message || "The server could not be reached.", "error");
  } finally {
    confirmReturnButton.disabled = false;
    cancelReturnButton.disabled = false;
  }
}

function getActiveApprovalDecision() {
  const booking = state.bookings.find((item) => item.id === state.activeBookingId);

  if (booking?.status === "pending") {
    return "awaiting_payment";
  }

  return "approved";
}

function getRowActionLabel(booking) {
  if (booking.status === "pending") {
    return "Approve";
  }

  if (booking.status === "awaiting_payment") {
    return booking.paymentStatus === "confirmed" ? "Release" : "Review";
  }

  if (booking.status === "approved") {
    return booking.returnedAt ? "View" : "Return";
  }

  if (booking.status === "declined") {
    return "View";
  }

  return "Review";
}

function matchesRequestStatusFilter(booking, filterValue) {
  if (filterValue === "all") {
    return true;
  }

  if (filterValue === "returned") {
    return booking.status === "approved" && Boolean(booking.returnedAt);
  }

  if (filterValue === "ready_to_release") {
    return booking.status === "awaiting_payment" && booking.paymentStatus === "confirmed";
  }

  if (filterValue === "approved") {
    return booking.status === "approved" && !booking.returnedAt;
  }

  if (filterValue === "awaiting_payment") {
    return booking.status === "awaiting_payment" && booking.paymentStatus !== "confirmed";
  }

  return booking.status === filterValue;
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
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateRange(fromDate, toDate) {
  if (fromDate === toDate) {
    return formatDate(fromDate);
  }

  return `${formatDate(fromDate)} to ${formatDate(toDate)}`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatSlot(booking) {
  return `${booking.startTime || "--:--"} to ${booking.endTime || "--:--"}`;
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

function renderTermsDocument() {
  termsDocumentContent.value = state.termsDocument.content || "";
  termsDocumentContentError.textContent = "";

  const parts = [];

  if (state.termsDocument.fileName) {
    parts.push(`Source: ${state.termsDocument.fileName}`);
  }

  if (state.termsDocument.updatedAt) {
    parts.push(`Updated: ${formatDateTime(state.termsDocument.updatedAt)}`);
  }

  if (state.termsDocument.updatedBy) {
    parts.push(`By: ${state.termsDocument.updatedBy}`);
  }

  termsDocumentFileHelp.textContent = parts.join(" • ") || "No file selected yet.";
}

async function handleTermsFileSelection() {
  termsDocumentContentError.textContent = "";

  const file = termsDocumentFile?.files?.[0];

  if (!file) {
    renderTermsDocument();
    return;
  }

  try {
    const text = await file.text();
    termsDocumentContent.value = text;
    termsDocumentFileHelp.textContent = `Selected file: ${file.name}`;
  } catch (error) {
    termsDocumentContentError.textContent = "The selected file could not be read.";
    setAdminMessage(error.message || "Could not read the selected text file.", "error");
  }
}

function renderSmsCredits() {
  const credits = state.smsCredits || {};
  const balance = typeof credits.balanceAfter === "number" ? String(credits.balanceAfter) : "--";
  const totalCost = typeof credits.totalCost === "number" ? `${credits.totalCost} credit${credits.totalCost === 1 ? "" : "s"}` : "--";
  const updatedAt = credits.lastUpdatedAt ? formatDateTime(credits.lastUpdatedAt) : "--";

  smsCreditBalance.textContent = balance;
  smsCreditCost.textContent = totalCost;
  smsCreditUpdated.textContent = updatedAt;

  if (credits.lowCredit && typeof credits.balanceAfter === "number") {
    smsCreditWarning.hidden = false;
    smsCreditWarning.dataset.tone = "error";
    smsCreditWarning.textContent = `Low SMS credit warning: ${credits.balanceAfter} credits remaining. Refill before the balance drops below 100.`;
    return;
  }

  smsCreditWarning.hidden = true;
  smsCreditWarning.textContent = "";
  smsCreditWarning.removeAttribute("data-tone");
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
  requestModalDeclineButton.textContent = booking.status === "pending" ? "Decline request" : "Decline booking";

  if (isWaitingForPayment) {
    requestModalVehicleError.textContent = "Finance must confirm payment before release.";
  }
}

function getRequestModalPresentation(booking) {
  if (booking.status === "pending") {
    return {
      title: booking.eventName || "Review request",
      summary: `${booking.availableVehicles?.length || 0} buses available. Review the trip and decide whether to move it to payment.`,
      processedLabel: "Request stage",
    };
  }

  if (booking.status === "awaiting_payment" && booking.paymentStatus === "confirmed") {
    return {
      title: booking.eventName || "Ready to release",
      summary: "Payment has been confirmed. Assign the bus, driver, and approving authority to release this trip.",
      processedLabel: "Release stage",
    };
  }

  if (booking.status === "awaiting_payment") {
    return {
      title: booking.eventName || "Awaiting payment",
      summary: "Approval is complete. This booking is waiting for finance confirmation before the bus can be released.",
      processedLabel: "Payment stage",
    };
  }

  if (booking.status === "approved" && booking.returnedAt) {
    return {
      title: booking.eventName || "Returned trip",
      summary: "This trip has been completed and the bus has been marked as returned.",
      processedLabel: "Return stage",
    };
  }

  if (booking.status === "approved") {
    return {
      title: booking.eventName || "Released trip",
      summary: "This booking has been released. Review the assigned vehicle and trip details below.",
      processedLabel: "Release stage",
    };
  }

  if (booking.status === "declined") {
    return {
      title: booking.eventName || "Declined request",
      summary: "This request was declined. You can still review the original trip details and decision notes here.",
      processedLabel: "Decision stage",
    };
  }

  return {
    title: booking.eventName || "Booking request",
    summary: "Review the trip details below.",
    processedLabel: "Request stage",
  };
}

function getStatusLabel(bookingOrStatus) {
  const booking =
    bookingOrStatus && typeof bookingOrStatus === "object"
      ? bookingOrStatus
      : { status: bookingOrStatus };
  const status = booking.status;

  if (status === "awaiting_payment" && booking.paymentStatus === "confirmed") {
    return "Ready to release";
  }

  if (status === "awaiting_payment") {
    return "Awaiting payment";
  }

  if (status === "approved") {
    if (booking.returnedAt) {
      return "Available again";
    }
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
    if (booking.returnedAt) {
      return "Bus returned and available";
    }
    return booking.assignedVehicleLabel || "Bus released";
  }

  if (booking.status === "declined") {
    return "Not released";
  }

  return "Review needed";
}

function getProcessedPanelText(booking) {
  if (booking.returnedAt) {
    return `Returned by ${booking.returnedBy || "Unknown"} on ${formatDateTime(booking.returnedAt)}. This bus is now available for future bookings.`;
  }

  if (booking.status === "declined") {
    return `Declined by ${booking.processedBy || "Unknown"} on ${formatDateTime(booking.processedAt)}.`;
  }

  if (booking.status === "approved") {
    return `Released by ${booking.processedBy || "Unknown"} on ${formatDateTime(booking.processedAt)}.`;
  }

  if (booking.processedAt) {
    return `Processed by ${booking.processedBy || "Unknown"} on ${formatDateTime(booking.processedAt)}.`;
  }

  return "This request has already been processed.";
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
