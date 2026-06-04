import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "../../../components/ui/Card";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import type { BadgeTone } from "../../../components/ui/Badge";
import Toast from "../../../components/ui/Toast";
import { auditService } from "../services/auditService";
import type { AuditLogEntry, ToastMessage } from "../../../types";

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
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

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

    if (tableFilter) {
      result = result.filter((l) => l.table_name === tableFilter);
    }

    return result;
  }, [logs, search, actionFilter, tableFilter]);

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
  };

  const hasActiveFilters = search !== "" || actionFilter !== "" || tableFilter !== "";

  return (
    <div className="audit-page">
      {/* ── Filter Bar ── */}
      <Card className="audit-filters-card">
        <div className="audit-filters">
          <div className="audit-filters__search">
            <Input
              placeholder="Search by user, action, table, or record ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="audit-filters__selects">
            <select
              className="audit-filter-select"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
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
              onChange={(e) => setTableFilter(e.target.value)}
            >
              <option value="">All Tables</option>
              {uniqueTables.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}

          <Button variant="ghost" onClick={() => fetchLogs(true)} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
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
                  {filteredLogs.map((entry) => (
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

            {hasMore && filteredLogs.length === logs.length && (
              <div className="audit-load-more">
                <Button variant="ghost" onClick={loadMore} disabled={loading}>
                  {loading ? "Loading…" : "Load More"}
                </Button>
              </div>
            )}

            <div className="audit-table__count">
              Showing {filteredLogs.length} of{" "}
              {hasActiveFilters ? "filtered" : "loaded"} entries
            </div>
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