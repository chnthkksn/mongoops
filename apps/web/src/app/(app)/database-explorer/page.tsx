"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
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
import { InsertDocumentDialog } from "@/components/database-explorer/insert-document-dialog";
import { CreateCollectionDialog } from "@/components/database-explorer/create-collection-dialog";
import { RenameCollectionDialog } from "@/components/database-explorer/rename-collection-dialog";
import { IndexWizardDialog } from "@/components/database-explorer/index-wizard-dialog";
import { TtlInlineEditor } from "@/components/database-explorer/ttl-inline-editor";
import { QueryBar, type QueryState } from "@/components/database-explorer/query-bar";
import { JsonTreeView } from "@/components/database-explorer/json-tree-view";
import { authClient } from "@/lib/auth-client";
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

export default function DatabaseExplorerPage() {
  const { data: activeRole } = authClient.useActiveMemberRole();
  const canManage = activeRole?.role === "owner" || activeRole?.role === "admin";

  const [clusters, setClusters] = useState<ClusterDto[] | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  const [databases, setDatabases] = useState<DatabaseInfoDto[] | null>(null);
  const [dbsError, setDbsError] = useState<string | null>(null);
  const [collectionsByDb, setCollectionsByDb] = useState<Record<string, CollectionInfoDto[]>>({});
  const [expandedDb, setExpandedDb] = useState<string | null>(null);

  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [selectedColl, setSelectedColl] = useState<string | null>(null);
  const [tab, setTab] = useState<"documents" | "indexes" | "validation">("documents");
  const [viewMode, setViewMode] = useState<"tree" | "table">("tree");

  const [query, setQuery] = useState<QueryState>(DEFAULT_QUERY);
  const [docs, setDocs] = useState<DocumentListDto | null>(null);
  const [indexes, setIndexes] = useState<IndexDto[] | null>(null);
  const [page, setPage] = useState(1);

  const [validator, setValidator] = useState<string>("");
  const [validatorLoaded, setValidatorLoaded] = useState(false);
  const [validatorError, setValidatorError] = useState<string | null>(null);
  const [validatorSaving, setValidatorSaving] = useState(false);

  const [renameTarget, setRenameTarget] = useState<string | null>(null);

  const selectCluster = useCallback((clusterId: string) => {
    setSelectedClusterId(clusterId);
    setDatabases(null);
    setDbsError(null);
    setCollectionsByDb({});
    setExpandedDb(null);
    setSelectedDb(null);
    setSelectedColl(null);
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

  const refreshCollections = useCallback(
    async (dbName: string) => {
      if (!selectedClusterId) return;
      const collections = await api.listCollections(selectedClusterId, dbName);
      setCollectionsByDb((prev) => ({ ...prev, [dbName]: collections }));
    },
    [selectedClusterId],
  );

  async function toggleDb(dbName: string) {
    if (expandedDb === dbName) {
      setExpandedDb(null);
      return;
    }
    setExpandedDb(dbName);
    if (!collectionsByDb[dbName]) {
      await refreshCollections(dbName);
    }
  }

  function selectCollection(dbName: string, collName: string) {
    setSelectedDb(dbName);
    setSelectedColl(collName);
    setTab("documents");
    setPage(1);
    setQuery(DEFAULT_QUERY);
    setValidatorLoaded(false);
  }

  const loadDocuments = useCallback(() => {
    if (!selectedClusterId || !selectedDb || !selectedColl) return;
    api
      .listDocuments(selectedClusterId, selectedDb, selectedColl, {
        page,
        limit: query.limit,
        filter: query.filter || undefined,
        sort: query.sortField ? `${query.sortField}:${query.sortDir}` : undefined,
      })
      .then(setDocs);
  }, [selectedClusterId, selectedDb, selectedColl, page, query]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const loadIndexes = useCallback(() => {
    if (!selectedClusterId || !selectedDb || !selectedColl) return;
    api.listIndexes(selectedClusterId, selectedDb, selectedColl).then(setIndexes);
  }, [selectedClusterId, selectedDb, selectedColl]);

  useEffect(() => {
    if (tab === "indexes") loadIndexes();
  }, [tab, loadIndexes]);

  useEffect(() => {
    if (
      tab === "validation" &&
      !validatorLoaded &&
      selectedClusterId &&
      selectedDb &&
      selectedColl
    ) {
      api.getValidator(selectedClusterId, selectedDb, selectedColl).then((res) => {
        setValidator(res.validator ? JSON.stringify(res.validator, null, 2) : "");
        setValidatorLoaded(true);
      });
    }
  }, [tab, validatorLoaded, selectedClusterId, selectedDb, selectedColl]);

  async function onSaveValidator() {
    if (!selectedClusterId || !selectedDb || !selectedColl) return;
    setValidatorError(null);
    setValidatorSaving(true);
    try {
      const parsed = validator.trim() ? (JSON.parse(validator) as Record<string, unknown>) : {};
      await api.setValidator(selectedClusterId, selectedDb, selectedColl, parsed);
    } catch (err) {
      setValidatorError(err instanceof Error ? err.message : "Could not save validator");
    } finally {
      setValidatorSaving(false);
    }
  }

  async function onDropCollection(dbName: string, collName: string) {
    if (!confirm(`Drop collection ${dbName}.${collName}? This deletes all its documents.`)) return;
    if (!selectedClusterId) return;
    await api.dropCollection(selectedClusterId, dbName, collName);
    if (selectedColl === collName) {
      setSelectedColl(null);
      setSelectedDb(null);
    }
    await refreshCollections(dbName);
  }

  function onApplyQuery(next: QueryState) {
    setQuery(next);
    setPage(1);
  }

  async function onQuickDelete(docId: string) {
    if (!selectedClusterId || !selectedDb || !selectedColl) return;
    if (!confirm(`Delete document ${docId}? This cannot be undone.`)) return;
    await api.deleteDocument(selectedClusterId, selectedDb, selectedColl, docId);
    loadDocuments();
  }

  function refreshActiveTab() {
    if (tab === "documents") loadDocuments();
    else if (tab === "indexes") loadIndexes();
    else if (tab === "validation") setValidatorLoaded(false);
  }

  const selectedStats =
    selectedDb && selectedColl
      ? collectionsByDb[selectedDb]?.find((c) => c.name === selectedColl)
      : null;
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
                  "rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                  cluster._id === selectedClusterId
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-transparent text-muted-foreground hover:bg-neutral-bg",
                )}
              >
                {cluster.name}
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            <div className="w-[240px] shrink-0 rounded-[10px] border border-border bg-card p-2">
              {dbsError && <p className="p-2 text-[12px] text-critical-fg">{dbsError}</p>}
              {databases === null && !dbsError && (
                <p className="p-2 text-[12px] text-muted-foreground">Loading...</p>
              )}
              {databases?.length === 0 && (
                <p className="p-2 text-[12px] text-muted-foreground">No databases found.</p>
              )}
              {databases?.map((database) => (
                <div key={database.name}>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => toggleDb(database.name)}
                      className="flex flex-1 items-center justify-between rounded-[6px] px-2 py-1.5 text-left text-[12.5px] font-bold hover:bg-neutral-bg"
                    >
                      <span className="truncate">{database.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatBytes(database.sizeOnDisk)}
                      </span>
                    </button>
                  </div>
                  {expandedDb === database.name && (
                    <div className="ml-2 flex flex-col">
                      {!collectionsByDb[database.name] && (
                        <p className="px-2 py-1 text-[11px] text-muted-foreground">Loading...</p>
                      )}
                      {collectionsByDb[database.name]?.map((coll) => (
                        <div key={coll.name} className="flex items-center gap-0.5">
                          <button
                            onClick={() => selectCollection(database.name, coll.name)}
                            className={cn(
                              "flex-1 truncate rounded-[6px] px-2 py-1 text-left text-[12px]",
                              selectedDb === database.name && selectedColl === coll.name
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
                      ))}
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
              {!selectedColl && (
                <div className="rounded-[10px] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  Select a collection to browse its documents.
                </div>
              )}

              {selectedColl && selectedDb && selectedClusterId && (
                <div className="rounded-[10px] border border-border bg-card">
                  <div className="border-b border-border p-[18px]">
                    <h2 className="flex items-center gap-1.5 font-mono text-[15px] font-bold">
                      {selectedDb}.{selectedColl}
                      <button
                        onClick={refreshActiveTab}
                        title="Refresh"
                        className="rounded-[4px] p-1 text-muted-foreground hover:bg-neutral-bg hover:text-foreground"
                      >
                        <RefreshCw size={13} />
                      </button>
                    </h2>
                    {selectedStats && (
                      <div className="mt-2 flex gap-5 text-[11px] text-muted-foreground">
                        <span>{selectedStats.count.toLocaleString()} docs</span>
                        <span>avg {formatBytes(selectedStats.avgObjSize)}</span>
                        <span>{formatBytes(selectedStats.storageSize)} total</span>
                        <span>{selectedStats.nindexes} indexes</span>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex gap-4 border-b border-transparent text-[12.5px] font-semibold">
                        <button
                          onClick={() => setTab("documents")}
                          className={cn(
                            "border-b-2 pb-2",
                            tab === "documents"
                              ? "border-primary text-foreground"
                              : "border-transparent text-muted-foreground",
                          )}
                        >
                          Documents
                        </button>
                        <button
                          onClick={() => setTab("indexes")}
                          className={cn(
                            "border-b-2 pb-2",
                            tab === "indexes"
                              ? "border-primary text-foreground"
                              : "border-transparent text-muted-foreground",
                          )}
                        >
                          Indexes
                        </button>
                        <button
                          onClick={() => setTab("validation")}
                          className={cn(
                            "border-b-2 pb-2",
                            tab === "validation"
                              ? "border-primary text-foreground"
                              : "border-transparent text-muted-foreground",
                          )}
                        >
                          Validation
                        </button>
                      </div>
                      {tab === "documents" && (
                        <div className="flex gap-1 pb-2">
                          <button
                            onClick={() => setViewMode("tree")}
                            className={cn(
                              "rounded-md px-2 py-1 text-[11px] font-semibold",
                              viewMode === "tree"
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-neutral-bg",
                            )}
                          >
                            Tree
                          </button>
                          <button
                            onClick={() => setViewMode("table")}
                            className={cn(
                              "rounded-md px-2 py-1 text-[11px] font-semibold",
                              viewMode === "table"
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

                  {tab === "documents" && (
                    <>
                      <QueryBar initial={query} onApply={onApplyQuery} />
                      {canManage && (
                        <div className="flex justify-end p-3 pb-0">
                          <InsertDocumentDialog
                            clusterId={selectedClusterId}
                            db={selectedDb}
                            coll={selectedColl}
                            onInserted={loadDocuments}
                          />
                        </div>
                      )}

                      {viewMode === "tree" && (
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
                                <DocumentEditDialog
                                  clusterId={selectedClusterId}
                                  db={selectedDb}
                                  coll={selectedColl}
                                  document={doc}
                                  onSaved={loadDocuments}
                                  onDeleted={loadDocuments}
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

                      {viewMode === "table" && (
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
                                      <DocumentEditDialog
                                        clusterId={selectedClusterId}
                                        db={selectedDb}
                                        coll={selectedColl}
                                        document={doc}
                                        onSaved={loadDocuments}
                                        onDeleted={loadDocuments}
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
                            Page {page} of {totalPages}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-[12px]"
                              disabled={page <= 1}
                              onClick={() => setPage((p) => p - 1)}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-[12px]"
                              disabled={page >= totalPages}
                              onClick={() => setPage((p) => p + 1)}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {tab === "indexes" && (
                    <>
                      {canManage && (
                        <div className="flex justify-end p-3">
                          <IndexWizardDialog
                            clusterId={selectedClusterId}
                            db={selectedDb}
                            coll={selectedColl}
                            onCreated={loadIndexes}
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
                                      clusterId={selectedClusterId}
                                      db={selectedDb}
                                      coll={selectedColl}
                                      indexName={index.name}
                                      currentValue={index.expireAfterSeconds}
                                      onSaved={loadIndexes}
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
                                        if (!confirm(`Drop index ${index.name}?`)) return;
                                        await api.dropIndex(
                                          selectedClusterId,
                                          selectedDb,
                                          selectedColl,
                                          index.name,
                                        );
                                        loadIndexes();
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

                  {tab === "validation" && (
                    <div className="p-[18px]">
                      <textarea
                        value={validator}
                        onChange={(e) => setValidator(e.target.value)}
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
              onRenamed={() => refreshCollections(db)}
            />
          );
        })()}
    </AppShell>
  );
}
