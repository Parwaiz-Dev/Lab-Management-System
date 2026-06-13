import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "../../../components/ui/Card";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import type { BadgeTone } from "../../../components/ui/Badge";
import Toast from "../../../components/ui/Toast";
import { auditService } from "../services/auditService";
import type { AuditLogEntry, AuditSummary, ToastMessage } from "../../../types";

const PAGE_SIZE = 50;

const ACTION_TONES: Record<string, BadgeTone> = {
  create: "success",
  update: "warning",
  delete: "danger",
  login: "info",
  logout: "neutral",
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso + "Z");
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function renderJson(data: string | null): string {
  if (!data) return "—";
  try {
    return JSON.stringify(JSON.parse(data), null, 2);
  } catch {
    return data;
  }
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Summary card interaction
  type SummaryCardKey = "totalEvents" | "usersActive" | "create" | "updateDelete";
  const [activeSummaryCard, setActiveSummaryCard] = useState<SummaryCardKey | null>(null);

  // Detail drawer
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  const fetchLogs = useCallback(
    async (resetOffset: boolean) => {
      setLoading(true);
      setError(null);
      const currentOffset = resetOffset ? 0 : offset;
      if (resetOffset) setOffset(0);

      try {
        const result = await auditService.getAuditLogs({
          limit: PAGE_SIZE,
          offset: currentOffset,
        });
        if (resetOffset) {
          setLogs(result);
        } else {
          setLogs((prev) => [...prev, ...result]);
        }
        setHasMore(result.length === PAGE_SIZE);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load audit logs";
        setError(msg);
        setToast({ message: msg, type: "error" });
      } finally {
        setLoading(false);
      }
    },
    [offset],
  );

  useEffect(() => {
    fetchLogs(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Summary (computed from ALL loaded logs) ──
  const summary = useMemo<AuditSummary>(() => {
    const userIds = new Set<number>();
    let createCount = 0;
    let updateDeleteCount = 0;

    for (const l of logs) {
      userIds.add(l.user_id);
      if (l.action === "create") createCount++;
      if (l.action === "update" || l.action === "delete") updateDeleteCount++;
    }

    return {
      totalEvents: logs.length,
      usersActive: userIds.size,
      createActions: createCount,
      updateDeleteActions: updateDeleteCount,
    };
  }, [logs]);

  // ── Filtered & paginated ──
  const filteredLogs = useMemo(() => {
    let result = logs;

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (l) =>
          l.username.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.table_name.toLowerCase().includes(q) ||
          (l.record_id !== null && String(l.record_id).includes(q)),
      );
    }

    if (actionFilter) {
      result = result.filter((l) => l.action === actionFilter);
    }

    // Summary card multi-action filter (update + delete)
    if (activeSummaryCard === "updateDelete") {
      result = result.filter((l) => l.action === "update" || l.action === "delete");
    }

    if (tableFilter) {
      result = result.filter((l) => l.table_name === tableFilter);
    }

    if (dateFrom) {
      const from = new Date(dateFrom + "T00:00:00");
      result = result.filter(
        (l) => new Date(l.created_at + "Z") >= from,
      );
    }

    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59.999");
      result = result.filter(
        (l) => new Date(l.created_at + "Z") <= to,
      );
    }

    return result;
  }, [logs, search, actionFilter, tableFilter, dateFrom, dateTo, activeSummaryCard]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, actionFilter, tableFilter, dateFrom, dateTo, activeSummaryCard]);

  const uniqueActions = useMemo(
    () => [...new Set(logs.map((l) => l.action))].sort(),
    [logs],
  );

  const uniqueTables = useMemo(
    () => [...new Set(logs.map((l) => l.table_name))].sort(),
    [logs],
  );

  const loadMore = () => {
    setOffset((prev) => prev + PAGE_SIZE);
    fetchLogs(false);
  };

  const clearFilters = () => {
    setSearch("");
    setActionFilter("");
    setTableFilter("");
    setDateFrom("");
    setDateTo("");
    setActiveSummaryCard(null);
  };

  const handleSummaryCardClick = (key: SummaryCardKey) => {
    if (activeSummaryCard === key) {
      setActiveSummaryCard(null);
      setActionFilter("");
    } else {
      setActiveSummaryCard(key);
      if (key === "totalEvents") setActionFilter("");
      else if (key === "create") setActionFilter("create");
      // updateDelete and usersActive: don't touch actionFilter dropdown
    }
  };

  const hasActiveFilters =
    search !== "" ||
    actionFilter !== "" ||
    tableFilter !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    activeSummaryCard !== null;

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Generate page numbers with ellipsis
  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, currentPage]);

  const hasAllLogs = !hasMore && !hasActiveFilters;

  return (
    <div className="audit-page">
      {/* ── Summary Cards ── */}
      <div className="audit-summary">
        <button
          type="button"
          className={`audit-summary-card${activeSummaryCard === "totalEvents" ? " audit-summary-card--active" : ""}`}
          onClick={() => handleSummaryCardClick("totalEvents")}
          aria-pressed={activeSummaryCard === "totalEvents"}
          aria-label="Show all events"
        >
          <div className="audit-summary-card__value">{summary.totalEvents}</div>
          <div className="audit-summary-card__label">Total Events</div>
        </button>
        <button
          type="button"
          className={`audit-summary-card${activeSummaryCard === "usersActive" ? " audit-summary-card--active" : ""}`}
          onClick={() => handleSummaryCardClick("usersActive")}
          aria-pressed={activeSummaryCard === "usersActive"}
          aria-label="Users active (informational only, does not filter)"
          title="Informational only — shows unique users across all loaded events"
        >
          <div className="audit-summary-card__value">{summary.usersActive}</div>
          <div className="audit-summary-card__label">Users Active</div>
        </button>
        <button
          type="button"
          className={`audit-summary-card${activeSummaryCard === "create" ? " audit-summary-card--active" : ""}`}
          onClick={() => handleSummaryCardClick("create")}
          aria-pressed={activeSummaryCard === "create"}
          aria-label="Filter by create actions"
        >
          <div className="audit-summary-card__value">{summary.createActions}</div>
          <div className="audit-summary-card__label">Create Actions</div>
        </button>
        <button
          type="button"
          className={`audit-summary-card${activeSummaryCard === "updateDelete" ? " audit-summary-card--active" : ""}`}
          onClick={() => handleSummaryCardClick("updateDelete")}
          aria-pressed={activeSummaryCard === "updateDelete"}
          aria-label="Filter by update and delete actions"
        >
          <div className="audit-summary-card__value">{summary.updateDeleteActions}</div>
          <div className="audit-summary-card__label">Update / Delete</div>
        </button>
      </div>

      {/* ── Filter Bar ── */}
      <Card className="audit-filters-card">
        <div className="audit-filters">
          <div className="audit-filters__search">
            <Input
              placeholder="Search by user, action, table, or record ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveSummaryCard(null);
              }}
            />
          </div>

          <div className="audit-filters__selects">
            <select
              className="audit-filter-select"
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setActiveSummaryCard(null);
              }}
            >
              <option value="">All Actions</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            <select
              className="audit-filter-select"
              value={tableFilter}
              onChange={(e) => {
                setTableFilter(e.target.value);
                setActiveSummaryCard(null);
              }}
            >
              <option value="">All Tables</option>
              {uniqueTables.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="audit-filters__dates">
            <div className="audit-filter-date-wrap">
              <input
                type="date"
                className={`audit-filter-date${!dateFrom ? " audit-filter-date--empty" : ""}`}
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setActiveSummaryCard(null);
                }}
                aria-label="From date"
                title="Start date"
              />
              {!dateFrom && <span className="audit-filter-date__placeholder" aria-hidden="true">From</span>}
            </div>
            <span className="audit-filters__date-sep">to</span>
            <div className="audit-filter-date-wrap">
              <input
                type="date"
                className={`audit-filter-date${!dateTo ? " audit-filter-date--empty" : ""}`}
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setActiveSummaryCard(null);
                }}
                aria-label="To date"
                title="End date"
              />
              {!dateTo && <span className="audit-filter-date__placeholder" aria-hidden="true">To</span>}
            </div>
          </div>

          <div className="audit-filters__actions">
            <Button
              variant="ghost"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              aria-label="Clear all filters"
            >
              Clear Filters
            </Button>

            <Button variant="ghost" onClick={() => fetchLogs(true)} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Table ── */}
      <Card className="audit-table-card">
        {loading && logs.length === 0 ? (
          <div className="audit-loading">
            <span className="ui-spinner" aria-hidden="true" />
            <p>Loading audit logs…</p>
          </div>
        ) : error && logs.length === 0 ? (
          <div className="audit-empty">
            <div className="audit-empty__icon">⚠️</div>
            <strong>Failed to load audit logs</strong>
            <p>{error}</p>
            <Button variant="primary" onClick={() => fetchLogs(true)}>
              Retry
            </Button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="audit-empty">
            <div className="audit-empty__icon">📋</div>
            <strong>
              {hasActiveFilters
                ? "No matching audit entries"
                : "No audit entries yet"}
            </strong>
            <p>
              {hasActiveFilters
                ? "Try adjusting your filters or search term."
                : "Audit logs will appear here as actions are performed in the system."}
            </p>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="audit-table-wrap">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Table</th>
                    <th>Record ID</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((entry) => (
                    <tr
                      key={entry.id}
                      className="audit-table__row"
                      onClick={() => setSelectedEntry(entry)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedEntry(entry);
                        }
                      }}
                    >
                      <td className="audit-table__timestamp">
                        {formatTimestamp(entry.created_at)}
                      </td>
                      <td>
                        <span className="audit-table__user">{entry.username}</span>
                      </td>
                      <td>
                        <Badge
                          tone={ACTION_TONES[entry.action] ?? "neutral"}
                        >
                          {entry.action}
                        </Badge>
                      </td>
                      <td className="audit-table__table">{entry.table_name}</td>
                      <td className="audit-table__record-id">
                        {entry.record_id !== null ? entry.record_id : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            <div className="audit-pagination">
              <div className="audit-table__count">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} of{" "}
                {filteredLogs.length}
                {!hasAllLogs && "+"} entries
              </div>

              <div className="audit-pagination__controls">
                <Button
                  variant="ghost"
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                  aria-label="Previous page"
                >
                  ‹ Prev
                </Button>

                {pageNumbers.map((p, i) =>
                  p === "..." ? (
                    <span key={`ellipsis-${i}`} className="audit-pagination__ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`audit-pagination__page${p === currentPage ? " audit-pagination__page--active" : ""}`}
                      onClick={() => goToPage(p)}
                      aria-label={`Page ${p}`}
                      aria-current={p === currentPage ? "page" : undefined}
                    >
                      {p}
                    </button>
                  ),
                )}

                <Button
                  variant="ghost"
                  disabled={currentPage >= totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                  aria-label="Next page"
                >
                  Next ›
                </Button>
              </div>
            </div>

            {/* ── Load More (when there's more server data) ── */}
            {hasMore && !hasActiveFilters && (
              <div className="audit-load-more">
                <Button variant="ghost" onClick={loadMore} disabled={loading}>
                  {loading ? "Loading…" : "Load More Records"}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ── Detail Drawer ── */}
      {selectedEntry && (
        <div
          className="audit-drawer-overlay"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="audit-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Audit log detail"
          >
            <div className="audit-drawer__header">
              <h2 className="audit-drawer__title">Audit Entry Detail</h2>
              <button
                type="button"
                className="audit-drawer__close"
                onClick={() => setSelectedEntry(null)}
                aria-label="Close detail"
              >
                ✕
              </button>
            </div>

            <div className="audit-drawer__body">
              <div className="audit-detail-grid">
                <div className="audit-detail-item">
                  <span className="audit-detail-label">ID</span>
                  <span className="audit-detail-value">{selectedEntry.id}</span>
                </div>
                <div className="audit-detail-item">
                  <span className="audit-detail-label">Timestamp</span>
                  <span className="audit-detail-value">
                    {formatTimestamp(selectedEntry.created_at)}
                  </span>
                </div>
                <div className="audit-detail-item">
                  <span className="audit-detail-label">User</span>
                  <span className="audit-detail-value">
                    {selectedEntry.username}
                  </span>
                </div>
                <div className="audit-detail-item">
                  <span className="audit-detail-label">Action</span>
                  <span className="audit-detail-value">
                    <Badge
                      tone={
                        ACTION_TONES[selectedEntry.action] ?? "neutral"
                      }
                    >
                      {selectedEntry.action}
                    </Badge>
                  </span>
                </div>
                <div className="audit-detail-item">
                  <span className="audit-detail-label">Table</span>
                  <span className="audit-detail-value">
                    {selectedEntry.table_name}
                  </span>
                </div>
                <div className="audit-detail-item">
                  <span className="audit-detail-label">Record ID</span>
                  <span className="audit-detail-value">
                    {selectedEntry.record_id !== null
                      ? selectedEntry.record_id
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="audit-detail-json-group">
                <h3 className="audit-detail-subtitle">Old Data</h3>
                <pre className="audit-detail-json">
                  {renderJson(selectedEntry.old_data)}
                </pre>
              </div>

              <div className="audit-detail-json-group">
                <h3 className="audit-detail-subtitle">New Data</h3>
                <pre className="audit-detail-json">
                  {renderJson(selectedEntry.new_data)}
                </pre>
              </div>
            </div>

            <div className="audit-drawer__footer">
              <Button variant="ghost" onClick={() => setSelectedEntry(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}