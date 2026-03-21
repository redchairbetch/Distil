import { useState, useEffect } from "react";
import { loadCampaignContent, saveCampaignContent, deleteCampaignContent } from "../db.js";

const CONTENT_TYPES = ["video", "article", "push", "email", "sms"];
const CATEGORIES = ["welcome", "education", "maintenance", "lima_charlie", "upgrade", "humor", "lifestyle", "seasonal", "research", "news", "emotional", "tech", "video", "general"];
const TYPE_ICONS = { video: "🎬", article: "📄", push: "🔔", email: "📧", sms: "💬" };
const CAT_COLORS = {
  welcome:      { bg: "#dcfce7", color: "#16a34a" },
  education:    { bg: "#dbeafe", color: "#1d4ed8" },
  maintenance:  { bg: "#fef3c7", color: "#92400e" },
  lima_charlie: { bg: "#e0e7ff", color: "#4338ca" },
  upgrade:      { bg: "#fce7f3", color: "#be185d" },
  humor:        { bg: "#fef9c3", color: "#a16207" },
  lifestyle:    { bg: "#d1fae5", color: "#047857" },
  seasonal:     { bg: "#ffedd5", color: "#c2410c" },
  research:     { bg: "#ede9fe", color: "#6d28d9" },
  news:         { bg: "#cffafe", color: "#0e7490" },
  emotional:    { bg: "#fce4ec", color: "#c62828" },
  tech:         { bg: "#e3f2fd", color: "#1565c0" },
  video:        { bg: "#f3e8ff", color: "#7c3aed" },
  general:      { bg: "#f3f4f6", color: "#6b7280" },
};

const EMPTY_DRAFT = {
  content_type: "push",
  title: "",
  body: "",
  url: "",
  thumbnail_url: "",
  category: "general",
  tags: [],
};

export default function ContentLibrary({ clinicId, staffId }) {
  const [content, setContent] = useState([]);
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null); // null = list view, object = editing
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (clinicId) loadCampaignContent(clinicId).then(setContent);
  }, [clinicId]);

  const filtered = filter === "all" ? content : content.filter(c => c.content_type === filter);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveCampaignContent({ ...editing, clinic_id: clinicId, created_by: staffId });
      if (editing.id) {
        setContent(prev => prev.map(c => c.id === saved.id ? saved : c));
      } else {
        setContent(prev => [saved, ...prev]);
      }
      setEditing(null);
    } catch (e) {
      console.error("Save content error:", e);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await deleteCampaignContent(id);
    setContent(prev => prev.filter(c => c.id !== id));
  };

  // ── Editor view ──
  if (editing) {
    return (
      <>
        <div className="topbar">
          <div>
            <div className="topbar-title">{editing.id ? "Edit Content" : "New Content"}</div>
            <div className="topbar-sub">Campaign content item</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-primary green" onClick={handleSave} disabled={saving || !editing.title}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
        <div className="content">
          <div style={{ maxWidth: 700 }}>
            <div className="card">
              <div className="card-title">Content Details</div>
              <div className="field-grid">
                <div className="field">
                  <label>Content Type</label>
                  <select value={editing.content_type} onChange={e => setEditing({ ...editing, content_type: e.target.value })}>
                    {CONTENT_TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Category</label>
                  <select value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="field full">
                  <label>Title</label>
                  <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Content title..." />
                </div>
                <div className="field full">
                  <label>Body / Copy</label>
                  <textarea rows={4} value={editing.body || ""} onChange={e => setEditing({ ...editing, body: e.target.value })}
                    placeholder={editing.content_type === "push" ? "Push notification copy..." : "Email body or article summary..."} />
                </div>
                {(editing.content_type === "video" || editing.content_type === "article") && (
                  <>
                    <div className="field full">
                      <label>URL</label>
                      <input value={editing.url || ""} onChange={e => setEditing({ ...editing, url: e.target.value })} placeholder="https://..." />
                    </div>
                    <div className="field full">
                      <label>Thumbnail URL</label>
                      <input value={editing.thumbnail_url || ""} onChange={e => setEditing({ ...editing, thumbnail_url: e.target.value })} placeholder="https://..." />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Preview */}
            <div className="card">
              <div className="card-title">Preview</div>
              <div style={{ background: "#f9fafb", borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{TYPE_ICONS[editing.content_type]}</span>
                  <span style={{ ...CAT_COLORS[editing.category], padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600, background: CAT_COLORS[editing.category]?.bg, color: CAT_COLORS[editing.category]?.color }}>
                    {(editing.category || "general").replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#0a1628", marginBottom: 4 }}>{editing.title || "Untitled"}</div>
                {editing.body && <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{editing.body}</div>}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── List view ──
  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Content Library</div>
          <div className="topbar-sub">{content.length} content item{content.length !== 1 ? "s" : ""}</div>
        </div>
        <button className="btn-primary" onClick={() => setEditing({ ...EMPTY_DRAFT })}>+ New Content</button>
      </div>
      <div className="content">
        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {["all", ...CONTENT_TYPES].map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: "1px solid", cursor: "pointer", fontFamily: "'Sora',sans-serif",
              background: filter === t ? "#0a1628" : "white",
              color: filter === t ? "white" : "#6b7280",
              borderColor: filter === t ? "#0a1628" : "#e5e7eb",
            }}>
              {t === "all" ? "All" : `${TYPE_ICONS[t]} ${t.charAt(0).toUpperCase() + t.slice(1)}`}
            </button>
          ))}
        </div>

        {/* Content cards grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>No content yet</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Create your first piece of campaign content to get started.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {filtered.map(item => (
              <div key={item.id} className="card" style={{ padding: 18, cursor: "pointer", transition: "box-shadow 0.15s" }}
                onClick={() => setEditing(item)} onMouseOver={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"}
                onMouseOut={e => e.currentTarget.style.boxShadow = "none"}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 18 }}>{TYPE_ICONS[item.content_type]}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600,
                      background: CAT_COLORS[item.category]?.bg || "#f3f4f6",
                      color: CAT_COLORS[item.category]?.color || "#6b7280" }}>
                      {(item.category || "general").replace("_", " ").toUpperCase()}
                    </span>
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#d1d5db", padding: 2 }}
                    title="Archive">×</button>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#0a1628", marginBottom: 4, lineHeight: 1.3 }}>{item.title}</div>
                {item.body && (
                  <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {item.body}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
