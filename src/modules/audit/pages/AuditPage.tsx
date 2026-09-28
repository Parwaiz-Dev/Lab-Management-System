import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit3,
  Filter,
  Folders,
  RefreshCw,
  RotateCcw,
  UserCheck,
} from "lucide-react";
import Card from "../../../components/ui/Card";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import Modal from "../../../components/ui/Modal";
import EmptyState from "../../../components/ui/EmptyState";
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
    const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
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
  if (!data || data.trim() === "" || data.trim() === "null") return "—";
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

  // Detail Modal
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

  // ── Summary (computed from loaded logs) ──
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

    if (activeSummaryCard === "updateDelete") {
      result = result.filter((l) => l.action === "update" || l.action === "delete");
    }

    if (tableFilter) {
      result = result.filter((l) => l.table_name === tableFilter);
    }

    if (dateFrom) {
      const from = new Date(dateFrom + "T00:00:00");
      result = result.filter(
        (l) => new Date(l.created_at.endsWith("Z") ? l.created_at : l.created_at + "Z") >= from,
      );
    }

    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59.999");
      result = result.filter(
        (l) => new Date(l.created_at.endsWith("Z") ? l.created_at : l.created_at + "Z") <= to,
      );
    }

    return result;
  }, [logs, search, actionFilter, tableFilter, dateFrom, dateTo, activeSummaryCard]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

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
      {/* ── Metric Summary Cards ── */}
      <div className="audit-summary">
        <button
          type="button"
          className={`audit-summary-card${activeSummaryCard === "totalEvents" ? " audit-summary-card--active" : ""}`}
          onClick={() => handleSummaryCardClick("totalEvents")}
          aria-pressed={activeSummaryCard === "totalEvents"}
        >
          <div className="audit-summary-card__header">
            <span className="audit-summary-card__label">Total Events</span>
            <Activity size={16} className="text-slate-400" />
          </div>
          <div className="audit-summary-card__value">{summary.totalEvents}</div>
        </button>

        <button
          type="button"
          className={`audit-summary-card${activeSummaryCard === "usersActive" ? " audit-summary-card--active" : ""}`}
          onClick={() => handleSummaryCardClick("usersActive")}
          aria-pressed={activeSummaryCard === "usersActive"}
        >
          <div className="audit-summary-card__header">
            <span className="audit-summary-card__label">Active Users</span>
            <UserCheck size={16} className="text-emerald-500" />
          </div>
          <div className="audit-summary-card__value">{summary.usersActive}</div>
        </button>

        <button
          type="button"
          className={`audit-summary-card${activeSummaryCard === "create" ? " audit-summary-card--active" : ""}`}
          onClick={() => handleSummaryCardClick("create")}
          aria-pressed={activeSummaryCard === "create"}
        >
          <div className="audit-summary-card__header">
            <span className="audit-summary-card__label">Create Actions</span>
            <CheckCircle2 size={16} className="text-blue-500" />
          </div>
          <div className="audit-summary-card__value">{summary.createActions}</div>
        </button>

        <button
          type="button"
          className={`audit-summary-card${activeSummaryCard === "updateDelete" ? " audit-summary-card--active" : ""}`}
          onClick={() => handleSummaryCardClick("updateDelete")}
          aria-pressed={activeSummaryCard === "updateDelete"}
        >
          <div className="audit-summary-card__header">
            <span className="audit-summary-card__label">Updates & Deletes</span>
            <Edit3 size={16} className="text-amber-500" />
          </div>
          <div className="audit-summary-card__value">{summary.updateDeleteActions}</div>
        </button>
      </div>

      {/* ── Filter Toolbar ── */}
      <Card
        className="audit-filters-card"
        icon={<Filter size={18} />}
        title="Audit Filters"
        eyebrow="Filter and search system change records"
        right={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              icon={<RotateCcw size={14} />}
            >
              Reset
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchLogs(true)}
              disabled={loading}
              icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        }
      >
        <div className="audit-filters">
          <div className="audit-filters__search">
            <Input
              placeholder="Search user, action, table, or record ID…"
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
                  {a.toUpperCase()}
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
              <span className="audit-filter-date-label">From</span>
              <input
                type="date"
                className="audit-filter-date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setActiveSummaryCard(null);
                }}
              />
            </div>

            <div className="audit-filter-date-wrap">
              <span className="audit-filter-date-label">To</span>
              <input
                type="date"
                className="audit-filter-date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setActiveSummaryCard(null);
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* ── Table Card ── */}
      <Card
        className="audit-table-card"
        icon={<ClipboardList size={18} />}
        title="Audit Logs History"
        eyebrow="Click any entry to view full before / after data payload"
        right={
          <span className="text-xs text-slate-500 font-medium">
            {filteredLogs.length} total entries
          </span>
        }
      >
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
            <Button variant="primary" onClick={() => fetchLogs(true)} icon={<RefreshCw size={16} />}>
              Retry
            </Button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon="📋"
            title={hasActiveFilters ? "No matching audit entries" : "No audit entries yet"}
            subtitle={
              hasActiveFilters
                ? "Try adjusting your filters or search term."
                : "Audit logs will appear here as actions are performed in the system."
            }
          >
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters} style={{ marginTop: 16 }} icon={<RotateCcw size={16} />}>
                Clear Filters
              </Button>
            )}
          </EmptyState>
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
                        <Badge tone={ACTION_TONES[entry.action] ?? "neutral"}>
                          {entry.action}
                        </Badge>
                      </td>
                      <td className="audit-table__table">{entry.table_name}</td>
                      <td className="audit-table__record-id">
                        {entry.record_id !== null ? `#${entry.record_id}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Compact Pagination Bar ── */}
            <div className="audit-pagination">
              <div className="audit-table__count">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} of{" "}
                {filteredLogs.length}
                {!hasAllLogs && "+"} records
              </div>

              <div className="audit-pagination__controls">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                  aria-label="Previous page"
                  icon={<ChevronLeft size={14} />}
                >
                  Prev
                </Button>

                <div className="audit-pagination__pages">
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
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                  aria-label="Next page"
                  icon={<ChevronRight size={14} />}
                >
                  Next
                </Button>
              </div>
            </div>

            {/* ── Load More Records ── */}
            {hasMore && !hasActiveFilters && (
              <div className="audit-load-more">
                <Button variant="outline" size="sm" onClick={loadMore} disabled={loading} icon={<Folders size={14} />}>
                  {loading ? "Loading…" : "Load More Records from Database"}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ── Modal Dialog for Audit Details ── */}
      <Modal
        open={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        title="Audit Entry Detail"
        subtitle={selectedEntry ? `Log #${selectedEntry.id} • Recorded ${formatTimestamp(selectedEntry.created_at)}` : ""}
        maxWidth="lg"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" size="sm" onClick={() => setSelectedEntry(null)}>
              Close
            </Button>
          </div>
        }
      >
        {selectedEntry && (
          <div className="audit-detail-modal-body">
            {/* Meta Grid */}
            <div className="audit-detail-grid">
              <div className="audit-detail-item">
                <span className="audit-detail-label">User</span>
                <span className="audit-detail-value font-semibold text-slate-800">
                  {selectedEntry.username}
                </span>
              </div>

              <div className="audit-detail-item">
                <span className="audit-detail-label">Action</span>
                <span className="audit-detail-value">
                  <Badge tone={ACTION_TONES[selectedEntry.action] ?? "neutral"}>
                    {selectedEntry.action.toUpperCase()}
                  </Badge>
                </span>
              </div>

              <div className="audit-detail-item">
                <span className="audit-detail-label">Target Table</span>
                <span className="audit-detail-value font-mono text-indigo-600 font-medium">
                  {selectedEntry.table_name}
                </span>
              </div>

              <div className="audit-detail-item">
                <span className="audit-detail-label">Record ID</span>
                <span className="audit-detail-value font-mono text-slate-700">
                  {selectedEntry.record_id !== null ? `#${selectedEntry.record_id}` : "—"}
                </span>
              </div>
            </div>

            {/* Payload Changes */}
            <div className="audit-payload-grid">
              <div className="audit-payload-card">
                <div className="audit-payload-card__header">
                  <span>Previous Data State</span>
                  <Badge tone="neutral">Before</Badge>
                </div>
                <pre className="audit-payload-pre">
                  {renderJson(selectedEntry.old_data)}
                </pre>
              </div>

              <div className="audit-payload-card">
                <div className="audit-payload-card__header">
                  <span>New Data State</span>
                  <Badge tone="success">After</Badge>
                </div>
                <pre className="audit-payload-pre">
                  {renderJson(selectedEntry.new_data)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Modal>

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