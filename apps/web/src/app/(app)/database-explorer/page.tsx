"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentEditDialog } from "@/components/database-explorer/document-edit-dialog";
import { CopyDocumentButton } from "@/components/database-explorer/copy-document-button";
import { InsertDocumentDialog } from "@/components/database-explorer/insert-document-dialog";
import { CreateCollectionDialog } from "@/components/database-explorer/create-collection-dialog";
import { CreateDatabaseDialog } from "@/components/database-explorer/create-database-dialog";
import { RenameCollectionDialog } from "@/components/database-explorer/rename-collection-dialog";
import { IndexWizardDialog } from "@/components/database-explorer/index-wizard-dialog";
import { TtlInlineEditor } from "@/components/database-explorer/ttl-inline-editor";
import { QueryBar, type QueryState } from "@/components/database-explorer/query-bar";
import { JsonTreeView } from "@/components/database-explorer/json-tree-view";
import { authClient } from "@/lib/auth-client";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  api,
  type ClusterDto,
  type DatabaseInfoDto,
  type CollectionInfoDto,
  type DocumentListDto,
  type DocumentDto,
  type IndexDto,
} from "@/lib/api-client";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DEFAULT_QUERY: QueryState = { filter: "", sortField: "", sortDir: 1, limit: 25 };

interface OpenTab {
  key: string;
  clusterId: string;
  clusterName: string;
  clusterColor: string;
  db: string;
  coll: string;
  subTab: "documents" | "indexes" | "validation";
  viewMode: "tree" | "table";
  query: QueryState;
  page: number;
  // Cached per tab so switching tabs shows already-loaded data instantly
  // instead of refetching — only explicit actions (query/page change,
  // manual refresh, a mutation) trigger a reload for a given tab.
  docs: DocumentListDto | null;
  indexes: IndexDto[] | null;
  validator: string;
  validatorLoaded: boolean;
}

function tabKey(clusterId: string, db: string, coll: string) {
  return `${clusterId}::${db}::${coll}`;
}

