"use client";

import { useEffect, useMemo, useState } from "react";

const initialAccessSettings = { accessCode: "", name: "" };
const initialErrors = { financeName: "", accessCode: "" };
const initialPaymentErrors = {
  amountCharged: "",
  amountPaid: "",
  balance: "",
  paymentReference: "",
};

export default function FinanceDesk() {
  const [financeName, setFinanceName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState({ text: "Sign in to open the finance desk.", tone: "neutral" });
  const [signInBusy, setSignInBusy] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [accessSettings, setAccessSettings] = useState(initialAccessSettings);
  const [settingsErrors, setSettingsErrors] = useState(initialErrors);
  const [savingAccessSettings, setSavingAccessSettings] = useState(false);
  const [modalBookingId, setModalBookingId] = useState(null);
  const [paymentDraft, setPaymentDraft] = useState({
    amountCharged: "",
    amountPaid: "",
    balance: "",
    paymentReference: "",
    paymentNotes: "",
  });
  const [paymentErrors, setPaymentErrors] = useState(initialPaymentErrors);
  const [paymentBusy, setPaymentBusy] = useState(false);

  useEffect(() => {
    const storedName = window.localStorage.getItem("bus-booker-finance-name") || "";
    setFinanceName(storedName);
    void signIn({ restoreSession: true, storedName });
  }, []);

  const activeBooking = useMemo(
    () => bookings.find((booking) => booking.id === modalBookingId) || null,
    [bookings, modalBookingId],
  );

  const signIn = async ({ restoreSession = false, storedName = "" } = {}) => {
    const nextFinanceName = restoreSession ? storedName || financeName : financeName.trim();
    const nextAccessCode = accessCode.trim();
    let signedInName = nextFinanceName;

    if (!restoreSession) {
      if (!nextAccessCode) {
        setMessage({ text: "Please enter the finance access code.", tone: "error" });
        return;
      }

      if (!nextFinanceName) {
        setMessage({ text: "Please enter the finance officer name.", tone: "error" });
        return;
      }
    }

    setSignInBusy(true);
    setMessage({ text: restoreSession ? "Restoring finance session..." : "Signing in...", tone: "neutral" });

    try {
      if (restoreSession) {
        const sessionResponse = await fetch("/api/finance/session");
        const sessionResult = await sessionResponse.json();

        if (!sessionResponse.ok) {
          clearStoredSession();
          setAuthenticated(false);
          setMessage({ text: "Sign in to open the finance desk.", tone: "neutral" });
          return;
        }

        signedInName = sessionResult.financeName || nextFinanceName || "";
        setFinanceName(signedInName);
      } else {
        const sessionResponse = await fetch("/api/finance/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessCode: nextAccessCode,
            financeName: nextFinanceName,
          }),
        });
        const sessionResult = await sessionResponse.json();

        if (!sessionResponse.ok) {
          setMessage({ text: sessionResult.error || "Could not sign in.", tone: "error" });
          return;
        }

        signedInName = sessionResult.financeName || nextFinanceName;
        setFinanceName(signedInName);
      }

      const [accessSettingsResponse, bookingsResponse] = await Promise.all([
        fetch("/api/finance/access-settings"),
        fetch("/api/finance/bookings"),
      ]);
      const accessSettingsResult = await accessSettingsResponse.json();
      const bookingsResult = await bookingsResponse.json();

      if (!accessSettingsResponse.ok) {
        setMessage({ text: accessSettingsResult.error || "Could not load finance sign-in settings.", tone: "error" });
        return;
      }

      if (!bookingsResponse.ok) {
        setMessage({ text: bookingsResult.error || "Could not load requests.", tone: "error" });
        return;
      }

      setAuthenticated(true);
      setBookings(bookingsResult.bookings || []);
      setAccessSettings(accessSettingsResult.settings || initialAccessSettings);
      window.localStorage.setItem("bus-booker-finance-name", signedInName);
      setMessage({ text: `Signed in as ${signedInName}.`, tone: "success" });
    } catch (error) {
      setMessage({ text: error.message || "The server could not be reached.", tone: "error" });
    } finally {
      setSignInBusy(false);
    }
  };

  const loadBookings = async ({ skipAuthGuard = false } = {}) => {
    if (!authenticated && !skipAuthGuard) return;

    setMessage({ text: "Refreshing requests...", tone: "neutral" });

    try {
      const response = await fetch("/api/finance/bookings");
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout({ silent: true });
          setMessage({ text: "Your finance session has expired. Please sign in again.", tone: "error" });
          return;
        }

        setMessage({ text: result.error || "Could not load requests.", tone: "error" });
        return;
      }

      setBookings(result.bookings || []);
      if (modalBookingId && !result.bookings?.some((booking) => booking.id === modalBookingId)) {
        setModalBookingId(null);
      }
      setMessage({ text: "Requests loaded successfully.", tone: "success" });
    } catch (error) {
      setMessage({ text: error.message || "The server could not be reached.", tone: "error" });
    }
  };

  const saveAccessSettings = async (event) => {
    event.preventDefault();
    if (!authenticated) return;

    setSavingAccessSettings(true);
    setSettingsErrors(initialErrors);
    setMessage({ text: "Saving finance sign-in settings...", tone: "neutral" });

    try {
      const response = await fetch("/api/finance/access-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accessSettings),
      });
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout({ silent: true });
          setMessage({ text: "Your finance session has expired. Please sign in again.", tone: "error" });
          return;
        }

        setSettingsErrors({
          financeName: result.fields?.financeName || "",
          accessCode: result.fields?.accessCode || "",
        });
        setMessage({ text: result.error || "Could not save finance sign-in settings.", tone: "error" });
        return;
      }

      setAccessSettings(result.settings || initialAccessSettings);
      setFinanceName(result.settings?.name || "");
      window.localStorage.setItem("bus-booker-finance-name", result.settings?.name || "");
      setMessage({ text: result.message || "Finance sign-in settings saved.", tone: "success" });
    } catch (error) {
      setMessage({ text: error.message || "The server could not be reached.", tone: "error" });
    } finally {
      setSavingAccessSettings(false);
    }
  };

  const logout = async ({ silent = false } = {}) => {
    try {
      await fetch("/api/finance/session", { method: "DELETE" });
    } catch {
      // ignore
    }

    clearStoredSession();
    setAuthenticated(false);
    setFinanceName("");
    setAccessCode("");
    setBookings([]);
    setAccessSettings(initialAccessSettings);
    setModalBookingId(null);
    setPaymentDraft({
      amountCharged: "",
      amountPaid: "",
      balance: "",
      paymentReference: "",
      paymentNotes: "",
    });
    setPaymentErrors(initialPaymentErrors);

    if (!silent) {
      setMessage({ text: "Signed out of the finance desk.", tone: "neutral" });
    }
  };

  const openModal = (booking) => {
    setModalBookingId(booking.id);
    setPaymentDraft({
      amountCharged: formatMoneyInput(booking.amountCharged),
      amountPaid: formatMoneyInput(booking.amountPaid),
      balance: formatMoneyInput(booking.balance),
      paymentReference: booking.paymentReference || "",
      paymentNotes: booking.paymentNotes || "",
    });
    setPaymentErrors(initialPaymentErrors);
  };

  const submitPayment = async () => {
    if (!activeBooking) return;

    setPaymentBusy(true);
    setPaymentErrors(initialPaymentErrors);

    try {
      const response = await fetch(`/api/finance/bookings/payment?id=${encodeURIComponent(activeBooking.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentDraft),
      });
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout({ silent: true });
          setMessage({ text: "Your finance session has expired. Please sign in again.", tone: "error" });
          return;
        }

        setPaymentErrors({
          amountCharged: result.fields?.amountCharged || "",
          amountPaid: result.fields?.amountPaid || "",
          balance: result.fields?.balance || "",
          paymentReference: result.fields?.paymentReference || "",
        });
        setMessage({ text: result.error || "Could not confirm payment.", tone: "error" });
        return;
      }

      const notificationNotes = (result.notifications?.results || [])
        .map((entry) => `${entry.channel}: ${entry.status}`)
        .join(" | ");

      setMessage({
        text: `${result.message || "Payment confirmed."}${notificationNotes ? ` Notification status: ${notificationNotes}.` : ""}`,
        tone: "success",
      });
      setModalBookingId(null);
      await loadBookings();
    } catch (error) {
      setMessage({ text: error.message || "The server could not be reached.", tone: "error" });
    } finally {
      setPaymentBusy(false);
    }
  };

  return (
    <>
      <section className="admin-stage admin-stage-auth-only" hidden={authenticated}>
        <section id="financeAuthPanel" className="auth-panel">
          <form
            id="financeSignInForm"
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void signIn();
            }}
          >
            <div>
              <p className="eyebrow">Finance Sign In</p>
              <h2>Open the finance desk</h2>
            </div>

            <label>
              <span>Finance access code</span>
              <input
                id="financeAccessCode"
                type="password"
                placeholder="Enter finance code"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                disabled={signInBusy}
              />
            </label>

            <label>
              <span>Officer name</span>
              <input
                id="financeName"
                type="text"
                placeholder="Finance officer"
                value={financeName}
                onChange={(event) => setFinanceName(event.target.value)}
                disabled={signInBusy}
              />
            </label>

            <button id="financeSignInButton" className="primary-button" type="submit" disabled={signInBusy}>
              Sign in
            </button>
            <p className="helper-text">Confirm payments after transport admin approves a request to pay.</p>
          </form>
        </section>
      </section>

      <div id="financeMessage" className="form-message" aria-live="polite" data-tone={message.tone || undefined}>
        {message.text}
      </div>

      <section id="financeWorkspace" className="panel admin-workspace" hidden={!authenticated}>
        <div className="workspace-head">
          <div>
            <p className="eyebrow">Finance Workspace</p>
            <h2>Confirm approved payments</h2>
            <p className="panel-copy">
              Signed in as <strong id="activeFinanceName">{financeName}</strong>.
            </p>
          </div>

          <div className="workspace-actions">
            <button id="refreshFinanceButton" className="ghost-button" type="button" onClick={() => void loadBookings()}>
              Refresh
            </button>
            <button id="financeLogoutButton" className="ghost-button" type="button" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </div>

        <section className="request-table-panel">
          <div className="section-title">
            <h3 className="font-display text-2xl leading-tight text-slate-900">Desk sign-in settings</h3>
          </div>

          <form id="financeAccessSettingsForm" className="panel compact-settings-panel" onSubmit={saveAccessSettings}>
            <p className="panel-copy">
              These values start from environment variables and can be changed here for future finance sign-ins.
            </p>

            <div className="booking-form compact-settings-grid">
              <label>
                <span>Finance officer name</span>
                <input
                  id="financeSettingsName"
                  type="text"
                  placeholder="Finance officer"
                  value={accessSettings.name}
                  onChange={(event) => setAccessSettings((current) => ({ ...current, name: event.target.value }))}
                />
                <small id="financeSettingsNameError">{settingsErrors.financeName}</small>
              </label>

              <label>
                <span>Finance access code</span>
                <input
                  id="financeSettingsAccessCode"
                  type="text"
                  placeholder="Enter finance access code"
                  value={accessSettings.accessCode}
                  onChange={(event) => setAccessSettings((current) => ({ ...current, accessCode: event.target.value }))}
                />
                <small id="financeSettingsAccessCodeError">{settingsErrors.accessCode}</small>
              </label>
            </div>

            <div className="workspace-actions">
              <button
                id="saveFinanceAccessSettingsButton"
                className="primary-button"
                type="submit"
                disabled={savingAccessSettings}
              >
                Save sign-in settings
              </button>
            </div>
          </form>
        </section>

        <section className="request-table-panel">
          <div className="section-title">
            <h3>Payment queue</h3>
            <span id="financeTableCount" className="count-pill">
              {bookings.length}
            </span>
          </div>

          <div className="request-table-wrap">
            <table className="request-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Requester</th>
                  <th>Event</th>
                  <th>Stage</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="financeTableBody">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="table-empty">
                      No requests found yet.
                    </td>
                  </tr>
                ) : (
                  bookings.map((booking) => <FinanceRow key={booking.id} booking={booking} onOpen={() => openModal(booking)} />)
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {activeBooking ? (
        <dialog open id="financePaymentModal" className="booking-dialog request-modal" aria-labelledby="financePaymentModalTitle">
          <div className="dialog-shell request-modal-shell">
            <div className="dialog-head">
              <div>
                <p className="eyebrow">Payment Confirmation</p>
                <h2 id="financePaymentModalTitle">{activeBooking.eventName || "Confirm payment"}</h2>
                <p id="financePaymentModalMeta" className="panel-copy">
                  {formatDateRange(getFromDate(activeBooking), getToDate(activeBooking))} • {activeBooking.requesterName}
                </p>
              </div>
              <button
                id="closeFinancePaymentModalButton"
                className="icon-button"
                type="button"
                aria-label="Close payment modal"
                onClick={() => setModalBookingId(null)}
              >
                ×
              </button>
            </div>

            <div className="request-modal-grid">
              <section className="request-modal-card">
                <dl id="financePaymentDetails" className="booking-details request-modal-details">
                  {buildFinanceDetails(activeBooking).map(([term, value]) => (
                    <FragmentPair key={term} term={term} value={value} />
                  ))}
                </dl>
              </section>

              <section className="request-modal-card">
                <label>
                  <span>Amount charged (GH₵)</span>
                  <input
                    id="financeAmountCharged"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentDraft.amountCharged}
                    onChange={(event) => setPaymentDraft((current) => ({ ...current, amountCharged: event.target.value }))}
                  />
                  <small id="financeAmountChargedError">{paymentErrors.amountCharged}</small>
                </label>
                <label>
                  <span>Amount paid (GH₵)</span>
                  <input
                    id="financeAmountPaid"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentDraft.amountPaid}
                    onChange={(event) => setPaymentDraft((current) => ({ ...current, amountPaid: event.target.value }))}
                  />
                  <small id="financeAmountPaidError">{paymentErrors.amountPaid}</small>
                </label>
                <label>
                  <span>Balance (GH₵)</span>
                  <input
                    id="financeBalance"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentDraft.balance}
                    onChange={(event) => setPaymentDraft((current) => ({ ...current, balance: event.target.value }))}
                  />
                  <small id="financeBalanceError">{paymentErrors.balance}</small>
                </label>
                <label>
                  <span>Payment reference</span>
                  <input
                    id="financePaymentReference"
                    type="text"
                    placeholder="Receipt or transaction reference"
                    value={paymentDraft.paymentReference}
                    onChange={(event) =>
                      setPaymentDraft((current) => ({ ...current, paymentReference: event.target.value }))
                    }
                  />
                  <small id="financePaymentReferenceError">{paymentErrors.paymentReference}</small>
                </label>
                <label>
                  <span>Finance notes</span>
                  <textarea
                    id="financePaymentNotes"
                    rows="4"
                    placeholder="Optional notes"
                    value={paymentDraft.paymentNotes}
                    onChange={(event) => setPaymentDraft((current) => ({ ...current, paymentNotes: event.target.value }))}
                  />
                </label>
                <div className="decision-actions">
                  <button
                    id="confirmPaymentButton"
                    type="button"
                    className="primary-button"
                    disabled={paymentBusy || activeBooking.status !== "awaiting_payment" || activeBooking.paymentStatus === "confirmed"}
                    onClick={() => void submitPayment()}
                  >
                    {getPaymentActionLabel(activeBooking)}
                  </button>
                  <button id="cancelPaymentButton" type="button" className="ghost-button" onClick={() => setModalBookingId(null)}>
                    Cancel
                  </button>
                </div>
              </section>
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}

function FinanceRow({ booking, onOpen }) {
  return (
    <tr data-status={booking.status}>
      <td>
        <div className="table-primary">{formatDateRange(getFromDate(booking), getToDate(booking))}</div>
        <div className="table-secondary">{formatSlot(booking)}</div>
      </td>
      <td>{booking.requesterName || "Unknown"}</td>
      <td>{booking.eventName || "Untitled request"}</td>
      <td>{getStatusLabel(booking.status || "pending")}</td>
      <td>
        <div className="table-primary">{getPaymentLabel(booking.paymentStatus)}</div>
        <div className="table-secondary">{booking.paymentReference || "No reference"}</div>
      </td>
      <td>
        <div className="row-actions">
          <button type="button" className="ghost-button row-button" onClick={onOpen}>
            Open
          </button>
          {booking.status === "awaiting_payment" && booking.paymentStatus !== "confirmed" ? (
            <button type="button" className="primary-button row-button" onClick={onOpen}>
              Confirm payment
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function FragmentPair({ term, value }) {
  return (
    <>
      <dt>{term}</dt>
      <dd>{value}</dd>
    </>
  );
}

function buildFinanceDetails(booking) {
  return [
    ["Requester", booking.requesterName || "Unknown"],
    ["Status", getStatusLabel(booking.status || "pending")],
    ["Payment status", getPaymentLabel(booking.paymentStatus)],
    ["Tracking code", booking.trackingCode || "Not available"],
    ["Booking type", booking.bookingType === "full_day" ? "Full day" : "Half day"],
    ["Slot", formatSlot(booking)],
  ];
}

function getFromDate(booking) {
  return booking.fromDate || booking.travelDate;
}

function getToDate(booking) {
  return booking.toDate || booking.travelDate;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function formatDateRange(fromDate, toDate) {
  return fromDate === toDate ? formatDate(fromDate) : `${formatDate(fromDate)} to ${formatDate(toDate)}`;
}

function formatSlot(booking) {
  if (booking.bookingType === "full_day") return "Full day";
  return booking.timeSlot === "morning" ? "Half day • morning" : "Half day • afternoon";
}

function getStatusLabel(status) {
  if (status === "awaiting_payment") return "Awaiting payment";
  if (status === "approved") return "Released";
  if (status === "declined") return "Declined";
  return "Pending review";
}

function getPaymentLabel(status) {
  return status === "confirmed" ? "Confirmed" : "Pending";
}

function getPaymentActionLabel(booking) {
  if (booking.status === "awaiting_payment" && booking.paymentStatus !== "confirmed") return "Confirm payment";
  if (booking.paymentStatus === "confirmed") return "Payment confirmed";
  return "Waiting for admin approval";
}

function formatMoneyInput(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  return String(value);
}

function clearStoredSession() {
  window.localStorage.removeItem("bus-booker-finance-name");
}
