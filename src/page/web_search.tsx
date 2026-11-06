import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { Alert, Button, Card, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import BasicLayout from "../components/layout";

interface SearchItem { title: string; url: string; description: string }

export default function WebSearchPage() {
  const [query, setQuery] = useState("");
  const [key, setKey] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const search = async () => {
    setBusy(true); setError("");
    try { setItems(await invoke<SearchItem[]>("search_web", { query, apiKey: key })); }
    catch (value) { setError(String(value)); setItems([]); }
    finally { setBusy(false); }
  };
  return <BasicLayout><Stack spacing={2} sx={{ maxWidth: 950, mx: "auto", p: { xs: 2, md: 3 } }}>
    <Typography variant="h4">网页搜索</Typography>
    <Typography color="text.secondary">使用 Brave Search API。Key 仅用于本次请求，不保存在本地。</Typography>
    <TextField label="Brave Search API Key" type="password" value={key} onChange={(event) => setKey(event.target.value)} />
    <TextField label="搜索词" value={query} onChange={(event) => setQuery(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Enter") void search(); }} />
    <Button variant="contained" onClick={() => void search()} disabled={busy || !query.trim() || !key.trim()}>{busy ? "搜索中…" : "搜索"}</Button>
    {error && <Alert severity="warning">{error}</Alert>}
    {items.map((item) => <Card key={item.url} sx={{ p: 2 }}>
      <Button onClick={() => void open(item.url)} sx={{ textAlign: "left", justifyContent: "flex-start" }}>{item.title}</Button>
      <Typography variant="body2" color="text.secondary">{item.description}</Typography>
      <Typography variant="caption" color="text.secondary">{item.url}</Typography>
    </Card>)}
  </Stack></BasicLayout>;
}
