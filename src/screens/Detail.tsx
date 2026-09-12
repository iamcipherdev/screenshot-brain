// ─── Detail: full preview + AI understanding + extracted info + actions ───

import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { Icon } from '../components/Icon';
import { Thumb } from '../components/Thumb';
import { ConfirmDialog, CopyChip, Sheet, ValueBadge, useConfirm } from '../components/Ui';
import { fullUrl } from '../lib/images';
import { shotById, updateShot, listColls, createColl, addShotsToColl, removeShotFromColl, listShots } from '../lib/repo';
import { hammingHex, fmtDate, fmtTime, fmtBytes, truncate } from '../lib/util';
import type { AiMeta, Collection, Shot } from '../types';
import { CATEGORY_EMOJI, CATEGORY_LABELS, CONTENT_TYPE_LABELS } from '../types';

export function Detail({ id }: { id: string }) {
  const { shots, navigate, goTab, back, deleteShots, refresh, toast, settings, setAskPrefill } = useApp();
  const { spec, ask, close } = useConfirm();
  const [shot, setShot] = useState<Shot | null>(null);
  const [bigUrl, setBigUrl] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  const [collPicker, setCollPicker] = useState(false);
  const [tagPicker, setTagPicker] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [colls, setColls] = useState<Collection[]>([]);
  const [newCollName, setNewCollName] = useState('');

  const load = React.useCallback(async () => {
    const s = await shotById(id);
    setShot(s ?? null);
    if (s) setBigUrl(await fullUrl(s.id));
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (collPicker) void listColls().then(setColls); }, [collPicker]);

  const related = useMemo(() => {
    if (!shot) return [];
    const same = shots.filter((s) => s.id !== shot.id && s.ai?.category && s.ai.category === shot.ai?.category);
    return same.slice(0, 6);
  }, [shots, shot]);

  const dupPeers = useMemo(() => {
    if (!shot) return [];
    return shots.filter((s) => s.id !== shot.id && ((s.dupOf === shot.id) || (shot.dupOf === s.id) || (s.hash && shot.hash && hammingHex(s.hash, shot.hash) <= 6)));
  }, [shots, shot]);

  if (!shot) {
    return (
      <div className="screen">
        <header className="topbar topbar-back">
          <button className="iconbtn" onClick={() => { if (!back()) goTab('library'); }} aria-label="Back"><Icon name="chevronLeft" /></button>
          <div className="topbar-title"><h1>Screenshot</h1></div>
        </header>
        <p className="muted-line">This screenshot is no longer in your library.</p>
      </div>
    );
  }

  const title = shot.ai?.title ?? shot.fileName;
  const ai = shot.ai;

  const toggleFav = async () => {
    await updateShot(shot.id, { fav: !shot.fav });
    await load();
    await refresh();
  };

  const toggleImportant = async () => {
    const next = shot.value === 'important' ? 'useful' : 'important';
    await updateShot(shot.id, {
      value: next,
      valueReason: next === 'important' ? 'You marked this important' : 'You removed the Important mark',
    });
    await load();
    await refresh();
    toast(next === 'important' ? 'Marked important' : 'Important mark removed');
  };

  const toggleSensitive = async () => {
    await updateShot(shot.id, { sensitive: !shot.sensitive });
    setRevealed(false);
    await load();
    await refresh();
    toast(shot.sensitive ? 'Visibility restored' : 'Screenshot protected — blurred in lists');
  };

  const toggleAiExcluded = async () => {
    await updateShot(shot.id, { aiExcluded: !shot.aiExcluded });
    await load();
    await refresh();
    toast(shot.aiExcluded ? 'AI analysis enabled for this screenshot' : 'Excluded — this screenshot will never be sent to cloud AI');
  };

  const saveTags = async () => {
    const tags = tagInput.split(',').map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean).slice(0, 8);
    const base: AiMeta = shot.ai ?? {
      title: shot.fileName.replace(/\.[a-z]+$/i, ''),
      summary: '',
      category: 'other',
      tags: [], dates: [], phones: [], emails: [], urls: [], places: [],
      products: [], tasks: [], orgs: [], names: [], prices: [], deadlines: [],
      contentType: 'other', usefulness: 50,
    };
    await updateShot(shot.id, { ai: { ...base, tags }, aiStatus: shot.ai ? 'done' : shot.aiStatus });
    setTagPicker(false);
    await load();
    await refresh();
    toast('Tags saved');
  };

  const askAboutThis = () => {
    setAskPrefill(`Tell me everything about my screenshot “${truncate(title, 40)}”${shot.ai ? ` (${shot.ai.category})` : ''} — what does it contain and why did I save it?`);
    goTab('brain');
  };

  const reanalyze = async () => {
    if (!settings.geminiKey.trim()) {
      toast('Add a Gemini key in Settings first', 'warn');
      navigate({ name: 'settings' });
      return;
    }
    await updateShot(shot.id, { aiStatus: 'pending' });
    toast('Re-analyzing with AI…');
    const { pipeline } = await import('../lib/pipeline');
    const fresh = await shotById(shot.id);
    if (fresh) pipeline.enqueue([fresh], 1);
    setTimeout(() => void load(), 1500);
  };

  const shareNative = async () => {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text: ai ? `${title}\n\n${ai.summary}` : title, dialogTitle: 'Share screenshot details' });
    } catch {
      try { await navigator.share({ title }); } catch { toast('Sharing not available here', 'warn'); }
    }
  };

  const del = () => {
    ask({
      title: 'Delete this screenshot?',
      danger: true,
      confirmLabel: 'Delete',
      body: <p>“{title}” will be moved to Trash. <b>The original in your phone gallery is not touched.</b> You can restore it from Settings → Trash.</p>,
      onConfirm: async () => {
        await deleteShots([shot.id], { undoable: true });
        if (!back()) goTab('library');
      },
    });
  };

  const inColl = (c: Collection) => c.shotIds.includes(shot.id);

  const toggleColl = async (c: Collection) => {
    if (inColl(c)) {
      await removeShotFromColl(c.id, shot.id);
      toast(`Removed from ${c.name}`);
    } else {
      await addShotsToColl(c.id, [shot.id]);
      toast(`Added to ${c.name}`);
    }
    setColls(await listColls());
  };

  const makeColl = async () => {
    const name = newCollName.trim();
    if (!name) return;
    const c = await createColl(name, '📁');
    await addShotsToColl(c.id, [shot.id]);
    setNewCollName('');
    setColls(await listColls());
    toast(`Created ${c.name}`);
  };

  return (
    <div className="screen detail">
      <header className="topbar topbar-back">
        <button className="iconbtn" onClick={() => { if (!back()) goTab('library'); }} aria-label="Back"><Icon name="chevronLeft" /></button>
        <div className="topbar-title">
          <h1 className="detail-title">{truncate(title, 34)}</h1>
          <p>{fmtDate(shot.createdAt)} · {fmtTime(shot.createdAt)} · {fmtBytes(shot.bytes)}</p>
        </div>
        <button className="iconbtn" onClick={() => void toggleFav()} aria-label="Favorite">
          <Icon name="star" size={19} className={shot.fav ? 'star-on' : ''} />
        </button>
      </header>

      <div className="detail-hero">
        {bigUrl && (
          shot.sensitive && !revealed ? (
            <button className="detail-redacted" onClick={() => setRevealed(true)} aria-label="Reveal protected screenshot">
              <img src={bigUrl} alt="" className="redacted-img" aria-hidden="true" />
              <span className="redacted-note"><Icon name="eye" size={16} /> Protected — tap to reveal</span>
            </button>
          ) : (
            <img src={bigUrl} alt={title} />
          )
        )}
        {shot.dupOf && (
          <div className="dup-banner">
            <Icon name="layers" size={14} />
            <span>Duplicate — similar screenshot found. </span>
            <button className="linkbtn" onClick={() => navigate({ name: 'detail', id: shot.dupOf! })}>Compare</button>
          </div>
        )}
      </div>

      <section className="detail-ai">
        {ai ? (
          <>
            <div className="detail-cat">
              <span className="catchip">{CATEGORY_EMOJI[ai.category]} {CATEGORY_LABELS[ai.category]}</span>
              <ValueBadge level={shot.value} />
              {ai.usefulness >= 60 && <span className="useful">✦ {ai.usefulness}/100</span>}
            </div>
            <h2>{ai.title}</h2>
            <p className="detail-summary">{ai.summary}</p>
            {ai.tags.length > 0 && (
              <div className="tagrow">
                {ai.tags.map((t) => <button key={t} className="chip chip-tag" onClick={() => setTagPicker(true)}>#{t}</button>)}
                <button className="chip chip-action" onClick={() => { setTagInput((shot.ai?.tags ?? []).join(', ')); setTagPicker(true); }}><Icon name="edit" size={12} /> Edit</button>
              </div>
            )}
            {ai.contentType !== 'other' && (
              <span className="catchip ct-chip">{CONTENT_TYPE_LABELS[ai.contentType]}</span>
            )}
            {shot.aiExcluded && (
              <div className="outdated-note ai-excluded-note"><Icon name="keyOff" size={14} /><span>Excluded from AI — this screenshot is never sent to the cloud.</span></div>
            )}
            {ai.outdated && (
              <div className="outdated-note"><Icon name="clock" size={14} /><span>{ai.outdated}</span></div>
            )}
          </>
        ) : (
          <div className="ai-wait">
            <Icon name="sparkles" size={18} />
            <div>
              <b>{shot.aiStatus === 'failed' ? 'AI analysis did not complete' : 'No AI analysis yet'}</b>
              <p>
                {settings.geminiKey.trim()
                  ? 'It will run automatically, or re-run it now.'
                  : 'Add your free Gemini key in Settings — OCR, search and everything else already works without it.'}
              </p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => void reanalyze()}>
              {settings.geminiKey.trim() ? 'Re-run AI' : 'Open Settings'}
            </button>
          </div>
        )}
      </section>

      {(ai && (ai.dates.length || ai.phones.length || ai.emails.length || ai.urls.length || ai.places.length || ai.products.length || ai.tasks.length || ai.orgs.length || ai.names.length || ai.prices.length || ai.deadlines.length)) ? (
        <section className="detail-info">
          <span className="eyebrow">Detected in this screenshot</span>
          <div className="info-groups">
            {ai.dates.length > 0 && <InfoRow icon="calendar" label="Dates" items={ai.dates} />}
            {ai.deadlines.length > 0 && <InfoRow icon="clock" label="Deadlines" items={ai.deadlines} />}
            {ai.orgs.length > 0 && <InfoRow icon="box" label="Organizations" items={ai.orgs} />}
            {ai.names.length > 0 && <InfoRow icon="user" label="People" items={ai.names} />}
            {ai.prices.length > 0 && <InfoRow icon="zap" label="Prices" items={ai.prices} />}
            {ai.phones.length > 0 && <InfoRow icon="phone" label="Phones" items={ai.phones} />}
            {ai.emails.length > 0 && <InfoRow icon="mail" label="Emails" items={ai.emails} />}
            {ai.urls.length > 0 && <InfoRow icon="link" label="Links" items={ai.urls} />}
            {ai.places.length > 0 && <InfoRow icon="pin" label="Places" items={ai.places} />}
            {ai.products.length > 0 && <InfoRow icon="box" label="Products" items={ai.products} />}
            {ai.tasks.length > 0 && <InfoRow icon="check" label="Tasks" items={ai.tasks} />}
          </div>
        </section>
      ) : null}

      {shot.ocr ? (
        <section className="detail-ocr">
          <div className="ocr-head">
            <span className="eyebrow">Extracted text</span>
            <button className="linkbtn" onClick={() => setShowText(!showText)}>{showText ? 'Hide' : 'Show all'}</button>
          </div>
          <blockquote className={showText ? '' : 'ocr-clamped'}>{shot.ocr}</blockquote>
          <CopyChip text={shot.ocr} label="Copy text" />
        </section>
      ) : (
        <section className="detail-ocr">
          <span className="eyebrow">Extracted text</span>
          <p className="muted-line">{shot.ocrStatus === 'pending' ? 'Reading text on-device…' : shot.ocrStatus === 'unavailable' ? 'OCR not available for this shot' : 'No readable text found in this screenshot.'}</p>
        </section>
      )}

      {dupPeers.length > 0 && (
        <section className="detail-related">
          <span className="eyebrow">Very similar screenshots</span>
          <div className="hgrid">
            {dupPeers.map((s) => (
              <button key={s.id} className="tile" onClick={() => navigate({ name: 'detail', id: s.id })}><Thumb id={s.id} /></button>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="detail-related">
          <span className="eyebrow">Related — also {CATEGORY_LABELS[ai?.category ?? 'other']}</span>
          <div className="hgrid">
            {related.map((s) => (
              <button key={s.id} className="tile" onClick={() => navigate({ name: 'detail', id: s.id })}><Thumb id={s.id} /></button>
            ))}
          </div>
        </section>
      )}

      <section className="detail-actions">
        <button className="actionbtn" onClick={askAboutThis}><Icon name="chat" size={18} /><span>Ask AI about this</span></button>
        <button className="actionbtn" onClick={() => void toggleImportant()}><Icon name="star" size={18} /><span>{shot.value === 'important' ? 'Unmark Important' : 'Mark Important'}</span></button>
        <button className="actionbtn" onClick={() => setCollPicker(true)}><Icon name="folder" size={18} /><span>Add to collection</span></button>
        <button className="actionbtn" onClick={() => { setTagInput((shot.ai?.tags ?? []).join(', ')); setTagPicker(true); }}><Icon name="tag" size={18} /><span>Edit tags</span></button>
        <button className="actionbtn" onClick={() => void toggleSensitive()}><Icon name={shot.sensitive ? 'eye' : 'shield'} size={18} /><span>{shot.sensitive ? 'Remove protection' : 'Protect (blur)'}</span></button>
        <button className="actionbtn" onClick={() => void toggleAiExcluded()}><Icon name={shot.aiExcluded ? 'zap' : 'keyOff'} size={18} /><span>{shot.aiExcluded ? 'Include in AI' : 'Exclude from AI'}</span></button>
        <button className="actionbtn" onClick={() => void shareNative()}><Icon name="share" size={18} /><span>Share</span></button>
        <button className="actionbtn action-danger" onClick={del}><Icon name="trash" size={18} /><span>Delete</span></button>
      </section>

      <div className="footline">{shot.fileName} · {shot.width}×{shot.height} · made by CIPHER</div>

      {collPicker && (
        <Sheet title="Add to collection" onClose={() => setCollPicker(false)}>
        <div className="coll-picker">
          {colls.map((c) => (
            <button key={c.id} className={`import-row ${inColl(c) ? 'coll-in' : ''}`} onClick={() => void toggleColl(c)}>
              <span className="import-ico">{c.emoji}</span>
              <span className="import-txt"><b>{c.name}</b><i>{c.shotIds.length} shots</i></span>
              <Icon name={inColl(c) ? 'check' : 'plus'} size={17} className="import-go" />
            </button>
          ))}
          <div className="coll-newrow">
            <input value={newCollName} onChange={(e) => setNewCollName(e.target.value)} placeholder="New collection name" />
            <button className="btn btn-primary btn-sm" onClick={() => void makeColl()}>Create</button>
          </div>
        </div>
        </Sheet>
      )}

      {tagPicker && (
        <Sheet title="Edit tags" onClose={() => setTagPicker(false)}>
          <div className="tag-editor">
            <input
              autoFocus value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void saveTags(); }}
              placeholder="comma, separated, tags"
              aria-label="Tags, comma separated"
            />
            <p className="set-hint">Lowercase keywords that search matches against — e.g. fee, istanbul, react.</p>
            <button className="btn btn-primary" onClick={() => void saveTags()} disabled={!tagInput.trim()}>Save tags</button>
          </div>
        </Sheet>
      )}

      {spec && <ConfirmDialog spec={spec} onClose={close} />}
    </div>
  );
}

function InfoRow({ icon, label, items }: { icon: 'calendar' | 'phone' | 'mail' | 'link' | 'pin' | 'box' | 'check' | 'clock' | 'user' | 'zap'; label: string; items: string[] }) {
  return (
    <div className="info-row">
      <span className="info-ico"><Icon name={icon} size={15} /></span>
      <span className="info-body">
        <b>{label}</b>
        <span className="info-items">
          {items.map((it, i) => (
            /^(https?:\/\/|www\.)/i.test(it)
              ? <a key={i} className="chip chip-action" href={it.startsWith('http') ? it : `https://${it}`} target="_blank" rel="noreferrer">{truncate(it, 42)}</a>
              : <CopyChip key={i} text={it} />
          ))}
        </span>
      </span>
    </div>
  );
}
