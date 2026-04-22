const financeAccessCodeInput = document.querySelector("#financeAccessCode");
const financeNameInput = document.querySelector("#financeName");
const financeSignInForm = document.querySelector("#financeSignInForm");
const financeSignInButton = document.querySelector("#financeSignInButton");
const financeAuthPanel = document.querySelector("#financeAuthPanel");
const financeWorkspace = document.querySelector("#financeWorkspace");
const financeMessage = document.querySelector("#financeMessage");
const activeFinanceName = document.querySelector("#activeFinanceName");
const refreshFinanceButton = document.querySelector("#refreshFinanceButton");
const financeLogoutButton = document.querySelector("#financeLogoutButton");
const financeTableBody = document.querySelector("#financeTableBody");
const financeTableCount = document.querySelector("#financeTableCount");
const financeRowTemplate = document.querySelector("#financeRowTemplate");

const financePaymentModal = document.querySelector("#financePaymentModal");
const financePaymentModalTitle = document.querySelector("#financePaymentModalTitle");
const financePaymentModalMeta = document.querySelector("#financePaymentModalMeta");
const financePaymentDetails = document.querySelector("#financePaymentDetails");
const financeAmountCharged = document.querySelector("#financeAmountCharged");
const financeAmountChargedError = document.querySelector("#financeAmountChargedError");
const financeAmountPaid = document.querySelector("#financeAmountPaid");
const financeAmountPaidError = document.querySelector("#financeAmountPaidError");
const financeBalance = document.querySelector("#financeBalance");
const financeBalanceError = document.querySelector("#financeBalanceError");
const financePaymentReference = document.querySelector("#financePaymentReference");
const financePaymentReferenceError = document.querySelector("#financePaymentReferenceError");
const financePaymentNotes = document.querySelector("#financePaymentNotes");
const confirmPaymentButton = document.querySelector("#confirmPaymentButton");
const cancelPaymentButton = document.querySelector("#cancelPaymentButton");
const closeFinancePaymentModalButton = document.querySelector("#closeFinancePaymentModalButton");

const state = {
  activeBookingId: null,
  authenticated: false,
  bookings: [],
  financeName: localStorage.getItem("bus-booker-finance-name") || "",
};

financeNameInput.value = state.financeName;
setFinanceMessage("Sign in to open the finance desk.", "neutral");

financeSignInForm?.addEventListener("submit", handleSignIn);
refreshFinanceButton?.addEventListener("click", loadBookings);
financeLogoutButton?.addEventListener("click", logout);
confirmPaymentButton?.addEventListener("click", submitPaymentConfirmation);
cancelPaymentButton?.addEventListener("click", closePaymentModal);
closeFinancePaymentModalButton?.addEventListener("click", closePaymentModal);

if (financePaymentModal) {
  financePaymentModal.addEventListener("click", (event) => {
    if (event.target === financePaymentModal) {
      closePaymentModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && financePaymentModal?.open) {
    closePaymentModal();
  }
});

restoreSession();

async function handleSignIn(event) {
  event.preventDefault();
  await signIn();
}

async function signIn({ restoreSession = false } = {}) {
  const accessCode = financeAccessCodeInput.value.trim();
  const financeName = financeNameInput.value.trim();

  if (!restoreSession) {
    if (!accessCode) {
      setFinanceMessage("Please enter the finance access code.", "error");
      return;
    }

    if (!financeName) {
      setFinanceMessage("Please enter your name.", "error");
      return;
    }
  }

  setSignInBusy(true);
  setFinanceMessage(restoreSession ? "Restoring finance session..." : "Signing in...", "neutral");

  try {
    if (restoreSession) {
      const sessionResponse = await fetch("/api/finance/session");
      const sessionResult = await sessionResponse.json();

      if (!sessionResponse.ok) {
        clearStoredSession();
        setFinanceMessage("Sign in to open the finance desk.", "neutral");
        return;
      }

      state.financeName = sessionResult.financeName || state.financeName || "";
    } else {
      const sessionResponse = await fetch("/api/finance/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessCode,
          financeName,
        }),
      });
      const sessionResult = await sessionResponse.json();

      if (!sessionResponse.ok) {
        setFinanceMessage(sessionResult.error || "Could not sign in.", "error");
        return;
      }

      state.financeName = sessionResult.financeName || financeName;
    }

    await loadBookings({ skipAuthGuard: true });
    state.authenticated = true;
    localStorage.setItem("bus-booker-finance-name", state.financeName);
    financeAuthPanel.hidden = true;
    financeWorkspace.hidden = false;
    activeFinanceName.textContent = state.financeName;
    setFinanceMessage(`Signed in as ${state.financeName}.`, "success");
  } catch (error) {
    setFinanceMessage(error.message || "The server could not be reached.", "error");
  } finally {
    setSignInBusy(false);
  }
}

