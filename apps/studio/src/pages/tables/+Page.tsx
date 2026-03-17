import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { useMetadata } from "vike-metadata-solid";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { useDatabase } from "@/contexts/database";
import { useSpacetime } from "@/contexts/spacetime";
import { TableIcon } from "@/icons/sidebar-icons";
import getTitle from "@/utils/get-title";

useMetadata.setGlobalDefaults({
	title: getTitle("Tables"),
	description: "SpacetimeDB Studio - View and browse tables",
});

interface QueryResult {
	rows: Record<string, unknown>[];
	columns: string[];
	numRows: number;
}

export default function TablesPage() {
	const { database, setDatabase, selectedTable, loading } = useDatabase();
	const spacetime = useSpacetime();
	const [queryResult, setQueryResult] = createSignal<QueryResult | null>(null);
	const [queryLoading, setQueryLoading] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);
	const [isRealTime, setIsRealTime] = createSignal(false);
	const [connectingTo, setConnectingTo] = createSignal<string | null>(null);

	const handleDatabaseChange = (db: string) => {
		setDatabase(db);
		const url = new URL(window.location.href);
		url.searchParams.set("db", db);
		window.history.replaceState({}, "", url);
	};

	// Connect when database changes
	createEffect(() => {
		const db = database();
		const currentConnecting = connectingTo();
		const isConnected = spacetime.isConnected();

		// Only connect if we have a database and we're not already connecting/connected to it
		if (db && currentConnecting !== db && !isConnected) {
			setConnectingTo(db);
			setError(null);
			spacetime.connect(db).catch((err) => {
				console.error("Failed to connect to SpacetimeDB:", err);
				setError(err instanceof Error ? err.message : "Connection failed");
				setConnectingTo(null);
			});
		}

		// Reset connecting state once connected
		if (isConnected && currentConnecting) {
			setConnectingTo(null);
		}
	});

	// Subscribe to table when connected and table selected
	createEffect(() => {
		const table = selectedTable();
		const isConnected = spacetime.isConnected();
		const connState = spacetime.getConnectionState();

		if (!table) {
			setQueryResult(null);
			setIsRealTime(false);
			return;
		}

		if (!isConnected) {
			if (connState === "error") {
				const err = spacetime.connectionError();
				setError(err);
				setQueryLoading(false);
			}
			return;
		}

		let cleanup: (() => void) | null = null;

		setQueryLoading(true);
		setError(null);
		setQueryResult(null);

		cleanup = spacetime.subscribeToTable(table, {
			onApplied: (rows) => {
				setQueryLoading(false);
				setIsRealTime(true);
				if (rows.length > 0) {
					const columns = Object.keys(rows[0]);
					setQueryResult({ rows, columns, numRows: rows.length });
				} else {
					setQueryResult({ rows: [], columns: [], numRows: 0 });
				}
			},
			onInsert: (row) => {
				setQueryResult((prev) => {
					if (!prev) {
						const columns = Object.keys(row);
						return { rows: [row], columns, numRows: 1 };
					}
					return {
						...prev,
						rows: [...prev.rows, row],
						numRows: prev.numRows + 1,
					};
				});
			},
			onDelete: (row) => {
				setQueryResult((prev) => {
					if (!prev) return prev;
					const rowKey = JSON.stringify(row);
					return {
						...prev,
						rows: prev.rows.filter((r) => JSON.stringify(r) !== rowKey),
						numRows: Math.max(0, prev.numRows - 1),
					};
				});
			},
			onUpdate: (oldRow, newRow) => {
				setQueryResult((prev) => {
					if (!prev) return prev;
					const oldKey = JSON.stringify(oldRow);
					return {
						...prev,
						rows: prev.rows.map((r) =>
							JSON.stringify(r) === oldKey ? newRow : r,
						),
					};
				});
			},
		});

		onCleanup(() => {
			cleanup?.();
		});
	});

	const formatCellValue = (value: unknown): string => {
		if (value === null || value === undefined) return "NULL";
		if (typeof value === "object") return JSON.stringify(value);
		return String(value);
	};

	return (
		<div class="flex h-full flex-col overflow-hidden bg-background">
			<PageHeader
				title={selectedTable() || "Tables"}
				database={database()}
				loading={loading()}
				onDatabaseChange={handleDatabaseChange}
			/>

			<main class="flex-1 overflow-auto p-4">
				<Show when={!database()}>
					<Card>
						<CardContent class="py-8">
							<div class="text-center">
								<TableIcon class="mx-auto mb-4 size-12 text-muted-foreground/50" />
								<h2 class="mb-2 font-medium text-lg">No database selected</h2>
								<p class="text-muted-foreground text-sm">
									Select a database from the header above to view tables
								</p>
							</div>
						</CardContent>
					</Card>
				</Show>

				<Show when={database() && !selectedTable()}>
					<Card>
						<CardContent class="py-8">
							<div class="text-center">
								<TableIcon class="mx-auto mb-4 size-12 text-muted-foreground/50" />
								<h2 class="mb-2 font-medium text-lg">Select a table</h2>
								<p class="text-muted-foreground text-sm">
									Choose a table from the sidebar to view its contents
								</p>
							</div>
						</CardContent>
					</Card>
				</Show>

				<Show when={database() && selectedTable()}>
					<Show when={isRealTime()}>
						<div class="mb-4 flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-green-600 text-xs dark:bg-green-500/20 dark:text-green-400">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
							>
								<path d="M5 15h1.394c.786 0 1.18 0 1.511.177c.332.178.55.505.986 1.159l.16.24c.422.633.633.95.92.933c.286-.017.459-.356.803-1.036l1.966-3.877c.359-.706.538-1.06.831-1.071c.293-.012.5.326.914 1.001l.637 1.04c.43.701.644 1.051.985 1.243c.342.19.752.19 1.573.19H19" />
								<path d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12Z" />
							</svg>
							<span>Real-time sync enabled</span>
						</div>
					</Show>

					<Show when={error()}>
						<Card class="mb-4">
							<CardContent class="py-4">
								<div class="flex items-center gap-2 text-destructive">
									<span class="font-medium">Error:</span>
									<span class="font-mono text-sm">{error()}</span>
								</div>
							</CardContent>
						</Card>
					</Show>

					<Show when={queryLoading()}>
						<Card>
							<CardContent class="py-8">
								<div class="text-center text-muted-foreground">
									Loading table data...
								</div>
							</CardContent>
						</Card>
					</Show>

					<Show when={queryResult() && !queryLoading()}>
						<Card>
							<CardContent class="p-0">
								<div class="overflow-x-auto">
									<table class="w-full border-collapse text-sm">
										<thead>
											<tr class="border-border border-b bg-muted/50">
												<For each={queryResult()?.columns ?? []}>
													{(column) => (
														<th class="border-border px-4 py-2 text-left font-medium">
															{column}
														</th>
													)}
												</For>
											</tr>
										</thead>
										<tbody>
											<For each={queryResult()?.rows ?? []}>
												{(row) => (
													<tr class="border-border/50 border-b hover:bg-muted/30">
														<For each={queryResult()?.columns ?? []}>
															{(column) => (
																<td class="max-w-xs truncate px-4 py-2 font-mono text-xs">
																	{formatCellValue(row[column])}
																</td>
															)}
														</For>
													</tr>
												)}
											</For>
										</tbody>
									</table>
								</div>
								<Show when={(queryResult()?.rows?.length ?? 0) === 0}>
									<div class="py-8 text-center text-muted-foreground">
										No rows in this table
									</div>
								</Show>
								<Show when={(queryResult()?.rows?.length ?? 0) > 0}>
									<div class="border-border border-t px-4 py-2 text-muted-foreground text-xs">
										{queryResult()?.rows?.length ?? 0} rows
										<Show when={isRealTime()}>
											<span class="ml-2 inline-flex items-center gap-1 text-green-600 dark:text-green-400">
  											<span class="relative flex size-1.5">
  												<span class="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
  												<span class="relative inline-flex size-1.5 rounded-full bg-green-500" />
  											</span>
												live
											</span>
										</Show>
									</div>
								</Show>
							</CardContent>
						</Card>
					</Show>
				</Show>
			</main>
		</div>
	);
}
