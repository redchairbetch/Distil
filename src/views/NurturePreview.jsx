import { useEffect, useState, useMemo } from 'react';
import { loadPersonalizationInputs, loadCampaignContent } from '../db.js';
import { buildProfile, personalizeDeliveries } from '../nurturePersonalization.js';
import { tnsTagLabel } from '../tns_tags.js';

// Read-only nurture personalization preview. Mounted in the patient detail
// when the patient is enrolled in any campaign. Shows the derived profile
// and a per-step swap recommendation. No writes — provider validation only.

const SWAP_BG    = '#fef3c7';
const SWAP_BORD  = '#fde68a';
const KEEP_BG    = '#f9fafb';
const KEEP_BORD  = '#e5e7eb';

export default function NurturePreview({ patientId, clinicId, campaign }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState([]);
  const [expanded, setExpanded] = useState(false);
  // The whole card body (profile + step plan) is collapsed by default — with a
  // ~20-step campaign it was a wall of text on the patient profile. The header
  // still summarizes steps + swaps at a glance.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!patientId || !clinicId || !campaign?.id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      loadPersonalizationInputs(patientId),
      loadCampaignContent(clinicId),
    ]).then(([inputs, contentPool]) => {
      if (cancelled) return;
      const p = buildProfile(inputs);
      setProfile(p);
      const plan = personalizeDeliveries(campaign.campaign_deliveries, p, contentPool);
      setPlan(plan);
      setLoading(false);
    }).catch(err => {
      console.error('NurturePreview load:', err);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [patientId, clinicId, campaign?.id]);

  const swapCount = useMemo(() => plan.filter(p => p.swap).length, [plan]);

  if (loading) {
    return (
      <div className="detail-card full">
        <div className="detail-card-title">Personalization Preview</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>Building patient profile…</div>
      </div>
    );
  }
  if (!profile) return null;

  return (
    <div className="detail-card full">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: open ? 12 : 0 }}>
        <div className="detail-card-title" style={{ marginBottom: 0 }}>
          Personalization Preview
          <span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af', marginLeft: 8 }}>
            {plan.length} step{plan.length !== 1 ? 's' : ''} · {swapCount} would swap
          </span>
        </div>
        {open && (
          <button
            className="btn-ghost"
            style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px' }}
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? 'Collapse steps' : 'Expand all steps'}
          </button>
        )}
        <button
          className="btn-ghost"
          style={{ marginLeft: open ? 6 : 'auto', fontSize: 11, padding: '4px 10px' }}
          onClick={() => setOpen(o => !o)}
        >
          {open ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {open && (
        <>
          <ProfileSummary profile={profile} />

          <div style={{ marginTop: 16, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                        color: '#9ca3af', letterSpacing: 1, marginBottom: 8 }}>
            Step-by-step plan
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plan.length === 0 && (
              <div style={{ fontSize: 13, color: '#6b7280', fontStyle: 'italic' }}>
                No deliveries scheduled for this campaign.
              </div>
            )}
            {plan.map(step => (
              <PlanRow key={step.deliveryId} step={step} forceOpen={expanded} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProfileSummary({ profile }) {
  const chips = [];
  if (profile.age != null)   chips.push({ label: `${profile.age}y`, kind: 'demo' });
  if (profile.severity)      chips.push({ label: profile.severity, kind: 'clin' });
  if (profile.slope)         chips.push({ label: `slope: ${profile.slope}`, kind: 'clin' });
  if (profile.configuration) chips.push({ label: profile.configuration, kind: 'clin' });
  if (profile.asymmetric)    chips.push({ label: 'asymmetric', kind: 'clin' });
  if (profile.wrsLow)        chips.push({ label: 'low WRS', kind: 'clin' });
  if (profile.priorAids)     chips.push({ label: 'prior aids', kind: 'hist' });
  if (profile.hearReady === false) chips.push({ label: 'not ready', kind: 'hist' });

  const tagChips = profile.tags.filter(t =>
    !t.startsWith('age_') && !t.startsWith('slope_') &&
    !['high_freq_loss','asymmetric','low_wrs','tinnitus','prior_aids_user',
      'noise_occupational','noise_recreational','not_ready'].includes(t)
  );

  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
                  padding: 12, fontSize: 12 }}>
      <div style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>Patient profile</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: tagChips.length ? 10 : 0 }}>
        {chips.map((c, i) => (
          <span key={i} style={chipStyle(c.kind)}>{c.label}</span>
        ))}
        {chips.length === 0 && (
          <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
            No clinical data on file yet.
          </span>
        )}
      </div>
      {tagChips.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Objection tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tagChips.map(t => (
              <span key={t} style={chipStyle('tag')}>{tnsTagLabel(t)}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PlanRow({ step, forceOpen }) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  const swapped = step.swap;
  const bg = swapped ? SWAP_BG : KEEP_BG;
  const border = swapped ? SWAP_BORD : KEEP_BORD;

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                 cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', width: 28, flexShrink: 0 }}>
          #{step.stepOrder}
        </span>
        <span style={{ fontSize: 11, color: '#6b7280', width: 70, flexShrink: 0 }}>
          {step.scheduledDate}
        </span>
        <span style={{ fontSize: 11, color: '#6b7280', width: 90, flexShrink: 0 }}>
          {step.phase || '—'}
        </span>
        <span style={{ fontSize: 13, color: '#374151', flex: 1, fontWeight: swapped ? 600 : 400 }}>
          {step.recommended?.title || step.current?.title || '—'}
        </span>
        {swapped && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                         background: '#f59e0b', color: 'white' }}>
            SWAP
          </span>
        )}
        <span style={{ fontSize: 10, color: '#9ca3af' }}>
          {step.recommended?.score?.toFixed(1)}
        </span>
      </div>

      {isOpen && (
        <div style={{ padding: '8px 12px 12px', borderTop: `1px solid ${border}`,
                      fontSize: 12, color: '#374151' }}>
          {swapped && step.current && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: '#9ca3af', textDecoration: 'line-through' }}>
                Was: {step.current.title}
              </span>
              <span style={{ color: '#6b7280', marginLeft: 8 }}>
                ({step.current.score?.toFixed(1) ?? '—'})
              </span>
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>Why:</span>{' '}
            <span style={{ color: '#6b7280' }}>{step.rationale}</span>
          </div>
          {step.recommended?.body && (
            <div style={{ background: 'white', padding: 10, borderRadius: 6,
                          border: '1px solid #e5e7eb', fontSize: 12, color: '#4b5563',
                          marginBottom: 8, lineHeight: 1.5 }}>
              {step.recommended.body.slice(0, 280)}
              {step.recommended.body.length > 280 && '…'}
            </div>
          )}
          {step.alternates?.length > 1 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af',
                            textTransform: 'uppercase', marginBottom: 4 }}>
                Other options
              </div>
              {step.alternates.slice(1).map(a => (
                <div key={a.id} style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
                  · {a.title} <span style={{ color: '#9ca3af' }}>({a.score.toFixed(1)} — {a.why})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function chipStyle(kind) {
  const palette = {
    demo: { bg: '#eef2ff', color: '#4f46e5' },
    clin: { bg: '#ecfdf5', color: '#059669' },
    hist: { bg: '#fef3c7', color: '#92400e' },
    tag:  { bg: '#fce7f3', color: '#be185d' },
  }[kind] || { bg: '#f3f4f6', color: '#374151' };
  return {
    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
    background: palette.bg, color: palette.color,
  };
}