export default function DatabaseExplorerPage() {
  const { data: activeRole } = authClient.useActiveMemberRole();
  const canManage = activeRole?.role === "owner" || activeRole?.role === "admin";
  const confirm = useConfirm();

  const [clusters, setClusters] = useState<ClusterDto[] | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  const [databases, setDatabases] = useState<DatabaseInfoDto[] | null>(null);
  const [dbsError, setDbsError] = useState<string | null>(null);
  const [collectionsByCluster, setCollectionsByCluster] = useState<
    Record<string, Record<string, CollectionInfoDto[]>>
  >({});
  const [expandedDb, setExpandedDb] = useState<string | null>(null);

  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabKey, setActiveTabKey] = useState<string | null>(null);
  const activeTab = openTabs.find((t) => t.key === activeTabKey) ?? null;

  const [validatorError, setValidatorError] = useState<string | null>(null);
  const [validatorSaving, setValidatorSaving] = useState(false);

  const [renameTarget, setRenameTarget] = useState<string | null>(null);

  const selectCluster = useCallback((clusterId: string) => {
    setSelectedClusterId(clusterId);
    setDatabases(null);
    setDbsError(null);
    setExpandedDb(null);
    api
      .listDatabases(clusterId)
      .then(setDatabases)
      .catch((err) => setDbsError(err instanceof Error ? err.message : "Could not load databases"));
  }, []);

  useEffect(() => {
    api.listClusters().then((list) => {
      setClusters(list);
      const firstId = list[0]?._id;
      if (firstId) selectCluster(firstId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshDatabases = useCallback(() => {
    if (!selectedClusterId) return;
    api
      .listDatabases(selectedClusterId)
      .then(setDatabases)
      .catch((err) => setDbsError(err instanceof Error ? err.message : "Could not load databases"));
  }, [selectedClusterId]);

  const refreshCollections = useCallback(
    async (dbName: string) => {
      if (!selectedClusterId) return;
      const collections = await api.listCollections(selectedClusterId, dbName);
      setCollectionsByCluster((prev) => ({
        ...prev,
        [selectedClusterId]: { ...(prev[selectedClusterId] ?? {}), [dbName]: collections },
      }));
    },
    [selectedClusterId],
  );

  async function toggleDb(dbName: string) {
    if (expandedDb === dbName) {
      setExpandedDb(null);
      return;
    }
    setExpandedDb(dbName);
    if (!collectionsByCluster[selectedClusterId ?? ""]?.[dbName]) {
      await refreshCollections(dbName);
    }
  }

  function patchTab(key: string, patch: Partial<OpenTab>) {
    setOpenTabs((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }

  function updateActiveTab(patch: Partial<OpenTab>) {
    if (!activeTab) return;
    patchTab(activeTab.key, patch);
  }

  const loadDocumentsFor = useCallback((tab: OpenTab) => {
    api
      .listDocuments(tab.clusterId, tab.db, tab.coll, {
        page: tab.page,
        limit: tab.query.limit,
        filter: tab.query.filter || undefined,
        sort: tab.query.sortField ? `${tab.query.sortField}:${tab.query.sortDir}` : undefined,
      })
      .then((docs) => patchTab(tab.key, { docs }));
  }, []);

  const loadIndexesFor = useCallback((tab: OpenTab) => {
    api
      .listIndexes(tab.clusterId, tab.db, tab.coll)
      .then((indexes) => patchTab(tab.key, { indexes }));
  }, []);

  const loadValidatorFor = useCallback((tab: OpenTab) => {
    api.getValidator(tab.clusterId, tab.db, tab.coll).then((res) => {
      patchTab(tab.key, {
        validator: res.validator ? JSON.stringify(res.validator, null, 2) : "",
        validatorLoaded: true,
      });
    });
  }, []);

  function openCollectionTab(dbName: string, collName: string) {
    if (!selectedClusterId) return;
    const key = tabKey(selectedClusterId, dbName, collName);
    const existing = openTabs.find((t) => t.key === key);
    if (existing) {
      setActiveTabKey(key);
      return;
    }
    const cluster = clusters?.find((c) => c._id === selectedClusterId);
    const newTab: OpenTab = {
      key,
      clusterId: selectedClusterId,
      clusterName: cluster?.name ?? "Cluster",
      clusterColor: cluster?.color ?? "#93c5fd",
      db: dbName,
      coll: collName,
      subTab: "documents",
      viewMode: "tree",
      query: DEFAULT_QUERY,
      page: 1,
      docs: null,
      indexes: null,
      validator: "",
      validatorLoaded: false,
    };
    setOpenTabs((prev) => [...prev, newTab]);
    setActiveTabKey(key);
    loadDocumentsFor(newTab);
  }

  function closeTab(key: string) {
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.key === key);
      if (idx === -1) return prev;
      const next = prev.filter((t) => t.key !== key);
      if (activeTabKey === key) {
        const neighbor = next[idx] ?? next[idx - 1] ?? null;
        setActiveTabKey(neighbor?.key ?? null);
      }
      return next;
    });
  }

  // Lazily load indexes/validator the first time a tab's sub-tab is
  // opened — not on every switch back to an already-loaded tab.
  useEffect(() => {
    if (activeTab && activeTab.subTab === "indexes" && activeTab.indexes === null) {
      loadIndexesFor(activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.key, activeTab?.subTab, activeTab?.indexes]);

  useEffect(() => {
    if (activeTab && activeTab.subTab === "validation" && !activeTab.validatorLoaded) {
      loadValidatorFor(activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.key, activeTab?.subTab, activeTab?.validatorLoaded]);

  async function onSaveValidator() {
    if (!activeTab) return;
    setValidatorError(null);
    setValidatorSaving(true);
    try {
      const parsed = activeTab.validator.trim()
        ? (JSON.parse(activeTab.validator) as Record<string, unknown>)
        : {};
      await api.setValidator(activeTab.clusterId, activeTab.db, activeTab.coll, parsed);
    } catch (err) {
      setValidatorError(err instanceof Error ? err.message : "Could not save validator");
    } finally {
      setValidatorSaving(false);
    }
  }

  async function onDropCollection(dbName: string, collName: string) {
    const ok = await confirm({
      title: "Drop collection",
      description: `Drop collection ${dbName}.${collName}? This deletes all its documents.`,
    });
    if (!ok) return;
    if (!selectedClusterId) return;
    await api.dropCollection(selectedClusterId, dbName, collName);
    closeTab(tabKey(selectedClusterId, dbName, collName));
    await refreshCollections(dbName);
  }

  async function onDropDatabase(dbName: string) {
    const ok = await confirm({
      title: "Drop database",
      description: `Drop database "${dbName}"? This permanently deletes every collection and document in it.`,
    });
    if (!ok) return;
    if (!selectedClusterId) return;
    await api.dropDatabase(selectedClusterId, dbName);
    setOpenTabs((prev) => prev.filter((t) => t.db !== dbName));
    if (activeTab?.db === dbName) setActiveTabKey(null);
    if (expandedDb === dbName) setExpandedDb(null);
    refreshDatabases();
  }

  function onApplyQuery(next: QueryState) {
    if (!activeTab) return;
    const updated = { ...activeTab, query: next, page: 1 };
    patchTab(activeTab.key, updated);
    loadDocumentsFor(updated);
  }

  function changePage(delta: number) {
    if (!activeTab) return;
    const updated = { ...activeTab, page: activeTab.page + delta };
    patchTab(activeTab.key, updated);
    loadDocumentsFor(updated);
  }

  async function onQuickDelete(docId: string) {
    if (!activeTab) return;
    const ok = await confirm({
      title: "Delete document",
      description: `Delete document ${docId}? This cannot be undone.`,
    });
    if (!ok) return;
    await api.deleteDocument(activeTab.clusterId, activeTab.db, activeTab.coll, docId);
    loadDocumentsFor(activeTab);
  }

  function reloadDocuments() {
    if (activeTab) loadDocumentsFor(activeTab);
  }

  function reloadIndexes() {
    if (activeTab) loadIndexesFor(activeTab);
  }

  function refreshActiveTab() {
    if (!activeTab) return;
    if (activeTab.subTab === "documents") loadDocumentsFor(activeTab);
    else if (activeTab.subTab === "indexes") loadIndexesFor(activeTab);
    else if (activeTab.subTab === "validation") loadValidatorFor(activeTab);
  }

  const activeStats = activeTab
    ? collectionsByCluster[activeTab.clusterId]?.[activeTab.db]?.find(
        (c) => c.name === activeTab.coll,
      )
    : null;
  const docs = activeTab?.docs ?? null;
  const indexes = activeTab?.indexes ?? null;
  const totalPages = docs ? Math.max(1, Math.ceil(docs.total / docs.limit)) : 1;

  const tableColumns =
    docs && docs.documents.length > 0
      ? Array.from(
          new Set(
            docs.documents.flatMap((d) =>
              d.parsed && typeof d.parsed === "object" ? Object.keys(d.parsed) : [],
            ),
          ),
        )
      : [];

  function cellValue(doc: DocumentDto, key: string) {
    if (!doc.parsed || typeof doc.parsed !== "object") return "";
    const val = (doc.parsed as Record<string, unknown>)[key];
    if (val === undefined) return "";
    const str = typeof val === "string" ? val : JSON.stringify(val);
    return str.length > 40 ? `${str.slice(0, 40)}...` : str;
  }

  return (
    <AppShell title="Database Explorer">
      {clusters === null && <p className="text-sm text-muted-foreground">Loading clusters...</p>}
      {clusters?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No clusters connected yet — head to Clusters to connect your first one.
        </p>
      )}

      {clusters && clusters.length > 0 && (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {clusters.map((cluster) => (
              <button
                key={cluster._id}
                onClick={() => selectCluster(cluster._id)}
                className={cn(
                  "rounded-full border-2 px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                  cluster._id === selectedClusterId
                    ? "border-transparent text-neutral-900"
                    : "border-border bg-transparent text-muted-foreground hover:bg-neutral-bg",
                )}
                style={cluster._id === selectedClusterId ? { backgroundColor: cluster.color } : undefined}
              >
                {cluster.name}
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            <div className="w-[240px] shrink-0 rounded-[10px] border border-border bg-card p-2">
              {canManage && selectedClusterId && (
                <div className="mb-2 px-1">
                  <CreateDatabaseDialog clusterId={selectedClusterId} onCreated={refreshDatabases} />
                </div>
              )}
              {dbsError && <p className="p-2 text-[12px] text-critical-fg">{dbsError}</p>}
              {databases === null && !dbsError && (
                <p className="p-2 text-[12px] text-muted-foreground">Loading...</p>
              )}
              {databases?.length === 0 && (
                <p className="p-2 text-[12px] text-muted-foreground">No databases found.</p>
              )}
              {databases?.map((database) => (
                <div key={database.name}>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => toggleDb(database.name)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-1.5 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] font-bold hover:bg-neutral-bg"
                    >
                      <span className="min-w-0 flex-1 truncate">{database.name}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatBytes(database.sizeOnDisk)}
                      </span>
                    </button>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button className="rounded-[4px] px-1.5 py-1 text-muted-foreground hover:bg-neutral-bg" />
                          }
                        >
                          ⋯
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => onDropDatabase(database.name)}>
                            Drop database
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {expandedDb === database.name && (
                    <div className="ml-2 flex flex-col">
                      {!collectionsByCluster[selectedClusterId ?? ""]?.[database.name] && (
                        <p className="px-2 py-1 text-[11px] text-muted-foreground">Loading...</p>
                      )}
                      {collectionsByCluster[selectedClusterId ?? ""]?.[database.name]?.map(
                        (coll) => (
                          <div key={coll.name} className="flex items-center gap-0.5">
                            <button
                              onClick={() => openCollectionTab(database.name, coll.name)}
                              className={cn(
                                "flex-1 truncate rounded-[6px] px-2 py-1 text-left text-[12px]",
                                activeTab?.db === database.name && activeTab?.coll === coll.name
                                  ? "bg-accent text-accent-foreground"
                                  : "text-muted-foreground hover:bg-neutral-bg",
                              )}
                            >
                              {coll.name}
                              {coll.capped && (
                                <span className="ml-1 text-[9px] text-muted-foreground">capped</span>
                              )}
                            </button>
                            {canManage && (
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <button className="rounded-[4px] px-1.5 py-1 text-muted-foreground hover:bg-neutral-bg" />
                                  }
                                >
                                  ⋯
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem
                                    onClick={() => setRenameTarget(`${database.name}::${coll.name}`)}
                                  >
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => onDropCollection(database.name, coll.name)}
                                  >
                                    Drop
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        ),
                      )}
                      {canManage && selectedClusterId && (
                        <div className="mt-1 px-1">
                          <CreateCollectionDialog
                            clusterId={selectedClusterId}
                            db={database.name}
                            onCreated={() => refreshCollections(database.name)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="min-w-0 flex-1">
              {openTabs.length > 0 && (
                <div className="flex gap-1 overflow-x-auto border-b border-border">
                  {openTabs.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setActiveTabKey(t.key)}
                      className={cn(
                        "group -mb-px flex shrink-0 items-center gap-2 rounded-t-[8px] border-x border-t px-3 py-2 text-[12px] font-semibold",
                        t.key === activeTabKey
                          ? "border-border bg-card text-foreground"
                          : "border-transparent bg-transparent text-muted-foreground hover:bg-neutral-bg",
                      )}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: t.clusterColor }}
                      />
                      <span className="whitespace-nowrap font-mono">
                        {t.db}.{t.coll}
                      </span>
                      <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(t.key);
                        }}
                        className="rounded-[3px] p-0.5 text-muted-foreground opacity-0 hover:bg-neutral-bg hover:text-foreground group-hover:opacity-100"
                      >
                        <X size={12} />
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {!activeTab && (
                <div
                  className={cn(
                    "border border-border bg-card p-6 text-center text-sm text-muted-foreground",
                    openTabs.length > 0 ? "rounded-b-[10px]" : "rounded-[10px]",
                  )}
                >
                  {openTabs.length === 0
                    ? "Select a collection from the sidebar to open it as a tab."
                    : "Select a tab to browse its documents."}
                </div>
              )}

              {activeTab && (
                <div className="rounded-b-[10px] border-x border-b border-border bg-card">
                  <div className="border-b border-border p-[18px]">
                    <h2 className="flex items-center gap-1.5 font-mono text-[15px] font-bold">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: activeTab.clusterColor }}
                      />
                      {activeTab.db}.{activeTab.coll}
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {activeTab.clusterName}
                      </span>
                      <button
                        onClick={refreshActiveTab}
                        title="Refresh"
                        className="rounded-[4px] p-1 text-muted-foreground hover:bg-neutral-bg hover:text-foreground"
                      >
                        <RefreshCw size={13} />
                      </button>
                    </h2>
                    {activeStats && (
                      <div className="mt-2 flex gap-5 text-[11px] text-muted-foreground">
                        <span>{activeStats.count.toLocaleString()} docs</span>
                        <span>avg {formatBytes(activeStats.avgObjSize)}</span>
                        <span>{formatBytes(activeStats.storageSize)} total</span>
                        <span>{activeStats.nindexes} indexes</span>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex gap-4 border-b border-transparent text-[12.5px] font-semibold">
                        <button
                          onClick={() => updateActiveTab({ subTab: "documents" })}
                          className={cn(
                            "border-b-2 pb-2",
                            activeTab.subTab === "documents"
                              ? "border-primary text-foreground"
                              : "border-transparent text-muted-foreground",
                          )}
                        >
                          Documents
                        </button>
                        <button
                          onClick={() => updateActiveTab({ subTab: "indexes" })}
                          className={cn(
                            "border-b-2 pb-2",
                            activeTab.subTab === "indexes"
                              ? "border-primary text-foreground"
                              : "border-transparent text-muted-foreground",
                          )}
                        >
                          Indexes
                        </button>
                        <button
                          onClick={() => updateActiveTab({ subTab: "validation" })}
                          className={cn(
                            "border-b-2 pb-2",
                            activeTab.subTab === "validation"
                              ? "border-primary text-foreground"
                              : "border-transparent text-muted-foreground",
                          )}
                        >
                          Validation
                        </button>
                      </div>
                      {activeTab.subTab === "documents" && (
                        <div className="flex gap-1 pb-2">
                          <button
                            onClick={() => updateActiveTab({ viewMode: "tree" })}
                            className={cn(
                              "rounded-md px-2 py-1 text-[11px] font-semibold",
                              activeTab.viewMode === "tree"
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-neutral-bg",
                            )}
                          >
                            Tree
                          </button>
                          <button
                            onClick={() => updateActiveTab({ viewMode: "table" })}
                            className={cn(
                              "rounded-md px-2 py-1 text-[11px] font-semibold",
                              activeTab.viewMode === "table"
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-neutral-bg",
                            )}
                          >
                            Table
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {activeTab.subTab === "documents" && (
                    <>
                      <QueryBar initial={activeTab.query} onApply={onApplyQuery} />
                      {canManage && (
                        <div className="flex justify-end p-3 pb-0">
                          <InsertDocumentDialog
                            clusterId={activeTab.clusterId}
                            db={activeTab.db}
                            coll={activeTab.coll}
                            onInserted={reloadDocuments}
                          />
                        </div>
                      )}

                      {activeTab.viewMode === "tree" && (
                        <div className="flex flex-col divide-y divide-border">
                          {docs === null && (
                            <p className="p-4 text-center text-sm text-muted-foreground">Loading...</p>
                          )}
                          {docs?.documents.length === 0 && (
                            <p className="p-4 text-center text-sm text-muted-foreground">
                              No documents match this query.
                            </p>
                          )}
                          {docs?.documents.map((doc) => (
                            <div key={doc.id} className="flex items-start justify-between gap-3 p-3">
                              <div className="min-w-0 flex-1 overflow-x-auto">
                                <JsonTreeView value={doc.parsed} />
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <CopyDocumentButton raw={doc.raw} />
                                <DocumentEditDialog
                                  clusterId={activeTab.clusterId}
                                  db={activeTab.db}
                                  coll={activeTab.coll}
                                  document={doc}
                                  onSaved={reloadDocuments}
                                  onDeleted={reloadDocuments}
                                />
                                {canManage && (
                                  <button
                                    onClick={() => onQuickDelete(doc.id)}
                                    title="Delete document"
                                    className="rounded-[4px] p-1.5 text-muted-foreground hover:bg-critical-bg hover:text-critical-fg"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {activeTab.viewMode === "table" && (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>_id</TableHead>
                                {tableColumns
                                  .filter((c) => c !== "_id")
                                  .map((col) => (
                                    <TableHead key={col}>{col}</TableHead>
                                  ))}
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {docs === null && (
                                <TableRow>
                                  <TableCell
                                    colSpan={tableColumns.length + 2}
                                    className="text-center text-muted-foreground"
                                  >
                                    Loading...
                                  </TableCell>
                                </TableRow>
                              )}
                              {docs?.documents.map((doc) => (
                                <TableRow key={doc.id}>
                                  <TableCell className="font-mono text-xs">{doc.id}</TableCell>
                                  {tableColumns
                                    .filter((c) => c !== "_id")
                                    .map((col) => (
                                      <TableCell
                                        key={col}
                                        className="max-w-[200px] truncate font-mono text-xs text-muted-foreground"
                                      >
                                        {cellValue(doc, col)}
                                      </TableCell>
                                    ))}
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <CopyDocumentButton raw={doc.raw} />
                                      <DocumentEditDialog
                                        clusterId={activeTab.clusterId}
                                        db={activeTab.db}
                                        coll={activeTab.coll}
                                        document={doc}
                                        onSaved={reloadDocuments}
                                        onDeleted={reloadDocuments}
                                      />
                                      {canManage && (
                                        <button
                                          onClick={() => onQuickDelete(doc.id)}
                                          title="Delete document"
                                          className="rounded-[4px] p-1.5 text-muted-foreground hover:bg-critical-bg hover:text-critical-fg"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {docs && docs.total > docs.limit && (
                        <div className="flex items-center justify-between p-3">
                          <span className="text-[11px] text-muted-foreground">
                            Page {activeTab.page} of {totalPages}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-[12px]"
                              disabled={activeTab.page <= 1}
                              onClick={() => changePage(-1)}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-[12px]"
                              disabled={activeTab.page >= totalPages}
                              onClick={() => changePage(1)}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {activeTab.subTab === "indexes" && (
                    <>
                      {canManage && (
                        <div className="flex justify-end p-3">
                          <IndexWizardDialog
                            clusterId={activeTab.clusterId}
                            db={activeTab.db}
                            coll={activeTab.coll}
                            onCreated={reloadIndexes}
                          />
                        </div>
                      )}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Keys</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>TTL (s)</TableHead>
                            {canManage && <TableHead className="text-right">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {indexes === null && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground">
                                Loading...
                              </TableCell>
                            </TableRow>
                          )}
                          {indexes?.map((index) => (
                            <TableRow key={index.name}>
                              <TableCell className="font-mono text-xs">
                                {index.name}
                                {index.unique && <span className="ml-1 text-[10px]">unique</span>}
                                {index.sparse && <span className="ml-1 text-[10px]">sparse</span>}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {JSON.stringify(index.key)}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {index.size !== null ? formatBytes(index.size) : "—"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {index.expireAfterSeconds !== null ? (
                                  canManage ? (
                                    <TtlInlineEditor
                                      clusterId={activeTab.clusterId}
                                      db={activeTab.db}
                                      coll={activeTab.coll}
                                      indexName={index.name}
                                      currentValue={index.expireAfterSeconds}
                                      onSaved={reloadIndexes}
                                    />
                                  ) : (
                                    index.expireAfterSeconds
                                  )
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              {canManage && (
                                <TableCell className="text-right">
                                  {index.name !== '_id_' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2.5 text-[12px]"
                                      onClick={async () => {
                                        const ok = await confirm({
                                          title: "Drop index",
                                          description: `Drop index ${index.name}?`,
                                        });
                                        if (!ok) return;
                                        await api.dropIndex(
                                          activeTab.clusterId,
                                          activeTab.db,
                                          activeTab.coll,
                                          index.name,
                                        );
                                        reloadIndexes();
                                      }}
                                    >
                                      Drop
                                    </Button>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}

                  {activeTab.subTab === "validation" && (
                    <div className="p-[18px]">
                      <textarea
                        value={activeTab.validator}
                        onChange={(e) => updateActiveTab({ validator: e.target.value })}
                        readOnly={!canManage}
                        placeholder={canManage ? '{ "$jsonSchema": { ... } }' : "No validation rules set."}
                        spellCheck={false}
                        className="h-64 w-full resize-none rounded-md border border-input bg-transparent p-3 font-mono text-xs"
                      />
                      {validatorError && (
                        <p className="mt-2 text-sm text-critical-fg">{validatorError}</p>
                      )}
                      {canManage && (
                        <Button
                          size="sm"
                          className="mt-3 h-8 px-3 text-[12px]"
                          disabled={validatorSaving}
                          onClick={onSaveValidator}
                        >
                          {validatorSaving ? "Saving..." : "Save validation rules"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {renameTarget &&
        selectedClusterId &&
        (() => {
          const [db, coll] = renameTarget.split("::");
          return (
            <RenameCollectionDialog
              clusterId={selectedClusterId}
              db={db}
              coll={coll}
              open={true}
              onOpenChange={(open) => {
                if (!open) setRenameTarget(null);
              }}
              onRenamed={() => {
                refreshCollections(db);
                closeTab(tabKey(selectedClusterId, db, coll));
              }}
            />
          );
        })()}
    </AppShell>
  );
}