async function loadBookings(options = {}) {
  if (!state.authenticated && !options.skipAuthGuard) {
    return;
  }

  refreshFinanceButton.disabled = true;
  setFinanceMessage("Refreshing requests...", "neutral");

  try {
    const response = await fetch("/api/finance/bookings");
    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        await logout({ silent: true });
        setFinanceMessage("Your finance session has expired. Please sign in again.", "error");
        return;
      }

      setFinanceMessage(result.error || "Could not load requests.", "error");
      return;
    }

    state.bookings = result.bookings || [];
    renderBookings(state.bookings);
    setFinanceMessage("Requests loaded successfully.", "success");
  } catch (error) {
    setFinanceMessage(error.message || "The server could not be reached.", "error");
  } finally {
    refreshFinanceButton.disabled = false;
  }
}

function renderBookings(bookings) {
  financeTableBody.replaceChildren();
  financeTableCount.textContent = String(bookings.length);

  bookings.forEach((booking) => {
    financeTableBody.append(buildRow(booking));
  });

  if (bookings.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "table-empty";
    cell.textContent = "No requests found yet.";
    row.append(cell);
    financeTableBody.append(row);
  }
}

function buildRow(booking) {
  const fragment = financeRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector("tr");

  const fromDate = booking.fromDate || booking.travelDate;
  const toDate = booking.toDate || booking.travelDate;

  fragment.querySelector('[data-col="date"]').innerHTML = `
    <div class="table-primary">${formatDateRange(fromDate, toDate)}</div>
    <div class="table-secondary">${formatSlot(booking)}</div>
  `;
  fragment.querySelector('[data-col="requester"]').textContent = booking.requesterName || "Unknown";
  fragment.querySelector('[data-col="event"]').textContent = booking.eventName || "Untitled request";
  fragment.querySelector('[data-col="booking"]').textContent = getStatusLabel(booking.status || "pending");

  const paymentCell = fragment.querySelector('[data-col="payment"]');
  paymentCell.innerHTML = `
    <div class="table-primary">${getPaymentLabel(booking.paymentStatus)}</div>
    <div class="table-secondary">${booking.paymentReference || "No reference"}</div>
  `;

  const actionsCell = fragment.querySelector('[data-col="actions"]');
  const actions = document.createElement("div");
  actions.className = "row-actions";

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "ghost-button row-button";
  openButton.textContent = "Open";
  openButton.addEventListener("click", () => openPaymentModal(booking.id));
  actions.append(openButton);

  if (booking.status === "awaiting_payment" && booking.paymentStatus !== "confirmed") {
    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "primary-button row-button";
    confirmButton.textContent = "Confirm payment";
    confirmButton.addEventListener("click", () => openPaymentModal(booking.id, { focusReference: true }));
    actions.append(confirmButton);
  }

  actionsCell.append(actions);
  row.dataset.status = booking.status;
  return row;
}

function openPaymentModal(bookingId, options = {}) {
  const booking = state.bookings.find((item) => item.id === bookingId);

  if (!booking) {
    return;
  }

  state.activeBookingId = booking.id;
  const fromDate = booking.fromDate || booking.travelDate;
  const toDate = booking.toDate || booking.travelDate;
  financePaymentModalTitle.textContent = booking.eventName || "Confirm payment";
  financePaymentModalMeta.textContent = `${formatDateRange(fromDate, toDate)} • ${booking.requesterName}`;
  financePaymentDetails.replaceChildren();
  financeAmountCharged.value = formatMoneyInput(booking.amountCharged);
  financeAmountPaid.value = formatMoneyInput(booking.amountPaid);
  financeBalance.value = formatMoneyInput(booking.balance);
  financePaymentReference.value = booking.paymentReference || "";
  financePaymentNotes.value = booking.paymentNotes || "";
  financeAmountChargedError.textContent = "";
  financeAmountPaidError.textContent = "";
  financeBalanceError.textContent = "";
  financePaymentReferenceError.textContent = "";

  const details = [
    ["Requester", booking.requesterName || "Unknown"],
    ["Status", getStatusLabel(booking.status || "pending")],
    ["Payment status", getPaymentLabel(booking.paymentStatus)],
    ["Tracking code", booking.trackingCode || "Not available"],
    ["Booking type", booking.bookingType === "full_day" ? "Full day" : "Half day"],
    ["Slot", formatSlot(booking)],
  ];

  confirmPaymentButton.disabled = booking.status !== "awaiting_payment" || booking.paymentStatus === "confirmed";
  confirmPaymentButton.textContent = getPaymentActionLabel(booking);

  details.forEach(([term, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = value;
    financePaymentDetails.append(dt, dd);
  });

  if (financePaymentModal?.showModal) {
    financePaymentModal.showModal();
  } else {
    financePaymentModal?.setAttribute("open", "");
  }

  document.body.classList.add("dialog-open");

  if (options.focusReference) {
    financePaymentReference.focus();
  }
}

function closePaymentModal() {
  state.activeBookingId = null;

  if (financePaymentModal?.close && financePaymentModal.open) {
    financePaymentModal.close();
  } else {
    financePaymentModal?.removeAttribute("open");
  }

  document.body.classList.remove("dialog-open");
}

async function submitPaymentConfirmation() {
  const booking = state.bookings.find((item) => item.id === state.activeBookingId);
  if (!booking) {
    return;
  }

  confirmPaymentButton.disabled = true;
  financeAmountChargedError.textContent = "";
  financeAmountPaidError.textContent = "";
  financeBalanceError.textContent = "";
  financePaymentReferenceError.textContent = "";

  try {
    const response = await fetch(`/api/finance/bookings/payment?id=${encodeURIComponent(booking.id)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amountCharged: financeAmountCharged.value,
        amountPaid: financeAmountPaid.value,
        balance: financeBalance.value,
        paymentReference: financePaymentReference.value,
        paymentNotes: financePaymentNotes.value,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        await logout({ silent: true });
        setFinanceMessage("Your finance session has expired. Please sign in again.", "error");
        return;
      }

      if (result.fields?.paymentReference) {
        financePaymentReferenceError.textContent = result.fields.paymentReference;
      }
      if (result.fields?.amountCharged) {
        financeAmountChargedError.textContent = result.fields.amountCharged;
      }
      if (result.fields?.amountPaid) {
        financeAmountPaidError.textContent = result.fields.amountPaid;
      }
      if (result.fields?.balance) {
        financeBalanceError.textContent = result.fields.balance;
      }
      setFinanceMessage(result.error || "Could not confirm payment.", "error");
      return;
    }

    const notificationNotes = (result.notifications?.results || [])
      .map((entry) => `${entry.channel}: ${entry.status}`)
      .join(" | ");

    setFinanceMessage(
      `${result.message || "Payment confirmed."}${notificationNotes ? ` Notification status: ${notificationNotes}.` : ""}`,
      "success",
    );
    closePaymentModal();
    await loadBookings();
  } catch (error) {
    setFinanceMessage(error.message || "The server could not be reached.", "error");
  } finally {
    confirmPaymentButton.disabled = false;
    confirmPaymentButton.textContent = "Confirm payment";
  }
}

async function logout(options = {}) {
  const { silent = false } = options;

  try {
    await fetch("/api/finance/session", {
      method: "DELETE",
    });
  } catch {
    // ignore network errors on logout cleanup
  }

  clearStoredSession();
  state.authenticated = false;
  state.financeName = "";
  state.bookings = [];
  state.activeBookingId = null;

  financeAccessCodeInput.value = "";
  financeNameInput.value = "";
  financeAuthPanel.hidden = false;
  financeWorkspace.hidden = true;
  activeFinanceName.textContent = "";
  financeTableBody.replaceChildren();
  financeTableCount.textContent = "0";
  closePaymentModal();

  if (!silent) {
    setFinanceMessage("Signed out of the finance desk.", "neutral");
  }
}

function clearStoredSession() {
  localStorage.removeItem("bus-booker-finance-name");
}

async function restoreSession() {
  if (state.financeName) {
    financeNameInput.value = state.financeName;
  }

  await signIn({ restoreSession: true });
}

function setSignInBusy(isBusy) {
  financeSignInButton.disabled = isBusy;
  financeAccessCodeInput.disabled = isBusy;
  financeNameInput.disabled = isBusy;
}

function setFinanceMessage(message, tone) {
  financeMessage.textContent = message;

  if (tone === "neutral") {
    financeMessage.removeAttribute("data-tone");
    return;
  }

  financeMessage.dataset.tone = tone;
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

function formatSlot(booking) {
  if (booking.bookingType === "full_day") {
    return "Full day";
  }

  return booking.timeSlot === "morning" ? "Half day • morning" : "Half day • afternoon";
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

function getPaymentLabel(status) {
  if (status === "confirmed") {
    return "Confirmed";
  }

  return "Pending";
}

function getPaymentActionLabel(booking) {
  if (booking.status === "awaiting_payment" && booking.paymentStatus !== "confirmed") {
    return "Confirm payment";
  }

  if (booking.paymentStatus === "confirmed") {
    return "Payment confirmed";
  }

  return "Waiting for admin approval";
}

function formatMoneyInput(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "";
  }

  return String(value);
}
